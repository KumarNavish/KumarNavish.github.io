"""Materialize the explicitly authored frontend files; never generate application logic in CI."""
from pathlib import Path, PurePosixPath
import hashlib, json, lzma, subprocess
root=Path(__file__).resolve().parents[1]
packed=b''.join((root/'.delivery'/f'scroll-{i}.bin').read_bytes() for i in range(4))
assert hashlib.sha256(packed).hexdigest()=='c0894ff8900f02162f0c6732efd1184de8742992a99394708e52dfc5392b0bed','Transport mismatch'
data=json.loads(lzma.decompress(packed));assert data['version']=='scroll-4'
for name,source in data['files'].items():
    p=PurePosixPath(name)
    assert not p.is_absolute() and '..' not in p.parts and not name.startswith('.'),name
    assert p.parts[0] in ['modules','scripts','tests','README.md','narrative.css','package.json'],name
    assert hashlib.sha256(source.encode()).hexdigest()==data['sha256'][name],name
    target=root/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_text(source)
subprocess.run(['npm','run','build'],cwd=root,check=True)
for name,digest in data['generated'].items():
    assert hashlib.sha256((root/name).read_bytes()).hexdigest()==digest,name
print('EXACT_AUTHORED_SOURCE_MATCH',len(data['files'])+len(data['generated']),'files')
