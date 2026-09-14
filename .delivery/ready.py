from pathlib import Path
import hashlib,json,subprocess
r=Path.cwd();p=r/'modules/narrative/director.mjs';s=p.read_text()
old=""" const init=requestAnimationFrame(()=>{
  if(!ownsRoute())return;
  measure();positionInitial();initializing=false;frame();
  measure();positionInitial();frame();root.dataset.ready='true';
 });"""
new=""" // Commit readiness only after actual layout has survived a rendering turn.
 // A numeric p=0 on the initial shell is not a completed navigation.
 let settleFrame=0,stablePasses=0,previousLayout=null;
 root.dataset.ready='false';
 function settleInitial(){
  if(!ownsRoute())return;
  measure();positionInitial();frame();
  const geometry=readLayout(),signature=[innerWidth,innerHeight,...geometry.points,geometry.end];
  const stable=previousLayout&&signature.every((v,i)=>Math.abs(v-previousLayout[i])<.5);
  stablePasses=stable?stablePasses+1:0;previousLayout=signature;
  if(stablePasses>=1){root.dataset.ready='true';return;}
  settleFrame=requestAnimationFrame(settleInitial);
 }
 const init=requestAnimationFrame(()=>{
  if(!ownsRoute())return;
  measure();positionInitial();initializing=false;frame();
  settleFrame=requestAnimationFrame(settleInitial);
 });"""
assert old in s;s=s.replace(old,new);s=s.replace('cancelAnimationFrame(init);ro.disconnect();','cancelAnimationFrame(init);cancelAnimationFrame(settleFrame);ro.disconnect();');p.write_text(s)
p=r/'scripts/completion_acceptance.py';s=p.read_text()
old="page.wait_for_selector('#demo-root[data-state]');page.wait_for_function('''target=>{const r=document.querySelector('#demo-root');return r&&(target.explore?"
new="page.wait_for_selector('#demo-root[data-state]');page.wait_for_function('''target=>{const r=document.querySelector('#demo-root');return r&&r.dataset.ready==='true'&&(target.explore?"
assert old in s;s=s.replace(old,new)
old="page.evaluate('(y)=>scrollTo({top:y,behavior:\"instant\"})',a[i]+(a[j]-a[i])*(u-i));page.wait_for_function"
new="page.evaluate('async y=>{scrollTo({top:y,behavior:\"instant\"});await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);}',a[i]+(a[j]-a[i])*(u-i));page.wait_for_function"
assert old in s;p.write_text(s.replace(old,new))
paths=subprocess.check_output(['git','ls-files'],text=True).splitlines()+['scripts/explorer_resize_checks.py']
files={p:hashlib.sha256(Path(p).read_bytes()).hexdigest() for p in paths if not p.startswith('.delivery/') and p!='.github/workflows/closeout-staging.yml'}
assert len(files)==75
assert hashlib.sha256(json.dumps(files,sort_keys=True,separators=(',',':')).encode()).hexdigest()=='5574168d3e0b6eb602633c5cae5cb1670d108ec66529c82c1dd6ba6538410710'
print('All 75 layout-ready application files match the authored candidate.')
