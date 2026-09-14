"""Materialize reviewed text deltas with immutable before/after byte checks."""
from pathlib import Path
import base64, gzip, hashlib, json, subprocess
root = Path(__file__).resolve().parents[1]
chunks = [(root / '.delivery' / f'delta-{i}.bin').read_bytes() for i in range(3)]
s = base64.b64encode(chunks[0]).decode('ascii')
for old,new in [('GF9VVIV','GF9VIV'),('wrJJub1','wrJub1'),('Cbijcdcat5','Cbijcdgat5'),('NIfIzBB8Lo','NIfIzB8Lo'),('R8LOeZZlp','R8LOeZlp')]:
    assert s.count(old) == 1, old
    s = s.replace(old,new)
chunks[0] = base64.b64decode(s, validate=True)
payload = b''.join(chunks)
assert hashlib.sha256(payload).hexdigest() == '646f1a26b7b8855988fc4bfa4f8bd706f3dfd9a2c5958ab9c408152fcc9f1258', 'Transport bytes differ'
def apply(edits):
    for item in edits:
        relative = Path(item['path'])
        assert not relative.is_absolute() and '..' not in relative.parts and '.git' not in relative.parts
        path = root / relative
        if item['before'] is None:
            assert not path.exists(), f'New file already exists: {relative}'
            text = ''
        else:
            before = path.read_bytes()
            assert hashlib.sha256(before).hexdigest() == item['before'], f'Base changed: {relative}'
            text = before.decode('utf-8')
        for start,end,replacement in reversed(item['edits']):
            text = text[:start] + replacement + text[end:]
        after = text.encode('utf-8')
        assert hashlib.sha256(after).hexdigest() == item['after'], f'Authored delta differs: {relative}'
        path.parent.mkdir(parents=True,exist_ok=True)
        path.write_bytes(after)
edits = json.loads(gzip.decompress(payload))
apply(edits)
subprocess.run(['npm','run','build'],cwd=root,check=True)
for item in edits:
    assert hashlib.sha256((root/item['path']).read_bytes()).hexdigest() == item['after'], item['path']
print('EXACT_AUTHORED_FILES',len(edits),flush=True)
# A real responsive-layout race was found by the first browser run.
# Keep its evidence; apply the tested multi-pass reflow fix before running QA again.
followup = json.loads((root/'.delivery/settled-delta.json').read_text())
apply(followup)
print('EXACT_LAYOUT_FIX_FILES',len(followup),flush=True)
