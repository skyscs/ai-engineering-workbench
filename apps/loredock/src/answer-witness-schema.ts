import type { DatabaseSync } from 'node:sqlite';

export const preparedAnswerInputKind = 'prepared-question/1';
export const answerWitnessVersion = 'loredock-answer-witness/1';
export const answerWitnessLimits = Object.freeze({ records: 64, bytes: 768 * 1024, totalBytes: 48 * 1024 * 1024 });

/** Called inside the Store's schema migration transaction. No filesystem publication. */
export function migrateAnswerWitnessStorage(db: DatabaseSync) {
  db.exec(`
    ALTER TABLE answer_attempts ADD COLUMN inputKind TEXT NOT NULL DEFAULT 'legacy'
      CHECK(inputKind IN ('legacy','prepared-question/1'));
    CREATE TABLE answer_witnesses (
      answerId TEXT PRIMARY KEY REFERENCES answer_attempts(id), preparationId TEXT NOT NULL,
      schemaVersion TEXT NOT NULL, compositionVersion TEXT NOT NULL, promptVersion TEXT NOT NULL,
      contextHash TEXT NOT NULL, reviewedHash TEXT NOT NULL, witness TEXT, witnessBytes INTEGER NOT NULL,
      purged INTEGER NOT NULL DEFAULT 0 CHECK(purged IN (0,1)),
      CHECK((purged=0 AND typeof(witness)='text' AND witnessBytes=length(CAST(witness AS BLOB))
          AND witnessBytes BETWEEN 1 AND 786432)
        OR (purged=1 AND witness IS NULL AND witnessBytes=0)));
    CREATE INDEX answer_source_purge ON answer_sources(sourceId);
    CREATE TRIGGER answer_input_kind_immutable BEFORE UPDATE OF inputKind ON answer_attempts
      BEGIN SELECT RAISE(ABORT,'Answer input kind is immutable.'); END;
    CREATE TRIGGER prepared_answer_identity BEFORE UPDATE OF id,requestId,payloadHash,question,buildId,policyVersion,
      registryVersion,inputHash,connection,model,effort,promptVersion,schemaVersion,createdAt ON answer_attempts
      WHEN OLD.inputKind='prepared-question/1'
      BEGIN SELECT RAISE(ABORT,'Prepared answer identity is immutable.'); END;
    CREATE TRIGGER prepared_answer_replace BEFORE INSERT ON answer_attempts
      WHEN EXISTS(SELECT 1 FROM answer_attempts WHERE inputKind='prepared-question/1' AND (id=NEW.id OR requestId=NEW.requestId))
      BEGIN SELECT RAISE(ABORT,'Prepared answer identity is immutable.'); END;
    CREATE TRIGGER prepared_answer_context BEFORE UPDATE OF context ON answer_attempts
      WHEN OLD.inputKind='prepared-question/1' AND NOT (NEW.context IS OLD.context OR
        (NEW.context IS NULL AND EXISTS(SELECT 1 FROM answer_sources d JOIN sources s ON s.id=d.sourceId
          WHERE d.answerId=OLD.id AND s.status='revoked')))
      BEGIN SELECT RAISE(ABORT,'Only source purge may clear prepared context.'); END;
    CREATE TRIGGER answer_witness_insert BEFORE INSERT ON answer_witnesses
      BEGIN
        SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM answer_attempts WHERE id=NEW.answerId AND inputKind='prepared-question/1')
          OR NEW.purged<>0 OR EXISTS(SELECT 1 FROM answer_witnesses WHERE answerId=NEW.answerId)
          THEN RAISE(ABORT,'Witness requires a new prepared answer.') END;
        SELECT CASE WHEN (SELECT count(*) FROM answer_witnesses)>=64
          OR (SELECT coalesce(sum(length(CAST(witness AS BLOB))),0) FROM answer_witnesses)+length(CAST(NEW.witness AS BLOB))>50331648
          THEN RAISE(ABORT,'Answer witness capacity reached.') END;
      END;
    CREATE TRIGGER answer_witness_identity BEFORE UPDATE OF answerId,preparationId,schemaVersion,compositionVersion,
      promptVersion,contextHash,reviewedHash ON answer_witnesses
      BEGIN SELECT RAISE(ABORT,'Answer witness identity is immutable.'); END;
    CREATE TRIGGER answer_witness_purge BEFORE UPDATE OF witness,witnessBytes,purged ON answer_witnesses
      WHEN NOT (OLD.purged=0 AND NEW.purged=1 AND NEW.witness IS NULL AND NEW.witnessBytes=0
        AND EXISTS(SELECT 1 FROM answer_sources d JOIN sources s ON s.id=d.sourceId
          WHERE d.answerId=OLD.answerId AND s.status='revoked'))
      BEGIN SELECT RAISE(ABORT,'Only source purge may clear answer witnesses.'); END;
    CREATE TRIGGER answer_witness_delete BEFORE DELETE ON answer_witnesses
      BEGIN SELECT RAISE(ABORT,'Answer witness history requires content purge, not deletion.'); END;
    CREATE TRIGGER prepared_sources_insert BEFORE INSERT ON answer_sources
      WHEN EXISTS(SELECT 1 FROM answer_witnesses WHERE answerId=NEW.answerId)
      BEGIN SELECT RAISE(ABORT,'Prepared answer dependencies are immutable.'); END;
    CREATE TRIGGER prepared_sources_update BEFORE UPDATE ON answer_sources
      WHEN EXISTS(SELECT 1 FROM answer_attempts WHERE id IN (OLD.answerId,NEW.answerId) AND inputKind='prepared-question/1')
      BEGIN SELECT RAISE(ABORT,'Prepared answer dependencies are immutable.'); END;
    CREATE TRIGGER prepared_sources_delete BEFORE DELETE ON answer_sources
      WHEN EXISTS(SELECT 1 FROM answer_attempts WHERE id=OLD.answerId AND inputKind='prepared-question/1')
      BEGIN SELECT RAISE(ABORT,'Prepared answer dependencies are immutable.'); END;
    PRAGMA user_version=11;
  `);
}
