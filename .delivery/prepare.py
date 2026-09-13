from pathlib import Path
import hashlib, json, subprocess
root = Path(__file__).resolve().parents[1]
chunks = [root / '.delivery' / f'style-{i}' for i in range(3)]
if not all(p.exists() for p in chunks):
    raise RuntimeError('Missing authored style chunk')
(root / 'worlds.css').write_bytes(b''.join(p.read_bytes() for p in chunks))
for name in ['integration.json', 'fixes.json']:
    for edit in json.loads((root / '.delivery' / name).read_text()):
        path = root / edit['path']
        data = path.read_text()
        if edit['new'] in data:
            continue
        if edit['old'] not in data:
            raise RuntimeError(f"Expected edit target not found: {edit['path']} {edit['old'][:60]}")
        path.write_text(data.replace(edit['old'], edit['new']))
subprocess.run(['npm', 'run', 'build'], cwd=root, check=True)
expected = json.loads((root / '.delivery' / 'expected-source.json').read_text())
failed = []
for name, digest in expected.items():
    path = root / name
    actual = hashlib.sha256(path.read_bytes()).hexdigest() if path.exists() else 'MISSING'
    if actual != digest:
        failed.append({'file': name, 'expected': digest, 'actual': actual})
print(json.dumps({'checked_files': len(expected), 'mismatches': failed}, indent=2))
if failed:
    raise RuntimeError('Authored bytes differ; do not publish')
print('AUTHORED_SOURCE_MATCH', len(expected), 'files')
