"""Copy exactly the already-tested application; never write workflow files with CI credentials."""
from pathlib import Path, PurePosixPath
import hashlib, json, subprocess, zipfile
artifact=Path('/tmp/verified-candidate'); root=Path.cwd(); archive=artifact/'source.zip'
expected='c7728314b441e71625913681421af41f24fe8eec3d9f15a78b2501302233e769'
assert hashlib.sha256(archive.read_bytes()).hexdigest()==expected, 'Verified source archive mismatch'
suite=json.loads((artifact/'suite.json').read_text())
assert len(suite)==10 and all(x['returncode']==0 for x in suite), 'A browser suite did not pass'
reports=list(artifact.rglob('acceptance.json'))
assert len(reports)==12, 'Missing executed browser reports'
for p in reports:
 d=json.loads(p.read_text());assert not d.get('errors'),str(p)
 assert all(c.get('pass',True) for c in d.get('checks',[])),str(p)
 assert all(c.get('passed',True) for c in d.get('cases',[])),str(p)
 assert d.get('passed',0)>0,str(p)
unit=(artifact/'unit-tests.txt').read_text()
assert '# pass 118' in unit and '# fail 0' in unit,'Unit tests did not pass'
allowed={'.nojekyll','404.html','LICENSE','README.md','favicon.svg','index.html','narrative.css','package.json','robots.txt','sitemap.xml','studio.css','styles.css','worlds.css'}
manifest={}
with zipfile.ZipFile(archive) as z:
 for item in z.infolist():
  if item.is_dir():continue
  rel=PurePosixPath(item.filename)
  assert not rel.is_absolute() and '..' not in rel.parts,'Unsafe archive path'
  if rel.parts[0]=='.github':continue
  assert rel.parts[0] in {'modules','scripts','tests','vendor'} or str(rel) in allowed,'Unexpected source file'
  data=z.read(item);p=root/str(rel);p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data)
  manifest[str(rel)]=hashlib.sha256(data).hexdigest()
assert len(manifest)==74, 'Unexpected application file count'
subprocess.run(['npm','test'],check=True)
subprocess.run(['npm','run','build'],check=True)
for name,digest in manifest.items():assert hashlib.sha256((root/name).read_bytes()).hexdigest()==digest,name
receipt={'verified_run':34861841940,'verified_artifact':10356211693,'archive_sha256':expected,'application_files':len(manifest),'sha256':manifest,'workflow_files_written':False}
Path('/tmp/seal-receipt.json').write_text(json.dumps(receipt,indent=2))
print('EXACT_VERIFIED_APPLICATION',len(manifest),'files; no workflow modifications')
