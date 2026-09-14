"""End-to-end completion checks on the actual served application, never an in-memory stand-in."""
from pathlib import Path
import argparse,json
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser();p.add_argument('--url',required=True);p.add_argument('--out',required=True);p.add_argument('--engine',default='chromium');p.add_argument('--trace',action='store_true');args=p.parse_args()
base=args.url.rstrip('/')+'/';out=Path(args.out);out.mkdir(parents=True,exist_ok=True);checks=[];errors=[];failed=[]
def check(name,ok):
 checks.append({'name':name,'pass':bool(ok)});(out/'progress.json').write_text(json.dumps(checks,indent=2));assert ok,name
with sync_playwright() as pw:
 browser=getattr(pw,args.engine).launch(headless=True);page=browser.new_page(viewport={'width':1440,'height':1000},reduced_motion='reduce');page.set_default_timeout(20000);page.on('pageerror',lambda e:errors.append(str(e)));page.on('requestfailed',lambda r:failed.append(r.url))
 if args.trace:page.add_init_script('''(()=>{const samples=[];window.__readingTrace=samples;const take=(kind,requested)=>{const r=document.querySelector('#demo-root');samples.push({kind,requested,w:innerWidth,h:innerHeight,y:scrollY,p:r?.dataset.progress,mode:r?.dataset.mode,hash:location.hash});if(samples.length>160)samples.shift();};const original=window.scrollTo;window.scrollTo=function(...a){take('scrollTo',a);return original.apply(this,a)};addEventListener('resize',()=>take('resize'));addEventListener('scroll',()=>take('scroll'),{passive:true});})();''')
 try:
  def state():return json.loads(page.locator('#demo-root').get_attribute('data-state'))
  def go(work,p=.4,explore=False):
   page.goto(base+'#work/'+work+('/explore' if explore else '/at/'+str(p)),wait_until='networkidle');page.wait_for_selector('#demo-root[data-state]');page.wait_for_function('''target=>{const r=document.querySelector('#demo-root');return r&&(target.explore?r.dataset.mode==='explore':r.dataset.mode==='guide'&&Math.abs(Number(r.dataset.progress)-target.p)<.002)}''',arg={'p':p,'explore':explore})
  def setparam(k,v):page.locator(f'[data-parameter="{k}"]').evaluate('(el,v)=>{el.value=v;el.dispatchEvent(new Event("input",{bubbles:true}));}',v);page.wait_for_timeout(150)
  def at(p):
   a=json.loads(page.locator('#demo-root').get_attribute('data-anchors'));u=p*(len(a)-1);i=int(u);j=min(i+1,len(a)-1);page.evaluate('(y)=>scrollTo({top:y,behavior:"instant"})',a[i]+(a[j]-a[i])*(u-i));page.wait_for_function('''p=>Math.abs(Number(document.querySelector('#demo-root')?.dataset.progress)-p)<.002''',arg=p)
  go('gain-graphs',.6);check('operator is revealed before the spectrum',json.loads(page.locator('#demo-root').get_attribute('data-narrative'))['reveal']['spectrum']==0)
  check('authorship is visible before the narrative',page.locator('.work-byline').inner_text()!='')
  # Exact conceptual position survives desktop -> mobile -> desktop layout changes.
  at(.371);progress=float(page.locator('#demo-root').get_attribute('data-progress'));check('the exact requested pre-resize state was rendered',abs(progress-.371)<.002)
  for size in [{'width':390,'height':844},{'width':1280,'height':900},{'width':320,'height':740}]:
   page.set_viewport_size(size);page.wait_for_timeout(300);check('resize retains reader progress '+str(size),abs(float(page.locator('#demo-root').get_attribute('data-progress'))-progress)<.002)
  page.set_viewport_size({'width':1440,'height':1000});go('gain-graphs',explore=True);page.wait_for_function('document.querySelector("#demo-root").dataset.mode==="explore"')
  setparam('angle',110);page.locator('[data-select="edge"]').select_option('2');setparam('angle',-70);s=state();check('editing a second edge preserves the first',s['angles'][1]==110 and s['angles'][2]==-70)
  page.locator('[data-select="cycle"]').select_option('1');page.locator('[data-select="eigenmode"]').focus();page.locator('[data-select="eigenmode"]').select_option('0');page.wait_for_timeout(220)
  check('selector focus survives the live control update',page.locator('[data-select="eigenmode"]').evaluate('el=>el===document.activeElement'))
  mode_json=page.locator('.n-scene-overlay').get_attribute('data-eigenmode')
  graphics=page.locator('.world-canvas').count()>0
  if graphics:
   mode=json.loads(mode_json);check('computed eigenmode satisfies the live operator',mode['residual']<1e-9);check('mode view leaves graph state unchanged',state()==s)
   page.locator('.n-stage').screenshot(path=str(out/'gain-eigenmode.png'))
  else:check('unavailable graphics is explicitly disclosed',page.locator('.n-graphics-fallback').is_visible())
  before=state();page.reload(wait_until='networkidle');page.wait_for_function('document.querySelector("#demo-root")?.dataset.mode==="explore"');check('explorer reload preserves inputs and reopens explorer',state()==before)
  page.goto(base+'#work/rank-feasibility/explore',wait_until='networkidle');page.wait_for_selector('#demo-root[data-state]');page.go_back(wait_until='networkidle');page.wait_for_function('document.querySelector("#demo-root")?.dataset.mode==="explore"');check('browser Back restores the modified graph',state()==before)
  page.locator('[data-explore="repair"]').click();page.wait_for_timeout(160);check('minimum repair resolves the multi-edge example',state()['inconsistent']==0 and state()['eigenvalues'][0]<1e-8)
  go('rank-feasibility',explore=True);page.locator('[data-explore="reset"]').click();page.locator('[data-rank="2"]').click();page.wait_for_timeout(100);check('rank-two strict problem remains infeasible',not state()['feasible']);setparam('tolerance',1.1);s=state();check('relaxing real constraints creates a computed planar repair',s['feasible'] and abs(s['repair'][2])<1e-9 and abs(s['repair'][0]-.3)<1e-8)
  if graphics:
   shown=json.loads(page.locator('.n-scene-overlay').get_attribute('data-repair'));check('rendered repair equals solver output',shown==s['repair']);page.locator('.n-stage').screenshot(path=str(out/'rank-relaxed-plane.png'))
  go('casepath',.2);check('initial reviewed records actually permit a decision',state()['nodes']['gate']['value']);at(.6);check('new conflict revokes that permission',not state()['nodes']['gate']['value'] and 'HOLD' in page.locator('[data-hold]').inner_text());v=state()['nodes']['invoice']['version'];at(1);check('review replays the date but not the invoice',state()['nodes']['gate']['value'] and state()['nodes']['invoice']['version']==v)
  page.locator('.n-source-link').click();check('the assertion citation focuses its actual source span',page.locator('.n-original mark').evaluate('el=>el===document.activeElement'))
  for size in [(390,844),(320,740),(320,568)]:
   page.set_viewport_size({'width':size[0],'height':size[1]});go('casepath',0)
   for progress in [0,.2,.4,.6,.8,1]:
    at(progress)
    layout=page.evaluate('''()=>{const el=s=>document.querySelector(s),stage=el('.n-stage').getBoundingClientRect(),host=el('.n-case-canvas').getBoundingClientRect(),source=el('.n-original').getBoundingClientRect(),assertion=el('.n-assertion').getBoundingClientRect(),packet=el('.n-case-provenance');return {portion:stage.height/innerHeight,sourceContained:source.bottom<=assertion.top+1,packetContained:packet.hidden||packet.getBoundingClientRect().bottom<=host.bottom-2,font:parseFloat(getComputedStyle(el('.n-original p')).fontSize),overflow:document.documentElement.scrollWidth>innerWidth};}''')
    check(f'{size} beat {progress}: readable sources stay separate and leave room for the argument',layout['portion']<=.555 and layout['sourceContained'] and layout['packetContained'] and layout['font']>=12 and not layout['overflow'])
   page.screenshot(path=str(out/f'case-mobile-{size[0]}x{size[1]}.png'))
  # Each mobile checkpoint must expose the whole explanatory headline below its stage.
  for width,height in [(390,844),(320,568)]:
   page.set_viewport_size({'width':width,'height':height})
   for work in ['gain-graphs','experience-replay','rank-feasibility','tic-lm','casepath','spatial-world']:
    go(work,0);count=page.locator('.n-chapter').count()
    for i in range(count):
     at(i/(count-1))
     reading=page.evaluate('''i=>{const stage=document.querySelector('.n-stage').getBoundingClientRect(),h=document.querySelectorAll('.n-chapter h2')[i].getBoundingClientRect();return{top:h.top,bottom:h.bottom,stageBottom:stage.bottom,height:innerHeight}}''',i)
     check(f'{work} {width}x{height} chapter {i+1}: complete headline and scientific stage are visible together',reading['top']>=reading['stageBottom']+16 and reading['bottom']<=reading['height']-8)
     page.screenshot(path=str(out/f'reading-{work}-chapter-{i+1}-{width}x{height}.png'))
  # Mobile exploration does not capture scrolling until camera manipulation is deliberately enabled.
  go('spatial-world',explore=True)
  if page.locator('[data-touch-view]').count():
   canvas=page.locator('.world-canvas');check('touch defaults to page scrolling',canvas.evaluate('el=>getComputedStyle(el).pointerEvents')=='none');page.locator('[data-touch-view]').click();check('mobile camera is explicitly enabled',canvas.evaluate('el=>getComputedStyle(el).pointerEvents')=='auto');page.locator('[data-touch-view]').click();check('finishing manipulation releases touch scrolling',canvas.evaluate('el=>getComputedStyle(el).pointerEvents')=='none')
  check('no uncaught runtime errors',not errors);check('no failed resources',not failed)
  (out/'acceptance.json').write_text(json.dumps({'origin':base,'engine':args.engine,'checks':checks,'passed':len(checks),'errors':errors,'failed_requests':failed,'graphics':graphics,'not_claimed':['Physical Safari/device GPU or microphone performance','Independent user comprehension or aesthetic evaluation']},indent=2));browser.close()
 except Exception as error:
  try:
   (out/'failure.json').write_text(json.dumps({'error':str(error),'url':page.url,'snapshot':page.evaluate('''()=>{const r=document.querySelector('#demo-root');return{width:innerWidth,height:innerHeight,y:scrollY,data:r?{...r.dataset}:null}}'''),'errors':errors,'failed_requests':failed,'reading_trace':page.evaluate('window.__readingTrace')},indent=2))
   page.screenshot(path=str(out/'failure.png'),timeout=5000)
  except Exception as capture_error:
   print('Failure capture:',str(capture_error),flush=True)
  raise
print('PASSED',len(checks),args.engine,flush=True)
