"""Reconstruct the authored refinement against the verified materialized baseline."""
from pathlib import Path
import gzip, hashlib, json, subprocess, tempfile
root = Path(__file__).resolve().parents[1]
subprocess.run(['python', str(root / '.delivery/prepare.py')], cwd=root, check=True)
packed = b''.join((root / '.delivery' / f'refinement-{i}.bin').read_bytes() for i in range(4))
expected_archive = '2dbe46541c22672f08ac86e153708088438e190d4d709781f66287bf125dd254'
if hashlib.sha256(packed).hexdigest() != expected_archive:
    raise RuntimeError('Refinement archive differs from the authored bytes')
payload = json.loads(gzip.decompress(packed))
with tempfile.TemporaryDirectory(prefix='worlds-refinement-') as d:
    patch = Path(d) / 'authored.patch'
    patch.write_text(payload['patch'])
    subprocess.run(['git', 'apply', '--check', str(patch)], cwd=root, check=True)
    subprocess.run(['git', 'apply', str(patch)], cwd=root, check=True)
subprocess.run(['npm', 'run', 'build'], cwd=root, check=True)
mismatches = []
for name, expected in payload['expected'].items():
    path = root / name
    actual = hashlib.sha256(path.read_bytes()).hexdigest() if path.is_file() else 'MISSING'
    if actual != expected:
        mismatches.append({'file': name, 'expected': expected, 'actual': actual})
receipt = {'checked_files': len(payload['expected']), 'mismatches': mismatches, 'sha256': payload['expected']}
evidence = Path('/tmp/worlds-review'); evidence.mkdir(exist_ok=True)
(evidence / 'refinement-hashes.json').write_text(json.dumps(receipt, indent=2))
print(json.dumps({'checked_files': len(payload['expected']), 'mismatches': mismatches}, indent=2))
if mismatches:
    raise RuntimeError('Refined source hash verification failed; do not publish')
print('REFINED_SOURCE_MATCH', len(payload['expected']), 'files')
