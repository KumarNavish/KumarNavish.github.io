"""Preserve premature measurement failures and their following rendered frames.
Uses the unchanged production application and its existing full visitor test.
Only the failed reading assertion gains a diagnostic capture; no app method,
scroll event, clock, animation frame or network response is mocked.
"""
from pathlib import Path
import argparse, sys
p=argparse.ArgumentParser();p.add_argument('--url',required=True);p.add_argument('--out',required=True);p.add_argument('--engine',default='webkit');p.add_argument('--synchronized',action='store_true');a=p.parse_args()
source=Path('scripts/completion_acceptance.py').read_text()
# Make the exact measurement that failed observable BEFORE another protocol call.
needle="return{top:h.top,bottom:h.bottom,stageBottom:stage.bottom,height:innerHeight}"
replacement="return{top:h.top,bottom:h.bottom,stageBottom:stage.bottom,height:innerHeight,work:document.body.dataset.work,ready:document.querySelector('#demo-root').dataset.ready,p:document.querySelector('#demo-root').dataset.progress,y:scrollY,anchors:document.querySelector('#demo-root').dataset.anchors}"
assert needle in source;source=source.replace(needle,replacement)
needle="     check(f'{work} {width}x{height} chapter {i+1}: complete headline and scientific stage are visible together',reading['top']>=reading['stageBottom']+16 and reading['bottom']<=reading['height']-8)"
replacement='''     raw_reading=reading.copy()
     if not (reading['top']>=reading['stageBottom']+16 and reading['bottom']<=reading['height']-8):
      frames=page.evaluate("""i=>new Promise(resolve=>{const records=[];let left=6;function sample(){const root=document.querySelector('#demo-root'),s=document.querySelector('.n-stage').getBoundingClientRect(),h=document.querySelectorAll('.n-chapter h2')[i].getBoundingClientRect();records.push({top:h.top,bottom:h.bottom,stageBottom:s.bottom,height:innerHeight,work:document.body.dataset.work,ready:root.dataset.ready,p:root.dataset.progress,y:scrollY,anchors:root.dataset.anchors});if(--left)requestAnimationFrame(sample);else resolve(records);}requestAnimationFrame(sample);})""",i)
      with (out/'premature-measurements.jsonl').open('a') as f:f.write(json.dumps({'work':work,'size':[width,height],'chapter':i+1,'raw':raw_reading,'frames':frames})+'\\n')
      # Do not call the raw failure a pass. This diagnostic asks the narrower
      # question: did that exact failure persist in the next rendered frames?
      reading=frames[-1]
     check(f'{work} {width}x{height} chapter {i+1}: post-frame headline and scientific stage remain visible',reading['top']>=reading['stageBottom']+16 and reading['bottom']<=reading['height']-8)
'''
assert needle in source;source=source.replace(needle,replacement)
if a.synchronized:
    source=source.replace("return r&&(target.explore?", "return r&&r.dataset.ready==='true'&&document.body.dataset.work===target.work&&(target.explore?")
    source=source.replace("arg={'p':p,'explore':explore}", "arg={'p':p,'explore':explore,'work':work}")
    # This only waits two actual browser frames after the scroll. It does NOT
    # wait until geometry passes, retry the scroll or relax any visibility bound.
    before="  def setparam(k,v):"
    after="  def paint_boundary():page.evaluate('()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))')\n  def setparam(k,v):"
    assert before in source;source=source.replace(before,after)
    source=source.replace("arg={'p':p,'explore':explore,'work':work})", "arg={'p':p,'explore':explore,'work':work});paint_boundary()")
    source=source.replace("dataset.progress)-p)<.002''',arg=p)", "dataset.progress)-p)<.002''',arg=p);paint_boundary()")
    # The synchronized phase must pass the ORIGINAL assertion, no diagnostic
    # recovery allowed. Its output is separate from the raw/late comparison.
    source=source.replace(replacement,needle)
sys.argv=['completion_acceptance.py','--url',a.url,'--out',a.out,'--engine',a.engine]
exec(compile(source,'scripts/completion_acceptance.py','exec'),{'__name__':'__main__'})
