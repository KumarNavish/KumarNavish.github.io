from pathlib import Path
import argparse,json
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser();p.add_argument('--url',required=True);p.add_argument('--out',required=True);p.add_argument('--engine',required=True);a=p.parse_args();out=Path(a.out);out.mkdir(parents=True,exist_ok=True)
probe="""(()=>{window.__events=[];const push=(kind,detail)=>{const r=document.querySelector('#demo-root');__events.push({time:performance.now(),kind,detail,y:scrollY,width:innerWidth,height:innerHeight,hash:location.hash,mode:r?.dataset.mode,ready:r?.dataset.ready,end:r?.dataset.exploreAt});};for(const name of ['resize','scroll','hashchange','popstate','pageshow'])addEventListener(name,e=>push(name,e.type));const scroll=window.scrollTo;window.scrollTo=function(...args){push('scrollTo',args);return scroll.apply(this,args);};const replace=history.replaceState;history.replaceState=function(...args){push('replaceState',args[2]);return replace.apply(this,args);};})()"""
with sync_playwright() as pw:
 browser=getattr(pw,a.engine).launch(headless=True)
 for variant in ['resize-only','resize-and-same-route','fresh-navigation']:
  context=browser.new_context(viewport={'width':1440,'height':1000},reduced_motion='reduce');context.add_init_script(probe);page=context.new_page();states=[]
  def snapshot(label):states.append(page.evaluate('''label=>{const r=document.querySelector('#demo-root');return{label,hash:location.hash,y:scrollY,width:innerWidth,height:innerHeight,mode:r?.dataset.mode,progress:r?.dataset.progress,end:r?.dataset.exploreAt,ready:r?.dataset.ready,events:window.__events};}''',label))
  try:
   page.goto(a.url+'/#work/gain-graphs/explore',wait_until='networkidle');page.wait_for_function("document.querySelector('#demo-root')?.dataset.ready==='true'");page.locator('[data-explore="reset"]').click();page.locator('[data-parameter="angle"]').evaluate('e=>{e.value=110;e.dispatchEvent(new Event("input",{bubbles:true}));}')
   page.locator('[data-select="eigenmode"]').select_option('4');page.wait_for_timeout(100);page.locator('[data-select="eigenmode"]').select_option('-1');page.wait_for_timeout(100);snapshot('desktop-before-resize')
   if variant=='fresh-navigation':page.goto('about:blank')
   page.set_viewport_size({'width':390,'height':844})
   if variant!='resize-only':page.goto(a.url+'/#work/gain-graphs/explore',wait_until='networkidle')
   page.wait_for_timeout(250);snapshot('after-resize');page.screenshot(path=str(out/(variant+'.png')))
  except Exception as error:states.append({'error':str(error)});snapshot('error')
  (out/(variant+'.json')).write_text(json.dumps(states,indent=2));context.close()
 browser.close()
print('Observation complete; no application files changed.')
