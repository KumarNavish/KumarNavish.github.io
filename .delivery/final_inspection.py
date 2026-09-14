from pathlib import Path
import hashlib,json,subprocess
r=Path.cwd();p=r/'modules/narrative/director.mjs';s=p.read_text()
old="  const pendingScroll=before.length&&!viewportChanged&&Math.abs(scrollY-lastScrollY)>.5;"
new="""  // Shrinking responsive content can clamp a previously valid position to
  // the new document bottom. That is layout, not an instruction to rewind.
  const maximumScroll=Math.max(0,document.documentElement.scrollHeight-innerHeight);
  const clampedByLayout=lastScrollY>maximumScroll+1&&Math.abs(scrollY-maximumScroll)<=1;
  const pendingScroll=before.length&&!viewportChanged&&!clampedByLayout&&Math.abs(scrollY-lastScrollY)>.5;"""
assert old in s;p.write_text(s.replace(old,new))
p=r/'scripts/referent_checks.py';s=p.read_text();old=' finally:b.close()';new=''' except Exception as error:
  (out/'failure.json').write_text(json.dumps({'error':str(error),'checks':checks,'errors':errors,'url':page.url,'state':page.locator('#demo-root').get_attribute('data-state'),'mode':page.locator('#demo-root').get_attribute('data-mode')},indent=2))
  page.screenshot(path=str(out/'failure.png'));raise
 finally:b.close()''';assert old in s;p.write_text(s.replace(old,new))
(r/'scripts/explorer_resize_checks.py').write_bytes((r/'.delivery/explorer_resize_checks.py').read_bytes())
p=r/'.github/workflows/portfolio-qa.yml';s=p.read_text();old='      - name: Verify competing reflow and scroll without trace-induced timing\n';new='      - name: Preserve exploration when responsive layout clamps the document\n        run: python scripts/explorer_resize_checks.py --engine ${{ matrix.engine }} --url https://kumarnavish.github.io/ --out /tmp/portfolio-browser/explorer-reflow\n'+old;assert old in s;p.write_text(s.replace(old,new))
paths=subprocess.check_output(['git','ls-files'],text=True).splitlines()+['scripts/explorer_resize_checks.py']
files={p:hashlib.sha256(Path(p).read_bytes()).hexdigest() for p in paths if not p.startswith('.delivery/') and p!='.github/workflows/closeout-staging.yml'}
assert len(files)==75
assert hashlib.sha256(json.dumps(files,sort_keys=True,separators=(',',':')).encode()).hexdigest()=='d541d212de68eb90b630b32cf168d1dda5e6e4a2f1b8a76395233a019e751fe6'
print('All 75 application files match the exact authored candidate.')
