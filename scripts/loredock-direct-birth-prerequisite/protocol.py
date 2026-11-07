"""Pure native birth/exit record checks; no live authority or resource qualification."""
import json
import re

SCHEMA = "loredock-direct-birth-native/1"
FLAGS = "8589938688"
UINT64_MAX = 18446744073709551615
BIRTH_KEYS = {"schemaVersion", "phase", "mechanism", "flags", "pid", "startTimeTicks", "uid", "gid",
              "placement", "device", "inode", "fromNs", "observedNs"}
EXIT_KEYS = {"schemaVersion", "phase", "pid", "waited", "exitCode", "signal", "pidfdReady",
             "targetStable", "forcedKill", "collectorError", "toNs"}


def decimal(value, positive=False):
    if type(value) is not str or not re.fullmatch(r"0|[1-9][0-9]{0,19}", value):
        return None
    number = int(value)
    return number if int(positive) <= number <= UINT64_MAX else None


def decode_line(line):
    if type(line) is not str or len(line.encode("utf-8")) > 4096:
        raise ValueError("Native record exceeds bound")
    def pairs(items):
        result = {}
        for key, value in items:
            if key in result:
                raise ValueError("Duplicate native field")
            result[key] = value
        return result
    def invalid_constant(_):
        raise ValueError("Invalid native number")
    value = json.loads(line, object_pairs_hook=pairs, parse_constant=invalid_constant)
    if type(value) is not dict:
        raise ValueError("Native record must be an object")
    return value


def valid_birth(row, expected, started_ns, observed_ns):
    if type(row) is not dict or set(row) != BIRTH_KEYS:
        return False
    if (row["schemaVersion"] != SCHEMA or row["phase"] != "birth" or row["mechanism"] != "clone3"
            or row["flags"] != FLAGS or type(row["uid"]) is not int or type(row["gid"]) is not int
            or any(row[key] != expected[key] for key in ("uid", "gid", "placement", "device", "inode"))):
        return False
    numbers = {key: decimal(row[key], key in ("pid", "startTimeTicks", "inode"))
               for key in ("pid", "startTimeTicks", "device", "inode", "fromNs", "observedNs")}
    return (all(value is not None for value in numbers.values()) and numbers["pid"] <= 2147483647
            and started_ns <= numbers["fromNs"] <= numbers["observedNs"] <= observed_ns)


def valid_exit(row, birth, ended_ns):
    return (type(row) is dict and set(row) == EXIT_KEYS and row["schemaVersion"] == SCHEMA and row["phase"] == "exit"
            and row["pid"] == birth["pid"] and all(row[key] is True for key in ("waited", "pidfdReady", "targetStable"))
            and row["forcedKill"] is False and all(type(row[key]) is int and row[key] == 0 for key in ("exitCode", "signal", "collectorError"))
            and decimal(row["toNs"]) is not None and int(birth["observedNs"]) <= int(row["toNs"]) <= ended_ns)


def assess_pre_exec(record, birth, expected):
    reasons, violated = [], False
    try:
        fields = ("processStatRaw", "placementRaw", "statusRaw")
        if (type(record) is not dict or any(type(record.get(key)) is not str
                or len(record[key].encode("utf-8")) > 4096 for key in fields)):
            raise ValueError("Missing bounded kernel records")
        raw = record["processStatRaw"]
        start = raw.rsplit(")", 1)[1].split()[19]
        identity = (raw.split(" ", 1)[0] == birth["pid"] and start == birth["startTimeTicks"]
                    and record["placementRaw"] == "0::" + expected["placement"] + "\n")
        if not identity:
            reasons.append("KERNEL_PROCESS_IDENTITY")
        status = {}
        selected = {"Uid", "Gid", "NoNewPrivs", "CapInh", "CapPrm", "CapEff", "CapAmb"}
        for line in record["statusRaw"].splitlines():
            key, separator, value = line.partition(":")
            if key in selected:
                if not separator or key in status:
                    raise ValueError("Ambiguous process status")
                status[key] = value.strip()
        credentials = all(status.get(key, "").split() == [str(expected[expected_key])] * 4
                          for key, expected_key in (("Uid", "uid"), ("Gid", "gid")))
        if not credentials:
            reasons.append("KERNEL_CREDENTIALS")
        for key in selected - {"Uid", "Gid"}:
            value = status.get(key)
            recognized = value in ("0", "1") if key == "NoNewPrivs" else type(value) is str and re.fullmatch(r"[0-9a-f]{16}", value)
            if not recognized:
                reasons.append("KERNEL_SECURITY_FIELD:" + key)
            elif identity and credentials and value != ("1" if key == "NoNewPrivs" else "0000000000000000"):
                violated = True
                reasons.append("KERNEL_SECURITY_VIOLATION:" + key)
        if record.get("targetProcsRaw") != birth["pid"] + "\n":
            reasons.append("TARGET_PROCESS_MEMBERSHIP")
        start_ns, end_ns = decimal(record.get("fromNs")), decimal(record.get("toNs"))
        if start_ns is None or end_ns is None or not int(birth["observedNs"]) <= start_ns <= end_ns:
            reasons.append("KERNEL_READ_WINDOW")
    except (KeyError, IndexError, TypeError, ValueError, UnicodeError):
        reasons.append("PRE_EXEC_EVIDENCE_UNAVAILABLE")
    return {"status": "FAIL" if violated else "UNAVAILABLE" if reasons else "PASS",
            "reasons": sorted(set(reasons)), "offlineOnly": True}


