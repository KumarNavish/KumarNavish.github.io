from pathlib import Path
import hashlib,json,subprocess
r=Path.cwd();p=r/'narrative.css';s=p.read_text()
old='.scroll-narrative .n-stage:has(.n-operator[data-inspecting="true"]){height:min(440px,calc(100svh - 152px));min-height:0;max-height:none}'
new='.scroll-narrative .n-stage[data-mode="explore"]:has(.n-operator){height:min(440px,calc(100svh - 152px));min-height:0;max-height:none}'
assert old in s;s=s.replace(old,new)
s=s.replace('give its graph enough space for the controls and exact footer without\n   enlarging the guided stage or making the reader operate a miniature.', 'keep the graph area stable across mode selections, with space for the\n   controls and exact footer. The guided stage keeps its original height.')
p.write_text(s)
paths=subprocess.check_output(['git','ls-files'],text=True).splitlines()+['scripts/explorer_resize_checks.py']
files={p:hashlib.sha256(Path(p).read_bytes()).hexdigest() for p in paths if not p.startswith('.delivery/') and p!='.github/workflows/closeout-staging.yml'}
assert len(files)==75
assert hashlib.sha256(json.dumps(files,sort_keys=True,separators=(',',':')).encode()).hexdigest()=='460c2f5c196f940045b2f2748ed4a3dd0c2f19f5761d01be1e5ab3040394a3a4'
print('All 75 stable-inspection files match the authored candidate.')
