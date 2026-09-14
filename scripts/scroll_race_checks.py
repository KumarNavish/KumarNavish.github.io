"""Regression: queued layout notification must not override a newer scroll input.
An explicit DOM reflow models an image/font/caption settling between a scroll and
its frame. No browser behavior, timers, renderer or numerical result is mocked.
"""
from pathlib import Path
import argparse,json
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser();p.add_argument('--url',required=True);p.add_argument('--out',required=True);p.add_argument('--engine',default='webkit');p.add_argument('--expect-adverse',action='store_true');args=p.parse_args()
out=Path(args.out);out.mkdir(parents=True,exist_ok=True);records=[];errors=[]
with sync_playwright() as pw:
 browser=getattr(pw,args.engine).launch(headless=True)
 page=browser.new_page(viewport={'width':320,'height':740},reduced_motion='reduce');page.on('pageerror',lambda e:errors.append(str(e)))
 try:
  for work in ['casepath','gain-graphs','experience-replay','rank-feasibility','tic-lm','spatial-world']:
   page.goto(args.url.rstrip('/')+'/#work/'+work+'/at/0',wait_until='networkidle')
   page.wait_for_function('document.querySelector("#demo-root")?.dataset.ready==="true"')
   for target in [.2,.6,.4,1,.8,0]:
    observed=page.evaluate('''p=>new Promise(resolve=>{
      const root=document.querySelector('#demo-root');const anchors=JSON.parse(root.dataset.anchors),u=p*(anchors.length-1),i=Math.floor(u),j=Math.min(anchors.length-1,i+1),y=anchors[i]+(anchors[j]-anchors[i])*(u-i);
      // Reflow is queued in the same task as a reader scroll. Observer delivery
      // can precede the director's animation frame, as in the recorded failure.
      document.querySelectorAll('.n-chapter').forEach(e=>e.style.minHeight=(e.getBoundingClientRect().height+6)+'px');
      scrollTo({top:y,behavior:'instant'});
      const frames=[];let left=6;function sample(){frames.push({p:+root.dataset.progress,y:scrollY});if(--left)requestAnimationFrame(sample);else resolve({requested:p,actual:+root.dataset.progress,frames});}requestAnimationFrame(sample);
    })''',target)
    observed.update(work=work,passed=abs(observed['actual']-target)<.002)
    records.append(observed);(out/'progress.json').write_text(json.dumps(records,indent=2))
    if not args.expect_adverse and not observed['passed']:
     page.screenshot(path=str(out/'failure.png'));raise AssertionError(json.dumps(observed))
  adverse=sum(not r['passed'] for r in records)
  if args.expect_adverse:assert adverse>0,'Baseline must demonstrate the recorded race; otherwise do not claim causal reproduction.'
  else:assert adverse==0 and not errors
  (out/'acceptance.json').write_text(json.dumps({'engine':args.engine,'origin':args.url,'expect_adverse':args.expect_adverse,'cases':records,'passed':sum(r['passed'] for r in records),'failed':adverse,'errors':errors},indent=2))
 finally:browser.close()
print('BASELINE_FAILING_CASES' if args.expect_adverse else 'RACE_REGRESSIONS_PASSED',adverse if args.expect_adverse else len(records),flush=True)
