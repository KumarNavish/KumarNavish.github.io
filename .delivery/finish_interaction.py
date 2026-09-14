from pathlib import Path
import hashlib
p=Path('modules/worlds/stage.mjs');s=p.read_text()
assert hashlib.sha256(p.read_bytes()).hexdigest()=='ee7e57c79da58be3892797db3af6f70c208da5749b537d90ebb112e2940ff639'
s="import {placeAnnotation} from './label-layout.mjs';\n"+s
start=s.index(' function placeLabels(){');end=s.index(' function loop(now)',start)
s=s[:start]+''' function placeLabels(){
  const w=host.clientWidth,h=host.clientHeight,bounds=host.getBoundingClientRect(),used=[];
  // Labels live below sibling overlays in the DOM. Reserve the overlays' actual
  // visible rectangles before placing labels, including mobile-wrapped panels.
  const overlay=host.closest('.n-render-host')?.querySelector('.n-scene-overlay');
  for(const el of [...(overlay?.children||[]),host.querySelector('.camera-tools')].filter(Boolean)){
   const style=getComputedStyle(el),r=el.getBoundingClientRect();
   if(el.hidden||style.display==='none'||style.visibility==='hidden'||Number(style.opacity)<.08||r.width<1||r.height<1)continue;
   used.push({left:r.left-bounds.left,top:r.top-bounds.top,right:r.right-bounds.left,bottom:r.bottom-bounds.top});
  }
  for(const l of labelItems){const p=V(typeof l.pos==='function'?l.pos():l.pos).project(cam),x=(p.x*.5+.5)*w,y=(-p.y*.5+.5)*h;
   const off=p.z>1||p.z< -1||Math.abs(p.x)>1.05||Math.abs(p.y)>1.04;l.el.hidden=off;l.leader.hidden=true;if(off)continue;
   const r=placeAnnotation({width:w,height:h,labelWidth:l.el.offsetWidth||100,labelHeight:l.el.offsetHeight||24,x,y,dx:l.dx||0,dy:l.dy||0,obstacles:used});
   l.el.dataset.occluded=String(!r);if(!r){l.el.hidden=true;continue;}
   used.push(r);l.el.style.left=(r.left+r.right)/2+'px';l.el.style.top=r.bottom+'px';
   const ex=(r.left+r.right)/2,ey=r.bottom,dist=Math.hypot(ex-x,ey-y);if(dist>15){l.leader.hidden=false;l.leader.style.left=x+'px';l.leader.style.top=y+'px';l.leader.style.width=dist+'px';l.leader.style.transform=`rotate(${Math.atan2(ey-y,ex-x)}rad)`;}
  }
 }
''' + s[end:]
p.write_text(s)
assert hashlib.sha256(p.read_bytes()).hexdigest()=='f1352813613b7b8a58d9be2eed98d3c5a9de5bb13990b5553fb260bbabb30800'
p=Path('narrative.css');s=p.read_text();assert hashlib.sha256(p.read_bytes()).hexdigest()=='214c4f465d9e2de8d2ce4323c3166bc5262941c36d098a8f603d756eaeb5634e'
p.write_text(s+'''/* The director owns reader-position preservation. Native scroll anchoring must
   not apply a second correction after the same DOM/layout update. */
body:has(.scroll-narrative){overflow-anchor:none}
''')
assert hashlib.sha256(p.read_bytes()).hexdigest()=='c9a38049973fde8226a8ace27d6bac2dd51926bbccd2ca3689b0f177207e0631'
print('COMPOSITED_ANNOTATIONS_AND_SCROLL_OWNERSHIP_VERIFIED')
