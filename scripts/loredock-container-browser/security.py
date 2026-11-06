"""Verify only this container process's applied security before spawning children."""
import os
from pathlib import Path


def validate(label, status, uid, gid):
    if not isinstance(label, str) or label.strip() != 'docker-default (enforce)':
        raise ValueError('The explicit default AppArmor profile must be enforced.')
    fields = {}
    for line in status.splitlines():
        key, separator, value = line.partition(':')
        if separator:
            if key in fields:
                raise ValueError('Duplicate process status field: ' + key)
            fields[key] = value.strip()
    if uid != 1000 or gid != 1000:
        raise ValueError('The container process must use UID/GID 1000.')
    for key in ('Uid', 'Gid'):
        if fields.get(key, '').split() != ['1000'] * 4:
            raise ValueError('Unexpected process identity: ' + key)
    for key, expected in [('Seccomp', '2'), ('NoNewPrivs', '1')]:
        if fields.get(key) != expected:
            raise ValueError('Missing applied process restriction: ' + key)
    for key in ('CapInh', 'CapPrm', 'CapEff', 'CapBnd', 'CapAmb'):
        value = fields.get(key, '')
        if not value or len(value) > 16 or any(c not in '0123456789abcdefABCDEF' for c in value) or int(value, 16) != 0:
            raise ValueError('Unexpected process capability: ' + key)
    return {'verified': True, 'profile': label.strip(), 'uid': uid, 'gid': gid,
            'seccomp': 2, 'noNewPrivileges': True, 'capabilities': 'all zero',
            'scope': 'Applied restrictions on this PID-1 process before child execution.'}


def observe():
    raw = {'label': Path('/proc/self/attr/current').read_text(),
           'status': Path('/proc/self/status').read_text(), 'uid': os.getuid(), 'gid': os.getgid()}
    return raw
