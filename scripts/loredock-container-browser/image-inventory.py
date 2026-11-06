"""Record the candidate image's runtime/dependency files, never host paths."""
import hashlib
import json
import os
from pathlib import Path

assert Path('/opt/workbench/control-inputs.json').is_file()
records = []
for root in ['/usr', '/opt', '/etc', '/var/lib/dpkg']:
    for directory, directories, files in os.walk(root, followlinks=False):
        for name in sorted(directories + files):
            path = Path(directory) / name
            stat = path.lstat()
            if path.is_symlink():
                records.append({'path': str(path), 'symlink': os.readlink(path)})
            elif path.is_file():
                with path.open('rb') as stream:
                    digest = hashlib.file_digest(stream, 'sha256').hexdigest()
                records.append({'path': str(path), 'bytes': stat.st_size, 'mode': stat.st_mode & 0o7777, 'sha256': digest})
            if len(records) > 100000:
                raise RuntimeError('Image inventory exceeds 100000 files.')
for name in ['/browser-libraries.txt', '/node-libraries.txt']:
    assert 'not found' not in Path(name).read_text(), name
Path('/image-files.json').write_text(json.dumps(records, indent=2) + '\n')
print(json.dumps({'imageFiles': len(records), 'regularBytes': sum(row.get('bytes', 0) for row in records)}))
