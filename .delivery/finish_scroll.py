from pathlib import Path
import hashlib, subprocess
r=Path(__file__).resolve().parents[1]
def replace(path,old,new):
 p=r/path;s=p.read_text();assert old in s,(path,old[:80]);p.write_text(s.replace(old,new))
p=r/'narrative.css'
p.write_text(p.read_text()+'''
/* Final reading pass: withheld elements must not leak through flex/grid display rules. */
.scroll-narrative [hidden],.journey-field [hidden]{display:none!important}
/* The mobile claim remains an actual readable document, not a shrunken desktop screenshot. */
@media(max-width:780px){
 .n-stage:has(.n-case-canvas){height:54svh;max-height:500px;min-height:395px}
 .n-case-workspace{gap:8px}
 .n-original{padding:12px}
 .n-original>header{font-size:10px}
 .n-original header small{font-size:8px;line-height:1.35}
 .n-original h3{font-size:14px;line-height:1.3;margin:12px 0 10px}
 .n-original p{font-size:12px;line-height:1.6;margin:10px 0}
 .n-case-side small{font-size:8px;line-height:1.35}
 .n-case-side strong{font-size:13px;line-height:1.3;margin:5px 0}
 .n-case-side>article{padding:8px}
 .n-case-top>b{font-size:9px;line-height:1.45}
 .n-assertion{font-size:10px;padding:8px 10px}
 .n-assertion strong{font-size:10px}
 .n-case-checks>div{padding:7px 6px}
 .n-case-checks span{font-size:9px;line-height:1.35}
 .n-case-checks b{font-size:9px;line-height:1.4}
 .n-case-checks small{font-size:8px;line-height:1.45}
 .n-case-provenance p{font-size:8px;line-height:1.5}
 .n-case-provenance span{font-size:10px}
}
''')
replace('modules/narrative/geometry-scenes.mjs',"memories,dot,add,sub,scale}","memories,dot,add,sub,scale,replayState}")
replace('modules/narrative/geometry-scenes.mjs',"residual=segment(g,'#b75844',.026,true),wanted=", "residual=segment(g,'#b75844',.026,true),unapplied=segment(g,'#328971',.020,true),wanted=")
replace('modules/narrative/geometry-scenes.mjs',"residual.set(P(s.actual),P(s.joint));point(actual,P(s.actual));", "const full=replayState(s.selected,s.learning,1);residual.set(P(full.actual),P(s.joint));unapplied.set(P(s.actual),P(full.actual));point(actual,P(s.actual));")
replace('modules/narrative/geometry-scenes.mjs',"alpha(residual.g,r.residual);alpha(candidateGroup", "alpha(residual.g,r.residual);alpha(unapplied.g,r.residual);alpha(candidateGroup")
replace('modules/narrative/geometry-scenes.mjs',"[metric('Old-task loss',fmt(s.oldLoss)),metric('New-task loss',fmt(s.newLoss)),metric('Missing direction',fmt(s.unavailable),'danger')]", "[metric('Old-task loss',fmt(s.oldLoss)),metric('New-task loss',fmt(s.newLoss)),...(r.residual>.5?[metric('Unavailable correction',fmt(s.unavailable),'danger'),...(s.notApplied>.001?[metric('Available, not applied',fmt(s.notApplied))]:[])]:[])]")
replace('modules/narrative/geometry-scenes.mjs',"if(r.residual>.5&&s.missing>.01)a.push({text:`Residual ${fmt(s.missing)} · cannot be expressed`,pos:add(P(scale(add(s.actual,s.joint),.5)),[0,.5,.1]),tone:'red'});", "if(r.residual>.5&&s.unavailable>.01)a.push({text:`Unavailable ${fmt(s.unavailable)} · outside memory span`,pos:add(P(scale(add(full.actual,s.joint),.5)),[0,.5,.1]),tone:'red'});else if(r.residual>.5&&s.notApplied>.01)a.push({text:`Available ${fmt(s.notApplied)} · not yet applied`,pos:add(P(scale(add(s.actual,full.actual),.5)),[0,.5,.1]),tone:'green'});")
replace('modules/narrative/context-scenes.mjs',".10+meanAt(i)*.37", ".10+(s.stable?0:meanAt(i))*.37")
replace('modules/narrative/context-scenes.mjs',"2.0+meanAt(s.month)*.37", "2.0+(s.stable?0:meanAt(s.month))*.37")
replace('modules/narrative/context-scenes.mjs',"const a=[{text:`Present · period ${s.month}`", "overlay.dataset.windowMeans=JSON.stringify(windows.map((w,i)=>s.stable?0:meanAt(i)));const a=[{text:`Present · period ${s.month}`")
for p in r.rglob('*'):
 if p.is_file() and p.suffix in ['.mjs','.py','.md','.css','.html'] and not any(x in p.parts for x in ['.delivery','.git']):
  s=p.read_text();p.write_text(s.replace('scroll-4','scroll-4.1'))
subprocess.run(['npm','run','build'],cwd=r,check=True)
expected={
'narrative.css':'54de87d67cf6e310d4f70d3df6780455a08191dc2f78595ac14bd3d424d338ac',
'index.html':'65fb2d06546225374952c237dbc5374efcc1630aad4433de46bbe2c06e64f974',
'modules/render.mjs':'3de07375d23031bb7db977be2077a9549bc28917e338fb1dddc827ba633693d6',
'modules/app.mjs':'e31aa636b0a1a72dbca581400cdad3b9891bd72cc85ed09c6b75d25a545da436',
'scripts/scroll_acceptance.py':'9db05d80c16498ddc7f79e603f64000beb4bc8ac77cf6a9a0401accb0257791d',
'scripts/final_scroll_checks.py':'7d062adceee92529ebbf68b2d6aa900760754f185eca0049532afa4f9b869f8c',
'scripts/build.mjs':'9bc6b0f26998a55d4e81c290ddf4a984eff099422aa07e989dbe3f1b895e2e37',
'modules/narrative/geometry-scenes.mjs':'1434c224012c504bc5a8adbc2c4eaa3c05e20e1e50a552277f5a3076440eb231',
'modules/narrative/scene-kit.mjs':'3406cc6f1ca7fd606e19e004aec4ea4855e464d0f60932819421659af54127fb',
'modules/narrative/context-scenes.mjs':'f91f4027b4d4189e507c7c0047d5126087d3ca2766459d966e5b683141edd865'}
for path,digest in expected.items():
 actual=hashlib.sha256((r/path).read_bytes()).hexdigest()
 if actual!=digest:raise RuntimeError(f'Authored source mismatch: {path}: {actual}')
print('EXACT_FINAL_SOURCE',len(expected),'changed files')
