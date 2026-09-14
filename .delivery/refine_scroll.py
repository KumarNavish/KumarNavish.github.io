from pathlib import Path
import hashlib,json,zlib,subprocess
root=Path(__file__).resolve().parents[1]
packed=(root/'.delivery/refine-scroll.bin').read_bytes()
assert hashlib.sha256(packed).hexdigest()=='b3401e9a88940af707795a7e4232a80899431897b832c9ef5c973302972f5dfe'
changes=json.loads(zlib.decompress(packed))
for change in changes:
    path=root/change['path'];text=path.read_text()
    assert hashlib.sha256(text.encode()).hexdigest()==change['before'],change['path']
    for start,end,replacement in reversed(change['edits']):
        text=text[:start]+replacement+text[end:]
    assert hashlib.sha256(text.encode()).hexdigest()==change['after'],change['path']
    path.write_text(text)
subprocess.run(['npm','run','build'],cwd=root,check=True)
print('EXACT_SCROLL_REFINEMENT_MATCH',len(changes),'files')
