from pathlib import Path
import hashlib, json, subprocess
root=Path(__file__).resolve().parents[1]
def apply(name):
 for item in json.loads((root/'.delivery'/name).read_text()):
    relative=Path(item['path'])
    assert not relative.is_absolute() and '..' not in relative.parts and '.git' not in relative.parts
    path=root/relative
    before=path.read_bytes()
    assert hashlib.sha256(before).hexdigest()==item['before'],f'Unexpected base: {relative}'
    text=before.decode('utf-8')
    for start,end,replacement in reversed(item['edits']):
        text=text[:start]+replacement+text[end:]
    after=text.encode('utf-8')
    assert hashlib.sha256(after).hexdigest()==item['after'],f'Authored bytes differ: {relative}'
    path.write_bytes(after)
apply('reading-delta.json')
print('EXACT_READING_ANCHOR_FILES 2',flush=True)
subprocess.run(['python','.delivery/synchronize_checks.py'],cwd=root,check=True)
apply('stable-layout-delta.json')
print('EXACT_LAYOUT_INITIALIZATION_FILES 2',flush=True)
