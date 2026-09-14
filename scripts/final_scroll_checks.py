"""Additional observed regressions for the final scroll-narrative release.
Runs over an actual HTTP origin; does not mock the renderer or change browser policy.
"""
from pathlib import Path
import argparse, json
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser();p.add_argument('--url',required=True);p.add_argument('--out',required=True);args=p.parse_args()
base=args.url.rstrip('/')+'/';out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
checks=[];errors=[]
def check(name,value):
 checks.append({'name':name,'pass':bool(value)});(out/'checks-progress.json').write_text(json.dumps(checks,indent=2));assert value,name
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True);page=browser.new_page(viewport={'width':1440,'height':1000},reduced_motion='reduce');page.on('pageerror',lambda e:errors.append(str(e)));page.set_default_timeout(20000)
 def start(work,at=0):
  page.goto(base+f'#work/{work}/at/{at}',wait_until='networkidle');page.wait_for_selector('#demo-root[data-state]');page.wait_for_timeout(120)
 def state():return json.loads(page.locator('#demo-root').get_attribute('data-state'))
 def explore():
  y=float(page.locator('#demo-root').get_attribute('data-explore-at'));page.evaluate('(y)=>scrollTo({top:y+10,behavior:"instant"})',y);page.wait_for_function('document.querySelector("#demo-root").dataset.mode==="explore"')
 def setparam(name,value):
  page.locator(f'[data-parameter="{name}"]').evaluate('(el,v)=>{el.value=v;el.dispatchEvent(new Event("input",{bubbles:true}));}',value);page.wait_for_timeout(120)
 start('spatial-world')
 check('opening sentence does not reveal scene metrics',not page.locator('.n-spatial-diff').is_visible())
 check('opening sentence does not reveal structured objects early',not page.locator('.n-structure').is_visible())
 page.screenshot(path=str(out/'language-before-world.png'))
 start('experience-replay',.4)
 check('oracle chapter withholds residual metrics until the residual is explained','Unavailable correction' not in page.locator('.n-bottom-metrics').inner_text())
 explore();page.locator('[data-explore="complete"]').click();page.wait_for_timeout(100);setparam('correction',.4)
 s=state();check('available full-basis correction is not called unreachable',s['unavailable']<1e-8 and s['notApplied']>0 and 'not yet applied' in page.locator('.world-label-layer').inner_text() and 'outside memory span' not in page.locator('.world-label-layer').inner_text())
 page.locator('.n-stage').screenshot(path=str(out/'replay-available-not-applied.png'))
 setparam('correction',1);check('applying the full correction removes the available residual',state()['notApplied']<1e-8 and state()['missing']<1e-8)
 start('tic-lm',1);explore();setparam('month',8);setparam('replay',24);page.locator('[data-explore="stable"]').click();page.wait_for_timeout(150)
 means=json.loads(page.locator('.n-scene-overlay').get_attribute('data-window-means'));check('stable-world geometry matches the stable numerical model',state()['stable'] and state()['drift']==0 and all(x==0 for x in means))
 page.locator('.n-stage').screenshot(path=str(out/'time-stable-world.png'))
 page.locator('[data-explore="stable"]').click();page.wait_for_timeout(120);check('restoring drift changes both the geometry and the calculation',state()['drift']>0 and any(x>0 for x in json.loads(page.locator('.n-scene-overlay').get_attribute('data-window-means'))))
 # Inspect the causal document at mobile width with the actual small-screen CSS.
 page.set_viewport_size({'width':390,'height':844});start('casepath',.6)
 sizes=page.evaluate('''()=>({source:parseFloat(getComputedStyle(document.querySelector('.n-original p')).fontSize),assertion:parseFloat(getComputedStyle(document.querySelector('.n-assertion')).fontSize),status:parseFloat(getComputedStyle(document.querySelector('[data-hold]')).fontSize)})''')
 check('mobile original-source prose is at least 12px',sizes['source']>=12)
 check('mobile assertion and gate are not unreadable miniatures',sizes['assertion']>=10 and sizes['status']>=9)
 contained=page.evaluate('''()=>{const host=document.querySelector('.n-case-canvas').getBoundingClientRect();return [...document.querySelectorAll('.n-case-top,.n-original,.n-case-side,.n-assertion,.n-case-checks')].every(el=>{const r=el.getBoundingClientRect();return r.left>=host.left-1&&r.right<=host.right+1&&r.top>=host.top-1&&r.bottom<=host.bottom+1;});}''')
 check('readable mobile records and gate stay inside the sticky viewport',contained)
 check('mobile source date remains exact','12 May 2026' in page.locator('.n-original mark').inner_text())
 page.screenshot(path=str(out/'casepath-mobile-hold.png'))
 # Inspect every late mobile document chapter for overlap, not just viewport containment.
 for progress in [.2,.4,.6,.8,1]:
  start('casepath',progress)
  bands=page.evaluate('''()=>{const root=document.querySelector('.n-case-canvas'),selectors=['.n-case-records','.n-assertion','.n-case-checks','.n-case-provenance'];const rs=selectors.map(s=>document.querySelector(s).getBoundingClientRect()).filter(r=>r.height>0);const source=document.querySelector('.n-original').getBoundingClientRect();const report=document.querySelector('.n-later').getBoundingClientRect();return {separated:rs.every((r,i)=>!i||r.top>=rs[i-1].bottom+3),contentFits:source.bottom<=rs[0].bottom+1&&report.bottom<=rs[0].bottom+1,packetFits:rs.at(-1).bottom<=root.getBoundingClientRect().bottom-3};}''')
  check(f'CasePath at {progress}: document, assertion, checks and provenance never overlap',bands['separated'] and bands['contentFits'])
  check(f'CasePath at {progress}: provenance stays inside the viewport',bands['packetFits'])
  if progress in [.6,1]:page.screenshot(path=str(out/f'casepath-mobile-separated-{progress}.png'))
 # Chapter links are first-class inputs to the same deterministic director.
 page.goto(base+'#work/gain-graphs/chapter/3',wait_until='networkidle');page.wait_for_selector('#demo-root[data-state]');page.wait_for_timeout(150)
 check('explicit chapter link reconstructs the cycle before the operator',abs(float(page.locator('#demo-root').get_attribute('data-progress'))-.4)<.001 and not page.locator('.n-operator').is_visible())
 # Visual disclosure in every chapter is inspected in the real DOM, not just its numerical reveal field.
 for work in ['gain-graphs','experience-replay','rank-feasibility','tic-lm','casepath','spatial-world','natural-gradient','spectral-bounds','urban-microregions','interaction-dynamics']:
  for progress in [0,.4,1]:
   start(work,progress)
   leaked=page.locator('.scroll-narrative [hidden]').evaluate_all('els=>els.filter(el=>getComputedStyle(el).display!=="none").length')
   check(f'{work} at {progress}: hidden visual elements are actually hidden',leaked==0)
 check('no runtime errors in additional regression paths',not errors)
 (out/'acceptance.json').write_text(json.dumps({'origin':base,'checks':checks,'passed':len(checks),'errors':errors,'scope':'Replayed regressions on actual HTTP/WebGL; not independent human comprehension validation'},indent=2));browser.close()
print('PASSED',len(checks),flush=True)
