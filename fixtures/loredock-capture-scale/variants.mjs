import { scaleCorpus } from './corpus.mjs';
// Frozen structural pressure/refusal inputs, independent of candidate output.
export function variantCorpus(name) {
  const corpus = scaleCorpus(24), intake = corpus['b-reading-intake'], writer = corpus['c-reading-index'];
  const pub = 'app/Readings.java', sub = 'app/ReadingWriter.java';
  if (name === 'long-support') {
    const comment = Array.from({ length: 180 }, (_, i) => '// Original support ' + String(i).padStart(3, '0') + ' ' + 'x'.repeat(76)).join('\n') + '\n';
    intake[pub] = comment + intake[pub]; writer[sub] = comment + writer[sub];
    intake[pub] = intake[pub].replace('readings.accepted.v4', 'r'.repeat(256));
    writer[sub] = writer[sub].replace('readings.accepted.v4', 'r'.repeat(256));
  } else if (name === 'branches' || name === 'comparison-pressure') {
    const count = name === 'branches' ? 6 : 46;
    const call = '    publisher.publish("readings.accepted.v4", device, event);';
    intake[pub] = intake[pub].replace(call, Array(count).fill(call).join('\n'));
    const methods = Array.from({ length: count - 1 }, (_, i) => `  void listen${i}(KafkaSubscriber subscriber, String group) { subscriber.subscribe("readings.accepted.v4", group, this); }`).join('\n');
    writer[sub] = writer[sub].replace('  void onMessage', methods + '\n  void onMessage');
  } else if (name === 'different-topic') writer[sub] = writer[sub].replace('readings.accepted.v4', 'readings.rejected.v4');
  else if (name === 'dynamic-topic') intake[pub] = intake[pub].replace('"readings.accepted.v4"', 'device');
  else if (name === 'ambiguous-handler') intake['app/Shadow.java'] = 'final class Readings { void accept(String device, String sample) {} }\n';
  else if (name === 'incomplete-consumer') writer['app/Marker.java'] = 'interface Marker {}\n';
  else if (name === 'source-overflow') {
    for (let i = 0; i < 477; i++) intake[`overflow/${String(i).padStart(4, '0')}.ts`] = `export const overflow = ${i};\n`;
  } else if (name === 'opaque-path') intake.opaque = { symlink: 'not-present' };
  else if (name !== 'omitted-facts') throw new Error('Unknown frozen variant.');
  return corpus;
}
