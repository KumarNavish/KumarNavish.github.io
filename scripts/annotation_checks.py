"""Check final-size labels against actual scientific overlays, not guessed margins."""
from pathlib import Path
import json,argparse
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser();p.add_argument('--url',required=True);p.add_argument('--out',required=True);args=p.parse_args();out=Path(args.out);out.mkdir(parents=True,exist_ok=True);checks=[];errors=[]
with sync_playwright() as pw:
 b=pw.chromium.launch(headless=True);page=b.new_page(reduced_motion='reduce');page.on('pageerror',lambda e:errors.append(str(e)))
 try:
  for width,height in [(1440,1000),(390,844),(320,568)]:
   page.set_viewport_size({'width':width,'height':height})
   for work,points in [('gain-graphs',[.4,.6,.8,1]),('experience-replay',[.2,.4,.6,.8,1]),('rank-feasibility',[0,.4,.6,.8,1]),('tic-lm',[.4,.8,1]),('natural-gradient',[0,.33,.67,1]),('spatial-world',[.67,.83,1])]:
    for at in points:
     page.goto(args.url.rstrip('/')+f'/#work/{work}/at/{at}',wait_until='networkidle');page.wait_for_function('document.querySelector("#demo-root")?.dataset.ready==="true"');page.wait_for_selector('.world-canvas[data-rendered]')
     # A renderer frame follows the director frame; inspect the composited state.
     page.wait_for_timeout(90)
     d=page.evaluate('''()=>{const root=document.querySelector('.n-render-host'),host=root.querySelector('.world-viewport').getBoundingClientRect(),visible=e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return !e.hidden&&s.display!=='none'&&s.visibility!=='hidden'&&+s.opacity>=.08&&r.width>0&&r.height>0;},rect=e=>{const r=e.getBoundingClientRect();return{left:r.left,top:r.top,right:r.right,bottom:r.bottom,text:e.textContent};},labels=[...root.querySelectorAll('.spatial-label')].filter(visible).map(rect),panels=[...root.querySelector('.n-scene-overlay').children,root.querySelector('.camera-tools')].filter(e=>e&&visible(e)).map(rect),overlap=(a,b)=>a.left<b.right-1&&a.right>b.left+1&&a.top<b.bottom-1&&a.bottom>b.top+1;return{labels,collisions:labels.flatMap((a,i)=>[...panels,...labels.slice(i+1)].filter(b=>overlap(a,b)).map(b=>[a.text,b.text])),hiddenPrimary:[...root.querySelectorAll('.spatial-label')].filter(e=>e.dataset.occluded==='true').map(e=>e.textContent)}}''')
     item={'work':work,'at':at,'size':[width,height],'passed':not d['collisions'],'collisions':d['collisions'],'hidden':d['hiddenPrimary']};checks.append(item);(out/'progress.json').write_text(json.dumps(checks,indent=2))
     if d['collisions'] or d['hiddenPrimary']:
      page.screenshot(path=str(out/f'{work}-{width}-{at}-issue.png'));raise AssertionError(item)
     if work=='experience-replay' and at==1 or work=='gain-graphs' and at==.8 or work=='rank-feasibility' and at==1:page.screenshot(path=str(out/f'{work}-{width}-{at}.png'))
  assert not errors
  (out/'acceptance.json').write_text(json.dumps({'origin':args.url,'checks':checks,'passed':len(checks),'errors':errors},indent=2))
 finally:b.close()
print('ANNOTATION_CHECKS_PASSED',len(checks),flush=True)
