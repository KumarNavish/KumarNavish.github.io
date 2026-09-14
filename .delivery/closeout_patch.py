from pathlib import Path
import hashlib, subprocess
r=Path.cwd();p=r/'modules/narrative/director.mjs';s=p.read_text()
old="const init=requestAnimationFrame(()=>{if(!ownsRoute())return;measure();if(startExploring)moveTo(exploreAt+4,{animate:false});else if(at!==null)goProgress(at);else if(chapter!==null)goProgress(Math.max(0,Math.min(count-1,chapter))/(count-1));else queue();initializing=false;frame();root.dataset.ready='true';});"
new="""// The first rendered cue and overlays can change intrinsic layout in WebKit.
 // Measure once with those actual contents in place, then commit the requested
 // reading position. Do not publish readiness against the empty initial shell.
 function positionInitial(){
  if(startExploring)moveTo(exploreAt+4,{animate:false});
  else if(at!==null)goProgress(at);
  else if(chapter!==null)goProgress(Math.max(0,Math.min(count-1,chapter))/(count-1));
  else queue();
 }
 const init=requestAnimationFrame(()=>{
  if(!ownsRoute())return;
  measure();positionInitial();initializing=false;frame();
  measure();positionInitial();frame();root.dataset.ready='true';
 });"""
assert old in s;p.write_text(s.replace(old,new))
p=r/'package.json';p.write_text(p.read_text().replace('"4.2.0"','"4.2.1"'))
for p in r.rglob('*'):
 if p.is_file() and p.suffix in ['.mjs','.py','.md','.html'] and not any(x in p.parts for x in ['vendor','.git','.delivery']):
  s=p.read_text()
  if 'scroll-4.2' in s:p.write_text(s.replace('scroll-4.2','scroll-4.2.1'))
subprocess.run(['npm','run','build'],check=True)
assert hashlib.sha256((r/'modules/narrative/director.mjs').read_bytes()).hexdigest()=='5303b5189a21b582183107092a6aa0b35b4e25d489ddb2f9016db5547ddd29e7'
print('Exact authored director matched; scientific calculations are unchanged.')
