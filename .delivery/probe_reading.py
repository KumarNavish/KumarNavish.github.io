"""Observe the existing production failure without changing application timing before it occurs."""
from pathlib import Path
import subprocess, sys
source=Path('scripts/completion_acceptance.py').read_text()
old=" checks.append({'name':name,'pass':bool(ok)});(out/'progress.json').write_text(json.dumps(checks,indent=2));assert ok,name"
new=''' checks.append({'name':name,'pass':bool(ok)});(out/'progress.json').write_text(json.dumps(checks,indent=2))
 if not ok and 'complete headline and scientific stage' in name:
  samples=page.evaluate("""async i=>{const samples=[];const take=()=>{const r=document.querySelector('#demo-root'),h=document.querySelectorAll('.n-chapter h2')[i].getBoundingClientRect(),s=document.querySelector('.n-stage').getBoundingClientRect();return{time:performance.now(),y:scrollY,top:h.top,bottom:h.bottom,stageBottom:s.bottom,height:innerHeight,anchors:r.dataset.anchors,progress:r.dataset.progress,ready:r.dataset.ready,fonts:document.fonts.status}};samples.push(take());for(let k=0;k<12;k++){await new Promise(requestAnimationFrame);samples.push(take());}return samples;}""",i)
  record={'name':name,'immediate':reading,'subsequent_frames':samples}
  (out/('reading-failure-'+str(len(checks))+'.json')).write_text(json.dumps(record,indent=2));page.screenshot(path=str(out/('reading-failure-'+str(len(checks))+'.png')))
  return
 assert ok,name'''
assert old in source
source=source.replace(old,new)
old="return{top:h.top,bottom:h.bottom,stageBottom:stage.bottom,height:innerHeight}"
new="return{time:performance.now(),y:scrollY,top:h.top,bottom:h.bottom,stageBottom:stage.bottom,height:innerHeight,anchors:document.querySelector('#demo-root').dataset.anchors,progress:document.querySelector('#demo-root').dataset.progress,ready:document.querySelector('#demo-root').dataset.ready}"
assert old in source
source=source.replace(old,new).replace("print('PASSED',len(checks),args.engine,flush=True)","print('DIAGNOSTIC',len(checks),'checks;',sum(not c['pass'] for c in checks),'observed failures',flush=True)")
p=Path('/tmp/reading_probe_generated.py');p.write_text(source)
subprocess.run([sys.executable,str(p),*sys.argv[1:]],check=True)
