"""Pure consistency checks for supplied user-service ownership records; no live authority."""
import json
import re

CONTRACT_SHA256 = "759dc70e2d3b86043278b8378148785dd061cf29c06fa6f96c3a5bdf00be8e5b"
MAX_RECEIPT = 1048576
MAX_READ = 4096
UINT64_MAX = 18446744073709551615
UUID = r"[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}"
HASH = r"[a-f0-9]{64}"
PROPERTIES = {"Id", "LoadState", "ActiveState", "SubState", "Result", "InvocationID", "MainPID",
              "ControlGroup", "Delegate", "DelegateControllers", "DelegateSubgroup", "NoNewPrivileges",
              "RuntimeMaxUSec", "TimeoutStartUSec", "TimeoutStopUSec", "KillMode", "Restart"}
EXPECTED_KEYS = {"runId", "candidateSha256", "unit", "uid", "gid", "invocationId", "bootId", "clockId"}


def shape(value, required, optional=()):
    return type(value) is dict and set(required) <= value.keys() <= set(required) | set(optional)


def matches(value, pattern):
    return type(value) is str and re.fullmatch(pattern, value) is not None


def bounded_text(value, maximum):
    if type(value) is not str or len(value) > maximum:
        return False
    try:
        return len(value.encode("utf-8")) <= maximum
    except UnicodeError:
        return False


def decimal(value, positive=False):
    if not matches(value, r"0|[1-9][0-9]{0,19}"):
        return None
    number = int(value)
    return number if int(positive) <= number <= UINT64_MAX else None


def unix_id(value, positive=False):
    return type(value) is int and int(positive) <= value <= 4294967294


def duration_us(value):
    if value == "infinity":
        return UINT64_MAX
    if value == "0":
        return 0
    if not bounded_text(value, 160):
        return None
    units = {"w": 604800000000, "d": 86400000000, "h": 3600000000, "min": 60000000,
             "s": 1000000, "ms": 1000, "us": 1}
    previous, total = UINT64_MAX, 0
    for token in value.split(" "):
        matched = re.fullmatch(r"(0|[1-9][0-9]{0,19})(us|ms|s|min|h|d|w)", token)
        if matched is None:
            return None
        number, unit = matched.groups()
        multiplier = units[unit]
        if multiplier >= previous:
            return None
        total += int(number) * multiplier
        if total >= UINT64_MAX:
            return None
        previous = multiplier
    return total


