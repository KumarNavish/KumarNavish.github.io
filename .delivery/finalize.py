"""Apply only the reviewed final patch to the previously verified staging source."""
from pathlib import Path
import gzip, hashlib, json, subprocess, tempfile
root = Path(__file__).resolve().parents[1]
packed = b''.join((root / '.delivery' / f'final-{i}.bin').read_bytes() for i in range(3))
if hashlib.sha256(packed).hexdigest() != 'c0f6ce616ad6dedb7636f863100f85440b276d9f5010f788ce17a93c288768b0':
    raise RuntimeError('Final patch archive hash differs from authored bytes')
payload = json.loads(gzip.decompress(packed))
for name, expected in payload['before'].items():
    if hashlib.sha256((root/name).read_bytes()).hexdigest() != expected:
        raise RuntimeError(f'Base file differs from the reviewed staging source: {name}')
with tempfile.TemporaryDirectory(prefix='worlds-final-') as d:
    patch = Path(d)/'reviewed.patch'; patch.write_text(payload['patch'])
    subprocess.run(['git','apply','--check',str(patch)],cwd=root,check=True)
    subprocess.run(['git','apply',str(patch)],cwd=root,check=True)
subprocess.run(['npm','run','build'],cwd=root,check=True)
failed=[]
for name,expected in payload['expected'].items():
    actual=hashlib.sha256((root/name).read_bytes()).hexdigest()
    if actual!=expected: failed.append({'file':name,'actual':actual,'expected':expected})
evidence=Path('/tmp/worlds-review'); evidence.mkdir(exist_ok=True)
(evidence/'final-source-hashes.json').write_text(json.dumps({'checked_files':len(payload['expected']),'mismatches':failed,'sha256':payload['expected']},indent=2))
if failed: raise RuntimeError(json.dumps(failed))
print('FINAL_SOURCE_MATCH',len(payload['expected']),'files')
