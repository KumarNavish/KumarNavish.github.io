from pathlib import Path
import hashlib
p=Path('modules/worlds/stage.mjs');s=p.read_text();assert hashlib.sha256(p.read_bytes()).hexdigest()=='f1352813613b7b8a58d9be2eed98d3c5a9de5bb13990b5553fb260bbabb30800'
old="""   const r=placeAnnotation({width:w,height:h,labelWidth:l.el.offsetWidth||100,labelHeight:l.el.offsetHeight||24,x,y,dx:l.dx||0,dy:l.dy||0,obstacles:used});
   l.el.dataset.occluded=String(!r);if(!r){l.el.hidden=true;continue;}"""
new="""   // Preserve type size. When a compact viewport leaves a narrow reading lane,
   // reflow the label into that lane rather than covering a panel or deleting it.
   l.el.style.maxWidth='';l.el.dataset.wrapped='false';
   const place=()=>placeAnnotation({width:w,height:h,labelWidth:l.el.offsetWidth||100,labelHeight:l.el.offsetHeight||24,x,y,dx:l.dx||0,dy:l.dy||0,obstacles:used});
   let r=place();
   if(!r){const natural=l.el.offsetWidth;for(const fraction of [.82,.66,.52,.43]){l.el.style.maxWidth=Math.max(82,Math.floor(natural*fraction))+'px';r=place();if(r){l.el.dataset.wrapped='true';break;}}}
   l.el.dataset.occluded=String(!r);if(!r){l.el.hidden=true;continue;}"""
assert old in s;s=s.replace(old,new);p.write_text(s);assert hashlib.sha256(p.read_bytes()).hexdigest()=='7824c7ec7ec105ac6491745ef7a2980b61d8e533054f520164d99990d88219c4'
p=Path('modules/narrative/director.mjs');s=p.read_text();assert hashlib.sha256(p.read_bytes()).hexdigest()=='710c23b89d0253544241bec628a7a30abdd25bcc95b949e39fd98ea2d86c6745'
s=s.replace('root.dataset.progress=String(progress);root.dataset.mode=mode;', 'const renderedMode=root.dataset.mode;root.dataset.progress=String(progress);root.dataset.mode=mode;')
s=s.replace("if(mode!==lastMode&&mode==='explore')renderer.setCamera", "if(mode!==renderedMode&&mode==='explore')renderer.setCamera")
s=s.replace('if(lastIndex!==f.index||lastMode!==mode)', 'if(lastIndex!==f.index||renderedMode!==mode)')
p.write_text(s);assert hashlib.sha256(p.read_bytes()).hexdigest()=='b5b96e8e63afe4e3bf53ef9483e8e1444a9ada1767caae7265b4bfc7e254cd70'
p=Path('scripts/annotation_checks.py');s=p.read_text().replace("'passed':not d['collisions']", "'passed':not d['collisions'] and not d['hiddenPrimary']");p.write_text(s)
p=Path('narrative.css');assert hashlib.sha256(p.read_bytes()).hexdigest()=='c9a38049973fde8226a8ace27d6bac2dd51926bbccd2ca3689b0f177207e0631'
p.write_text(p.read_text()+'''
/* On compact screens, the same 64 budget slots become two thin rows.
   The allocation stays visible without covering the temporal field it explains. */
@media(max-width:520px){
 .scroll-narrative .n-render-host .n-budget-cells{grid-template-columns:repeat(32,minmax(0,1fr));gap:1px;margin:5px 0}
 .scroll-narrative .n-render-host .n-budget-cells i{height:4px;aspect-ratio:auto;border-radius:1px}
 .scroll-narrative .n-render-host .n-budget>.n-small{font-size:8px}
 .scroll-narrative .n-render-host .n-budget>strong{font-size:9px}
}
''')
assert hashlib.sha256(p.read_bytes()).hexdigest()=='8f287b5249e38d2aeec6c7b8fd35e75cf634f9d50e4fabe8c723a0323c47aca1'
print('COMPACT_LABEL_REFLOW_RENDERED_HANDOFF_AND_TEMPORAL_FIELD_VERIFIED')
