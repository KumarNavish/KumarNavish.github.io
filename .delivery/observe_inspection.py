"""Observe failed explorer entry and continue via the visible Explore control for geometry evidence.
A recovered diagnostic remains a failed check; this runner cannot seal or publish.
"""
from pathlib import Path
import subprocess,sys
s=Path('scripts/referent_checks.py').read_text()
old="   page.locator('[data-explore=\"reset\"]').click()"
new='''   try:
    page.locator('[data-explore="reset"]').click(timeout=3000)
   except Exception as error:
    snapshot=page.evaluate("""()=>{const r=document.querySelector('#demo-root'),e=document.querySelector('.n-explorer'),b=document.querySelector('[data-explore="reset"]');return {url:location.href,y:scrollY,width:innerWidth,height:innerHeight,dataset:{...r.dataset},explorer:{inert:e.inert,display:getComputedStyle(e).display,visibility:getComputedStyle(e).visibility,className:e.className},reset:{display:getComputedStyle(b).display,visibility:getComputedStyle(b).visibility,rect:b.getBoundingClientRect().toJSON()},heading:document.querySelector('.n-explore-chapter h2').getBoundingClientRect().toJSON()};}""")
    checks.append({'name':'same-route resized explorer entry','size':[width,height],'passed':False,'observed':snapshot,'error':str(error)})
    (out/f'entry-failure-{width}.json').write_text(json.dumps(snapshot,indent=2));page.screenshot(path=str(out/f'entry-failure-{width}.png'))
    page.locator('[data-skip]').click();page.wait_for_function("document.querySelector('#demo-root').dataset.mode==='explore'")
    page.locator('[data-explore="reset"]').click()
'''
assert old in s;s=s.replace(old,new)
s=s.replace('  assert not errors\n  assert all',"  (out/'diagnostic.json').write_text(json.dumps({'checks':checks,'errors':errors},indent=2))\n  assert not errors\n  assert all")
s=s.replace(' finally:b.close()', ''' except Exception as error:
  (out/'exception.json').write_text(json.dumps({'error':str(error),'checks':checks,'errors':errors,'url':page.url},indent=2))
  page.screenshot(path=str(out/'exception.png'))
  raise
 finally:b.close()''')
p=Path('/tmp/inspection_observed.py');p.write_text(s)
subprocess.run([sys.executable,str(p),*sys.argv[1:]],check=True)
