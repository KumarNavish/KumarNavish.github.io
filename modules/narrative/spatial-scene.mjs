import {T,group,box,ball,line,ring,point,alpha,annotation,contentHTML,metric,fmt,V,clear} from './scene-kit.mjs';
import {architecture,landscape,makeObject} from '../worlds/laboratory.mjs';
import {initialScene} from './model.mjs';
import {esc} from '../render.mjs';
export function spatialScene(view,overlay){
 const root=group(view.content),room=group(root),terrain=group(root),items=group(root),anchors=group(root),map=new Map(),anchorMap=new Map(),labels=annotation(view);architecture(room);landscape(terrain);view.scene.fog.near=65;view.scene.fog.far=175;
 const plan=initialScene();
 function addObject(o){if(o.type==='window')return;const g=makeObject({...o,color:null});g.traverse(m=>{if(m.isMesh)m.material.userData.originalColor=m.material.color.getHex();});items.add(g);map.set(o.id,g);const a=ring(anchors,[o.position.x,o.position.y+.025,o.position.z],o.type==='bench'?1.7:.3,'#68a99a');anchorMap.set(o.id,a);return g;}
 plan.objects.forEach(addObject);
 const pathGeo=new T.BufferGeometry();pathGeo.setAttribute('position',new T.BufferAttribute(new Float32Array(3000),3));const path=new T.Line(pathGeo,new T.LineBasicMaterial({color:'#3f9c86'}));root.add(path);let lastPath='';
 const sentence=document.createElement('div');sentence.className='n-sentence';sentence.innerHTML='<span class="n-small">Typed instruction · supported local grammar</span><p>Create a <mark data-span="place">mountain laboratory</mark> at <mark data-span="lighting">sunset</mark>.</p><small data-semantic-label>Place → context → lighting</small>';overlay.append(sentence);
 const structure=document.createElement('div');structure.className='n-structure';structure.innerHTML='<span class="n-small">Structured entities · stable identity</span><div><b>microscope-1</b><span>ON</span><b>bench-1</b></div><div><b>arm-1</b><span>ON</span><b>bench-1</b></div><div><b>microscope-1</b><span>BESIDE</span><b>arm-1</b></div>';overlay.append(structure);
 const diff=document.createElement('div');diff.className='n-spatial-diff';overlay.append(diff);
 return{render(f){const s=f.science,r=f.reveal,base=s.created?s:f.visual.plan||plan;
  for(const o of base.objects){let g=map.get(o.id)||addObject(o);if(!g)continue;g.userData.position={...o.position};g.userData.height=o.position.y;g.position.set(o.position.x,o.position.y,o.position.z);g.rotation.y=o.yaw*Math.PI/180;g.traverse(m=>{if(m.isMesh&&m.material.userData.originalColor!==undefined)m.material.color.set(o.color||m.material.userData.originalColor);});const a=anchorMap.get(o.id);if(a)a.position.set(o.position.x,o.position.y+.025,o.position.z);}
  // Main entities persist across reverse scrolling. Added sandbox objects are explicitly removable.
  for(const[id,g]of map){const present=base.objects.some(o=>o.id===id);g.visible=present;if(anchorMap.get(id))anchorMap.get(id).visible=present;}
  alpha(room,r.world);alpha(items,r.world);alpha(terrain,r.world);alpha(anchors,r.anchors);if(r.world>0&&r.world<1){room.scale.y=Math.max(.001,r.world);items.scale.y=Math.max(.001,r.world);}else{room.scale.y=items.scale.y=1;}
  const lighting=s.lighting||'sunset';view.key.color.set(lighting==='night'?'#b2d5f1':lighting==='daylight'?'#fff5de':'#ffd39d');view.key.intensity=lighting==='night'?.65:2.5;view.hemi.intensity=lighting==='night'?.6:.95;
  const pathKey=JSON.stringify(s.path||[]);if(lastPath!==pathKey){lastPath=pathKey;(s.path||[]).forEach((p,i)=>pathGeo.attributes.position.setXYZ(i,p.x,.025,p.z));pathGeo.attributes.position.needsUpdate=true;pathGeo.setDrawRange(0,(s.path||[]).length);}
  path.visible=r.path>.01&&(s.path||[]).length>1;
  sentence.style.opacity=r.sentence;sentence.hidden=r.sentence<.01;sentence.classList.toggle('parsed',r.semantics>.5);sentence.querySelector('[data-semantic-label]').style.opacity=r.semantics;
  structure.style.opacity=r.structure;structure.hidden=r.structure<.01;
  diff.hidden=!s.created;contentHTML(diff,`<span class="n-small">${r.edit>.5?'The same microscope, one revised placement':'Persistent scene graph'}</span>${metric('Objects',s.objects.length)}${metric('Revision',s.revision)}${s.path?.length>1?metric('Planned grid steps',s.path.length-1):r.edit>.5?metric('Old route','Invalidated'):''}`);
  const a=[];if(r.anchors>.5)base.objects.filter(o=>['microscope','arm'].includes(o.type)).forEach(o=>a.push({text:`${o.id} · (${fmt(o.position.x,1)}, ${o.position.y}, ${fmt(o.position.z,1)})`,pos:[o.position.x,o.position.y+.42,o.position.z],tone:'green'}));
  else if(r.world>.95){const micro=s.objects.find(o=>o.id==='microscope-1'),agent=s.objects.find(o=>o.id==='agent-1');if(r.path>.4&&agent)a.push({text:'agent-1 · collision-checked route',pos:[agent.position.x,.75,agent.position.z],tone:'green'});else if(micro)a.push({text:r.edit>.3?'microscope-1 · same identity':'Microscope · microscope-1',pos:[micro.position.x,micro.position.y+1.12,micro.position.z],tone:'green'});}
  labels(a);view.setPickables([...map.values()].filter(g=>g.userData.draggable&&g.visible));
  overlay.dataset.objectIdentities=JSON.stringify(Object.fromEntries([...map].filter(([id,g])=>g.visible).map(([id,g])=>[id,g.uuid])));
 },getObject(id){return map.get(id);},dispose(){sentence.remove();structure.remove();diff.remove();}};
}
