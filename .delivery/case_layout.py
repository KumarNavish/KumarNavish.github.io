from pathlib import Path
import hashlib
r=Path(__file__).resolve().parents[1]
p=r/'narrative.css'
assert hashlib.sha256(p.read_bytes()).hexdigest()=='54de87d67cf6e310d4f70d3df6780455a08191dc2f78595ac14bd3d424d338ac'
p.write_text(p.read_text()+'\n/* Keep source cards, assertion, checks and provenance in disjoint reading bands. */\n@media(max-width:780px){\n.scroll-narrative .n-stage:has(.n-case-canvas){height:64svh;min-height:515px;max-height:620px}\n.scroll-narrative .n-case-records{flex:1 0 auto;min-height:min-content}\n.scroll-narrative .n-case-workspace>div{flex-shrink:0}\n}\n.n-case-side [data-amount]{font:inherit;color:inherit}\n')
p=r/'scripts/final_scroll_checks.py'
s=p.read_text();old=' # Chapter links are first-class inputs to the same deterministic director.';new=" # Inspect every late mobile document chapter for overlap, not just viewport containment.\n for progress in [.2,.4,.6,.8,1]:\n  start('casepath',progress)\n  bands=page.evaluate('''()=>{const root=document.querySelector('.n-case-canvas'),selectors=['.n-case-records','.n-assertion','.n-case-checks','.n-case-provenance'];const rs=selectors.map(s=>document.querySelector(s).getBoundingClientRect());const source=document.querySelector('.n-original').getBoundingClientRect();const report=document.querySelector('.n-later').getBoundingClientRect();return {separated:rs.every((r,i)=>!i||r.top>=rs[i-1].bottom+3),contentFits:source.bottom<=rs[0].bottom+1&&report.bottom<=rs[0].bottom+1,packetFits:rs.at(-1).bottom<=root.getBoundingClientRect().bottom-3};}''')\n  check(f'CasePath at {progress}: document, assertion, checks and provenance never overlap',bands['separated'] and bands['contentFits'])\n  check(f'CasePath at {progress}: provenance stays inside the viewport',bands['packetFits'])\n  if progress in [.6,1]:page.screenshot(path=str(out/f'casepath-mobile-separated-{progress}.png'))\n # Chapter links are first-class inputs to the same deterministic director."
assert old in s;s=s.replace(old,new);p.write_text(s)
assert hashlib.sha256((r/'narrative.css').read_bytes()).hexdigest()=='cd328321acb9d74bc136e0a7766ca74f461b038872c387cc986354b2be4c12fc'
assert hashlib.sha256(p.read_bytes()).hexdigest()=='46f671f690eec4ac524e8aaf927ea151091fbea843416745e11edfbc39e8db9d'
print('MOBILE_SOURCE_MATCH')