def assess_native(result, expected, retained_birth, independent, owner, transport):
    """Supplied records only; the collector must separately establish live provenance."""
    reasons, rows = [], []
    status = "UNAVAILABLE"
    # Independently retained security evidence survives a subsequently lost native stream.
    try:
        if valid_birth(retained_birth, expected, 0, UINT64_MAX):
            pre_exec = assess_pre_exec(independent, retained_birth, expected)
            if pre_exec["status"] == "FAIL":
                status = "FAIL"
            if pre_exec["status"] != "PASS":
                reasons.extend(pre_exec["reasons"])
    except (KeyError, TypeError, ValueError, UnicodeError, RecursionError):
        reasons.append("PRE_EXEC_EVIDENCE_UNAVAILABLE")
    try:
        raw = result["stdout"]
        if type(raw) is not str or len(raw.encode("utf-8")) > 65536 or not raw.endswith("\n"):
            raise ValueError("Bounded complete native stream unavailable")
        lines = raw.splitlines()
        if len(lines) > 8:
            raise ValueError("Unexpected native stream records")
        for line in lines:
            try:
                rows.append(decode_line(line))
            except (ValueError, UnicodeError, RecursionError):
                reasons.append("MALFORMED_NATIVE_RECORD")
        payloads = [row for row in rows if row.get("schemaVersion") == "loredock-namespace-payload/1"]
        if len(payloads) == 1:
            payload = transport.assess_payload({"exitCode": 0, "failure": None, "stdout": json.dumps(payloads[0])},
                                              owner, expected["uid"], expected["gid"])
            if payload["status"] == "FAIL":
                status = "FAIL"
            if payload["status"] != "PASS":
                reasons.extend("PAYLOAD:" + reason for reason in payload["reasons"])
        else:
            payload = {"status": "UNAVAILABLE"}
            reasons.append("PAYLOAD_EVIDENCE_UNAVAILABLE")
        exits = [row for row in rows if row.get("schemaVersion") == SCHEMA and row.get("phase") == "exit"]
        if (len(exits) == 1 and valid_birth(retained_birth, expected, int(result["startedAtNs"]), int(result["endedAtNs"]))
                and exits[0].get("pid") == retained_birth["pid"] and exits[0].get("forcedKill") is True):
            status = "FAIL"
            reasons.append("FORCED_NATIVE_CLEANUP")
        if len(rows) != 3 or rows[1].get("schemaVersion") != "loredock-namespace-payload/1":
            reasons.append("NATIVE_RECORD_ORDER")
        else:
            birth, _, end = rows
            binding = valid_birth(birth, expected, int(result["startedAtNs"]), int(result["endedAtNs"]))
            if not binding or birth != retained_birth:
                reasons.append("RETAINED_BIRTH_MISMATCH")
            if not binding or not valid_exit(end, birth, int(result["endedAtNs"])):
                reasons.append("NATIVE_EXIT_UNAVAILABLE")
            if end.get("forcedKill") is True:
                status = "FAIL"
                reasons.append("FORCED_NATIVE_CLEANUP")
            if (type(independent) is not dict or independent.get("birth") != birth
                    or independent.get("validated") is not True or independent.get("retainedBeforeAck") is not True):
                reasons.append("INDEPENDENT_PRE_EXEC_OBSERVATION_UNAVAILABLE")
            elif (independent.get("targetIdentity") != {key: expected[key] for key in ("device", "inode", "uid", "gid")}
                    or decimal(independent.get("toNs")) is None
                    or int(independent["toNs"]) > int(result["endedAtNs"])):
                reasons.append("INDEPENDENT_TARGET_OR_WINDOW_MISMATCH")
        if result.get("failure") or result.get("exitCode") != 0 or result.get("acknowledged") is not True:
            reasons.append("NATIVE_COLLECTION_UNAVAILABLE")
        if not reasons and payload["status"] == "PASS":
            status = "PASS"
    except (KeyError, TypeError, ValueError, UnicodeError, RecursionError):
        reasons.append("NATIVE_EVIDENCE_UNAVAILABLE")
    return {"status": status, "reasons": sorted(set(reasons)), "offlineOnly": True,
            "directBirthEstablished": False, "executorQualified": False, "resourceQualification": False}
