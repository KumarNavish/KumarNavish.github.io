from pathlib import Path
import subprocess,hashlib,json
r=Path.cwd();p=r/'modules/narrative/graph-scenes.mjs';s=p.read_text()
s=s.replace("const pts=[[-2.5,.9,.8],[-1.3,3,-.4],[1.1,3.25,-.45],[2.55,1,.4],[0,.45,2]],names='ABCDE';", "export const gainNodePositions=[[-2.5,.9,.8],[-1.3,3,-.4],[1.1,3.25,-.45],[2.55,1,.4],[0,.45,2]];\nconst pts=gainNodePositions,names='ABCDE';")
mode='''${f.inspection?`<div class="n-mode-reading">${metric('Mode '+(f.inspection.index+1)+' · energy',fmt(f.inspection.eigenvalue))}<span class="n-small">‖Lv − λv‖ = ${f.inspection.residual.toExponential(1)}<br>Arrow length: amplitude · direction: phase</span></div>`:''}'''
assert s.count(mode)==1;s=s.replace(mode,'')
end="${s.eigenvalues.map((v,i)=>`<div><i style=\"height:${2+v*37}px\"></i><small>${fmt(v)}</small></div>`).join('')}</div>`);"
assert end in s;s=s.replace(end,end[:-3]+mode+'`);')
s=s.replace('inspector.style.opacity=r.operator;', 'inspector.dataset.inspecting=String(!!f.inspection);inspector.style.opacity=r.operator;')
s=s.replace('certificate.hidden=r.certificate<.01;', 'certificate.hidden=r.certificate<.01||!!f.inspection;');p.write_text(s)
p=r/'modules/narrative/chapters.mjs';s=p.read_text();old='[.8,1.6,.4],[.8,1.6,.4],[0,1.7,.2]]},';assert old in s;p.write_text(s.replace(old,'[.8,1.6,.4],[.8,1.6,.4],[.8,1.4,.4]]},',1))
p=r/'narrative.css';p.write_text(p.read_text()+'''
/* Mode inspection focuses on the actual arrows, not the repair panel.
   Keep exact numbers beside the operator on desktop; use a shallow footer
   on phones rather than placing a matrix on top of the five-node geometry. */
.n-operator .n-mode-reading{margin-top:12px;padding-top:10px}
.n-operator .n-mode-reading>.n-small{margin-top:6px}
@media(max-width:780px){
 .n-operator[data-inspecting="true"]{top:auto;bottom:9px;left:9px;right:9px;width:auto;padding:7px 10px}
 .n-operator[data-inspecting="true"]>.n-small,.n-operator[data-inspecting="true"]>.n-matrix,.n-operator[data-inspecting="true"]>.n-spectrum{display:none}
 .n-operator[data-inspecting="true"] .n-mode-reading{margin:0;padding:0;border:0;display:flex;align-items:center;gap:12px}
 .n-operator[data-inspecting="true"] .n-metric{flex:0 0 76px}
 .n-operator[data-inspecting="true"] .n-metric>span{font-size:9px}
 .n-operator[data-inspecting="true"] .n-metric>strong{font-size:16px;margin-top:2px}
 .n-operator[data-inspecting="true"] .n-mode-reading>.n-small{font-size:9px;line-height:1.35;margin:0;flex:1}
}
''')
for p in r.rglob('*'):
 if p.is_file() and p.suffix in ['.mjs','.py','.md','.html'] and not any(x in p.parts for x in ['vendor','.delivery','.git']):
  s=p.read_text()
  if 'scroll-4.2.1' in s:p.write_text(s.replace('scroll-4.2.1','scroll-4.2.2'))
p=r/'package.json';p.write_text(p.read_text().replace('"4.2.1"','"4.2.2"'))
p=r/'.github/workflows/portfolio-qa.yml';s=p.read_text();old='      - name: Verify competing reflow and scroll without trace-induced timing\n';new='      - name: Keep every inspected node and arrow visible\n        run: python scripts/referent_checks.py --engine ${{ matrix.engine }} --url https://kumarnavish.github.io/ --out /tmp/portfolio-browser/referents\n'+old;assert old in s;p.write_text(s.replace(old,new))
subprocess.run(['npm','run','build'],check=True)
paths=subprocess.check_output(['git','ls-files'],text=True).splitlines()
data={p:hashlib.sha256(Path(p).read_bytes()).hexdigest() for p in paths if not p.startswith('.delivery/') and p!='.github/workflows/closeout-staging.yml'}
assert len(data)==74
assert hashlib.sha256(json.dumps(data,sort_keys=True,separators=(',',':')).encode()).hexdigest()=='fb652bc5c97b7c266737455665665b2dc9d4649fb16f0cc88e2fe0a86311da1e'
print('Exact 74-file authored candidate verified.')
