"""Ensure eigenmode inspection keeps the real graph nodes and arrow tips visible.
Projection uses the published positions, computed eigenmode and observed camera.
No scientific model, renderer or browser policy is substituted.
"""
from pathlib import Path
import argparse,json
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser();p.add_argument('--url',required=True);p.add_argument('--out',required=True);p.add_argument('--engine',default='chromium');a=p.parse_args();out=Path(a.out);out.mkdir(parents=True,exist_ok=True);checks=[];errors=[]
with sync_playwright() as pw:
 b=getattr(pw,a.engine).launch(headless=True);page=b.new_page(reduced_motion='reduce');page.on('pageerror',lambda e:errors.append(str(e)))
 try:
  for width,height in [(1440,1000),(390,844),(320,568)]:
   page.set_viewport_size({'width':width,'height':height});page.goto(a.url.rstrip('/')+'/#work/gain-graphs/explore',wait_until='networkidle');page.wait_for_function('document.querySelector("#demo-root")?.dataset.ready==="true"')
   page.locator('[data-explore="reset"]').click()
   page.locator('[data-parameter="angle"]').evaluate('el=>{el.value=110;el.dispatchEvent(new Event("input",{bubbles:true}));}')
   for mode in range(5):
    before_frame=int(page.locator('.world-canvas').get_attribute('data-frame') or 0)
    page.locator('[data-select="eigenmode"]').select_option(str(mode))
    page.wait_for_function("args=>{const value=JSON.parse(document.querySelector('.n-scene-overlay').dataset.eigenmode||'null'),c=document.querySelector('.world-canvas');return value?.index===args.mode&&+c.dataset.frame>args.before;}",arg={'mode':mode,'before':before_frame})
    reading=page.evaluate('''async()=>{
     const T=await import('./vendor/three.module.min.js');const {gainNodePositions}=await import('./modules/narrative/graph-scenes.mjs');
     const host=document.querySelector('.n-canvas-host'),r=host.getBoundingClientRect(),canvas=host.querySelector('canvas'),projection=JSON.parse(canvas.dataset.projection),camera=new T.PerspectiveCamera(projection.fov,projection.aspect,projection.near,projection.far);camera.position.fromArray(canvas.dataset.camera.split(',').map(Number));camera.lookAt(...projection.target);camera.updateMatrixWorld();
     const mode=JSON.parse(document.querySelector('.n-scene-overlay').dataset.eigenmode),visible=el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return !el.hidden&&s.display!=='none'&&+s.opacity>.1&&r.width>0&&r.height>0;};
     const obstacles=[...document.querySelector('.n-scene-overlay').children,host.querySelector('.camera-tools'),...host.querySelectorAll('.spatial-label')].filter(e=>e&&visible(e)).map(e=>{const a=e.getBoundingClientRect();return{left:a.left-r.left,right:a.right-r.left,top:a.top-r.top,bottom:a.bottom-r.top,name:e.className};});
     const projected=[];
     gainNodePositions.forEach((p,i)=>{const len=.22+mode.amplitudes[i]*.85,angle=mode.phases[i];for(const [kind,v] of [['node',p],['tip',[p[0]+len*Math.cos(angle),p[1]+len*Math.sin(angle),p[2]]]]){const q=new T.Vector3(...v).project(camera),x=(q.x*.5+.5)*r.width,y=(.5-q.y*.5)*r.height,margin=kind==='node'?7:3;projected.push({id:'ABCDE'[i],kind,x,y,contained:x>=margin&&x<=r.width-margin&&y>=margin&&y<=r.height-margin,coveredBy:obstacles.filter(o=>x+margin>o.left&&x-margin<o.right&&y+margin>o.top&&y-margin<o.bottom).map(o=>o.name)});}});
     return{projected,obstacles,projection,mode:mode.index,residual:mode.residual,canvas:[r.width,r.height]};
    }''')
    ok=all(x['contained'] and not x['coveredBy'] for x in reading['projected']) and reading['residual']<1e-9
    checks.append({'size':[width,height],'mode':mode,'passed':ok,**reading});(out/'progress.json').write_text(json.dumps(checks,indent=2))
    if mode in [0,4] or not ok:page.locator('.n-stage').screenshot(path=str(out/f'gain-mode-{mode+1}-{width}.png'))
   before_frame=int(page.locator('.world-canvas').get_attribute('data-frame') or 0)
   page.locator('[data-select="eigenmode"]').select_option('-1')
   page.wait_for_function("before=>{const overlay=document.querySelector('.n-scene-overlay'),canvas=document.querySelector('.world-canvas');return overlay.dataset.eigenmode==='null'&&+canvas.dataset.frame>before;}",arg=before_frame)
   shown=page.locator('.n-operator .n-matrix').is_visible() and page.locator('.n-certificate').is_visible();checks.append({'size':[width,height],'name':'operator and finite repair return when inspection closes','passed':shown})
  assert not errors
  assert all(x['passed'] for x in checks),json.dumps([x for x in checks if not x['passed']])
  (out/'acceptance.json').write_text(json.dumps({'origin':a.url,'engine':a.engine,'checks':checks,'passed':len(checks),'errors':errors},indent=2))
 except Exception as error:
  (out/'failure.json').write_text(json.dumps({'error':str(error),'checks':checks,'errors':errors,'url':page.url,'state':page.locator('#demo-root').get_attribute('data-state'),'mode':page.locator('#demo-root').get_attribute('data-mode'),'selected':page.locator('[data-select="eigenmode"]').input_value(),'mode_readout':page.locator('.n-scene-overlay').get_attribute('data-eigenmode')},indent=2))
  page.screenshot(path=str(out/'failure.png'));raise
 finally:b.close()
print('REFERENT_VISIBILITY_PASSED',len(checks),a.engine,flush=True)
