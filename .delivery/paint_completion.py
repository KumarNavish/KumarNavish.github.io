"""Associate an actual WebGL paint with the scientific frame it rendered.
A DOM state change is not a completed GPU frame. Tests await matching tokens,
then independently compare camera coordinates; no visibility threshold changes.
"""
from pathlib import Path
def replace(path,old,new):
 p=Path(path);s=p.read_text();assert old in s,(path,old[:70]);p.write_text(s.replace(old,new))
replace('modules/worlds/stage.mjs',"shadowDirty=true;", "shadowDirty=true,renderToken='';")
replace('modules/worlds/stage.mjs',"canvas.dataset.rendered='webgl2';", "canvas.dataset.rendered='webgl2';canvas.dataset.renderToken=renderToken;")
replace('modules/worlds/stage.mjs',"setPickables(a){pickables=a;invalidate();}", "setFrameToken(token){renderToken=String(token);invalidate(false);},setPickables(a){pickables=a;invalidate();}")
replace('modules/narrative/renderer.mjs',"disposed=false,free=false,touch=false;", "disposed=false,free=false,touch=false,renderRevision=0;")
replace('modules/narrative/renderer.mjs',"view.setTick(null);view.invalidate(true);", "host.dataset.renderRevision=String(++renderRevision);view.setFrameToken(renderRevision);view.setTick(null);view.invalidate(true);")
replace('scripts/handoff_checks.py',"page.wait_for_function('document.querySelector(\"#demo-root\").dataset.mode===\"explore\"');page.wait_for_timeout(120)", """page.wait_for_function('document.querySelector("#demo-root").dataset.mode==="explore"')
   if key!='case':
    page.wait_for_function("()=>{const host=document.querySelector('.n-render-host'),canvas=host?.querySelector('.world-canvas');return !!host?.dataset.renderRevision&&canvas?.dataset.renderToken===host.dataset.renderRevision;}")""")
print('A paint token now binds the rendered camera to its submitted scientific frame.')