def assess_ownership_receipt(serialized, expected):
    reasons = []
    markers = []
    subject = None

    def add(code, location="", status="UNAVAILABLE"):
        row = {"code": code, "location": location, "status": status}
        if row not in reasons:
            reasons.append(row)

    def finish():
        status = "FAIL" if any(row["status"] == "FAIL" for row in reasons) else "UNAVAILABLE" if reasons else "PASS"
        return {"schemaVersion": "loredock-user-service-ownership-assessment/1", "status": status,
                "subject": subject, "reasons": reasons, "markerDiagnostics": markers,
                "offlineOnly": True, "ownershipEstablished": False, "executorQualified": False,
                "resourceQualification": False,
                "notAssessed": ["authentic-manager-or-kernel-source", "actual-exclusive-claim",
                                "actual-held-descriptor-lifetime", "write-permission", "direct-cgroup-birth",
                                "namespace-confinement", "counter-ownership", "application-resources"]}

    if not bounded_text(serialized, MAX_RECEIPT):
        add("RECEIPT_SIZE_OR_TYPE")
        return finish()
    try:
        data = json.loads(serialized)
        # Producer encoding, not RFC 8785: duplicates and alternate encodings cannot win.
        if json.dumps(data, separators=(",", ":"), ensure_ascii=True, allow_nan=False) != serialized:
            raise ValueError("Noncanonical encoding")
    except (ValueError, RecursionError):
        add("RECEIPT_ENCODING")
        return finish()
    if not shape(data, {"schemaVersion", "contractSha256", "subject", "acquisition", "before", "after"}) or data["schemaVersion"] != "loredock-user-service-ownership/1":
        add("RECEIPT_SCHEMA")
        return finish()
    if data["contractSha256"] != CONTRACT_SHA256:
        add("CONTRACT_MISMATCH")
        return finish()
    if (not shape(expected, EXPECTED_KEYS) or not matches(expected["runId"], UUID)
            or not matches(expected["candidateSha256"], HASH) or not matches(expected["bootId"], UUID)
            or not matches(expected["clockId"], HASH) or not matches(expected["invocationId"], r"[a-f0-9]{32}")
            or not unix_id(expected["uid"], True) or not unix_id(expected["gid"], True)
            or not matches(expected["unit"], r"loredock-[a-z0-9-]{1,96}\.service")
            or not expected["unit"].endswith("-" + expected["runId"] + ".service")
            or not shape(data["subject"], EXPECTED_KEYS) or data["subject"] != expected
            or any(type(data["subject"][key]) is not type(expected[key]) for key in EXPECTED_KEYS)):
        add("SUBJECT_MISMATCH")
        return finish()
    # Copy only validated scalar bindings; never return an authority-bearing object.
    subject = dict(expected)
    manager_root = f"/user.slice/user-{expected['uid']}.slice/user@{expected['uid']}.service"
    paths = {"parent": manager_root + "/app.slice", "unit": manager_root + "/app.slice/" + expected["unit"]}
    paths["attestor"] = paths["unit"] + "/attestor"
    acquisition = data["acquisition"]
    opened = retained = None
    if not shape(acquisition, {"unitAbsentBeforeRequest", "exclusiveClaim", "attempt", "openedAtNs",
                               "retainedAtNs", "recordsRetained", "descriptorsHeld"}):
        add("ACQUISITION_SCHEMA")
    else:
        if (acquisition["unitAbsentBeforeRequest"] is not True or acquisition["exclusiveClaim"] is not True
                or type(acquisition["attempt"]) is not int or acquisition["attempt"] != 1):
            add("FRESH_REQUEST_UNAVAILABLE")
        if acquisition["recordsRetained"] is not True:
            add("ACQUISITION_NOT_RETAINED")
        if acquisition["descriptorsHeld"] is not True:
            add("HELD_CONTINUITY_UNAVAILABLE")
        opened, retained = decimal(acquisition["openedAtNs"]), decimal(acquisition["retainedAtNs"])
        if opened is None or retained is None or opened > retained:
            add("ACQUISITION_TIME_UNAVAILABLE")

    def properties(raw, phase):
        if not bounded_text(raw, MAX_READ) or not raw.endswith("\n"):
            add("UNIT_PROPERTIES_UNAVAILABLE", phase)
            return None
        result = {}
        for line in raw[:-1].split("\n"):
            key, separator, value = line.partition("=")
            if not separator or key not in PROPERTIES or key in result:
                add("UNIT_PROPERTIES_UNAVAILABLE", phase)
                return None
            result[key] = value
        if result.keys() != PROPERTIES:
            add("UNIT_PROPERTIES_UNAVAILABLE", phase)
            return None
        return result

    def marker(row, phase):
        diagnostic = {"phase": phase, "state": "unavailable"}
        if shape(row, {"state"}) and row["state"] == "not-read":
            diagnostic["state"] = "not-read"
        elif shape(row, {"state", "value"}) and row["state"] == "value" and row["value"] in ("0", "1"):
            diagnostic.update(state="value", value=row["value"])
            if row["value"] == "0":
                add("MARKER_CONFLICT", phase)
        elif shape(row, {"state", "errno"}) and type(row["errno"]) is int:
            if row["state"] == "missing" and row["errno"] == 61:
                diagnostic.update(state="missing", errno=61)
            elif row["state"] == "unreadable" and row["errno"] in (1, 13, 95):
                diagnostic.update(state="unreadable", errno=row["errno"])
            else:
                add("MARKER_OBSERVATION_UNAVAILABLE", phase)
        else:
            add("MARKER_OBSERVATION_UNAVAILABLE", phase)
        markers.append(diagnostic)

    def observation(row, phase):
        if not shape(row, {"window", "manager", "unitRaw", "placementRaw", "process", "directories"}, {"marker"}):
            add("OBSERVATION_UNAVAILABLE", phase)
            return None
        marker(row.get("marker", {"state": "not-read"}), phase)
        window = row["window"]
        span = None
        if not shape(window, {"fromNs", "toNs", "clockId"}) or window["clockId"] != expected["clockId"]:
            add("READ_WINDOW_UNAVAILABLE", phase)
        else:
            start, end = decimal(window["fromNs"]), decimal(window["toNs"])
            if start is None or end is None or start > end:
                add("READ_WINDOW_UNAVAILABLE", phase)
            else:
                span = (start, end)
                if opened is not None and start < opened or retained is not None and end > retained:
                    add("READ_WINDOW_OUTSIDE_ACQUISITION", phase)
        manager = row["manager"]
        if (not shape(manager, {"kind", "uid", "controlGroup"}) or manager["kind"] != "user"
                or type(manager["uid"]) is not int or manager["uid"] != expected["uid"]
                or manager["controlGroup"] != manager_root):
            add("USER_MANAGER_IDENTITY", phase)
        process = row["process"]
        process_valid = (shape(process, {"pid", "startTimeTicks", "uid", "gid", "bootId", "invocationId"})
                         and decimal(process["pid"], True) is not None and int(process["pid"]) <= 2147483647
                         and decimal(process["startTimeTicks"], True) is not None
                         and type(process["uid"]) is int and type(process["gid"]) is int
                         and all(process[key] == expected[key] for key in ("uid", "gid", "bootId", "invocationId")))
        if not process_valid:
            add("PROCESS_IDENTITY", phase)
        if row["placementRaw"] != "0::" + paths["attestor"] + "\n":
            add("SELF_PLACEMENT", phase)
        unit = properties(row["unitRaw"], phase)
        attributable = False
        if unit is not None:
            identity = {"Id": expected["unit"], "InvocationID": expected["invocationId"],
                        "ControlGroup": paths["unit"], "LoadState": "loaded", "ActiveState": "active",
                        "SubState": "running", "Result": "success"}
            attributable = process_valid and all(unit[key] == value for key, value in identity.items()) and unit["MainPID"] == process["pid"]
            if not attributable:
                add("UNIT_PROCESS_BINDING", phase)
            if unit["Delegate"] != "yes" or unit["DelegateControllers"] != "memory" or unit["DelegateSubgroup"] != "attestor":
                add("MANAGER_DELEGATION_UNAVAILABLE", phase)
            if attributable:
                required = {"NoNewPrivileges": ("yes", {"yes", "no"}),
                            "KillMode": ("control-group", {"control-group", "mixed", "process", "none"}),
                            "Restart": ("no", {"no", "always", "on-success", "on-failure", "on-abnormal", "on-watchdog", "on-abort"})}
                for key, (value, recognized) in required.items():
                    if unit[key] not in recognized:
                        add("APPLIED_PROFILE_VALUE_UNAVAILABLE", phase + ":" + key)
                    elif unit[key] != value:
                        add("APPLIED_PROFILE_VIOLATION", phase + ":" + key, "FAIL")
                for key, value in {"RuntimeMaxUSec": 10000000, "TimeoutStartUSec": 5000000, "TimeoutStopUSec": 2000000}.items():
                    observed = duration_us(unit[key])
                    if observed is None:
                        add("APPLIED_PROFILE_VALUE_UNAVAILABLE", phase + ":" + key)
                    elif observed != value:
                        add("APPLIED_PROFILE_VIOLATION", phase + ":" + key, "FAIL")
        directories = row["directories"]
        directory_valid = True
        if not shape(directories, {"parent", "unit", "attestor"}):
            add("DIRECTORIES_UNAVAILABLE", phase)
            directory_valid = False
        else:
            for name in ("parent", "unit", "attestor"):
                item = directories[name]
                valid = (shape(item, {"path", "device", "mountId", "inode", "parentInode", "uid", "gid", "held"})
                         and item["path"] == paths[name] and matches(item["device"], r"(?:0|[1-9][0-9]{0,9}):(?:0|[1-9][0-9]{0,9})")
                         and all(decimal(item[key], True) is not None for key in ("mountId", "inode", "parentInode"))
                         and item["inode"] != item["parentInode"] and unix_id(item["uid"]) and unix_id(item["gid"])
                         and item["held"] is True)
                if valid and name != "parent":
                    valid = item["uid"] == expected["uid"] and item["gid"] == expected["gid"]
                if not valid:
                    directory_valid = False
                    add("DIRECTORY_IDENTITY", phase + ":" + name)
            if directory_valid:
                parent, owned, attestor = (directories[name] for name in ("parent", "unit", "attestor"))
                if (owned["parentInode"] != parent["inode"] or attestor["parentInode"] != owned["inode"]
                        or len({item["inode"] for item in (parent, owned, attestor)}) != 3
                        or parent["parentInode"] in {item["inode"] for item in (parent, owned, attestor)}
                        or any(item["device"] != parent["device"] or item["mountId"] != parent["mountId"] for item in (owned, attestor))):
                    add("DIRECTORY_PARENT_OR_MOUNT", phase)
        return {"span": span, "process": process if process_valid else None,
                "unit": unit, "directories": directories if directory_valid else None}

    before = observation(data["before"], "before")
    after = observation(data["after"], "after")
    if before is not None and after is not None:
        if before["span"] is not None and after["span"] is not None and before["span"][1] > after["span"][0]:
            add("OBSERVATION_ORDER")
        for key in ("process", "unit", "directories"):
            if before[key] is not None and after[key] is not None and before[key] != after[key]:
                add("OBSERVATION_IDENTITY_CHANGED", key)
    return finish()
