from pathlib import Path
import hashlib
p=Path('scripts/completion_acceptance.py')
s=p.read_text()
assert hashlib.sha256(s.encode()).hexdigest()=='72051d1622e2368fe2b5fae6029ed6fa1c2ce70d83da9d132fb1690fab9c02f8'
changes=[
("page.wait_for_selector('#demo-root[data-state]');page.wait_for_timeout(120)","page.wait_for_selector('#demo-root[data-state]');page.wait_for_function('''target=>{const r=document.querySelector('#demo-root');return r&&(target.explore?r.dataset.mode==='explore':r.dataset.mode==='guide'&&Math.abs(Number(r.dataset.progress)-target.p)<.002)}''',arg={'p':p,'explore':explore})"),
("a[i]+(a[j]-a[i])*(u-i));page.wait_for_timeout(180)","a[i]+(a[j]-a[i])*(u-i));page.wait_for_function('''p=>Math.abs(Number(document.querySelector('#demo-root')?.dataset.progress)-p)<.002''',arg=p)"),
("at(.371);progress=float(page.locator('#demo-root').get_attribute('data-progress'))","at(.371);progress=float(page.locator('#demo-root').get_attribute('data-progress'));check('the exact requested pre-resize state was rendered',abs(progress-.371)<.002)")]
for old,new in changes:
 assert s.count(old)==1,old
 s=s.replace(old,new)
assert hashlib.sha256(s.encode()).hexdigest()=='fb5d543571e06d4e771247879d76fd8a4d61139b5738d07ba2e8edaefe78f01e'
p.write_text(s)
print('RENDERED_STATE_SYNCHRONIZATION_VERIFIED')
