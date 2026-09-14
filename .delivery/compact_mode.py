from pathlib import Path
import hashlib,json,subprocess
r=Path.cwd()
p=r/'modules/narrative/graph-scenes.mjs';s=p.read_text()
old="if(f.inspection){a.push({text:'Eigenmode '+(f.inspection.index+1)+' · computed from L',pos:[0,3.7,-.4],tone:'amber'});}else if"
new="if(f.inspection){/* The exact mode title is already in the readout; keep the arrows unobstructed. */}else if"
assert old in s;p.write_text(s.replace(old,new))
p=r/'narrative.css';p.write_text(p.read_text()+'''\n/* Detailed inspection is a deliberate explorer action. On a short phone,
   give its graph enough space for the controls and exact footer without
   enlarging the guided stage or making the reader operate a miniature. */
@media(max-width:780px) and (max-height:650px){
 .scroll-narrative .n-stage:has(.n-operator[data-inspecting="true"]){height:min(440px,calc(100svh - 152px));min-height:0;max-height:none}
}
''')
p=r/'scripts/referent_checks.py';s=p.read_text();old="host.querySelector('.camera-tools')].filter";new="host.querySelector('.camera-tools'),...host.querySelectorAll('.spatial-label')].filter";assert old in s;p.write_text(s.replace(old,new))
paths=subprocess.check_output(['git','ls-files'],text=True).splitlines()
files={p:hashlib.sha256(Path(p).read_bytes()).hexdigest() for p in paths if not p.startswith('.delivery/') and p!='.github/workflows/closeout-staging.yml'}
assert len(files)==74
assert hashlib.sha256(json.dumps(files,sort_keys=True,separators=(',',':')).encode()).hexdigest()=='570467ffa3dd7fca61f9de4f49b598fc402194572f14245e2df19c2ff9ef062c'
print('All 74 compact-inspection candidate files match authored source.')
