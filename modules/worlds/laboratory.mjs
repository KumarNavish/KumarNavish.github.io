import {T,mesh,box,ball,rod,line,ring,material} from './stage.mjs';
/** Procedural, inspectable scene assets. No remote models, textures or generated image substitution. */
export function landscape(parent){
 // A continuous distant range: open valley in front, identifiable peaks on the horizon.
 const peaks=[[-38,-60,12,23,24],[-15,-68,18,22,29],[8,-62,15,20,26],[32,-73,19,26,29],[52,-65,13,23,22],[-56,-85,19,29,26]],vertices=[],cols=[],indices=[],nx=96,nz=44;
 for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){
  const x=-100+i/nx*200,z=-14-j/nz*105;let height=0,relative=0;
  for(const [px,pz,h,rx,rz] of peaks){const distance=Math.hypot((x-px)/rx,(z-pz)/rz),shape=Math.pow(Math.max(0,1-distance),1.18),candidate=h*shape;if(candidate>height){height=candidate;relative=shape;}}
  const ridge=height>1?(Math.sin(x*1.7+z*.41)+Math.sin(x*.37-z*.71))*.16:0,y=-4+height+ridge;
  vertices.push(x,y,z);const rock=new T.Color('#62818a'),snow=new T.Color('#e9e8dc'),foothill=new T.Color('#839b87');
  const c=relative>.59?rock.lerp(snow,Math.min(1,(relative-.54)*3.7)):foothill.lerp(rock,Math.min(1,height/7));c.multiplyScalar(.94+.05*Math.sin(x*.4+z*.6));cols.push(c.r,c.g,c.b);
 }
 for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const a=j*(nx+1)+i;indices.push(a,a+1,a+nx+1,a+1,a+nx+2,a+nx+1);}
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geo.setAttribute('color',new T.Float32BufferAttribute(cols,3));geo.setIndex(indices);geo.computeVertexNormals();
 parent.add(new T.Mesh(geo,new T.MeshStandardMaterial({vertexColors:true,roughness:1,side:T.DoubleSide,flatShading:true})));
 box(parent,[0,-4.45,-61],[205,.8,130],'#82968a',{roughness:1});
 ball(parent,[-29,13,-83],1.6,'#f7d59d',{emissive:'#f7d59d',emissiveIntensity:1.1,roughness:1});
}
export function architecture(g){
 box(g,[0,-.18,-.15],[8.6,.35,8.6],'#d2c4ad',{roughness:.45});
 for(let x=-4;x<=4;x+=.48)box(g,[x,.001,-.15],[.012,.003,8.35],'#b9ab96',{roughness:.8});
 box(g,[-3.7,1.7,-4],[1.2,3.4,.22],'#e9e6db',{roughness:.8});box(g,[3.7,1.7,-4],[1.2,3.4,.22],'#e9e6db',{roughness:.8});box(g,[0,.48,-4],[6.25,.96,.22],'#e9e6db');box(g,[0,3.18,-4],[6.25,.43,.22],'#e9e6db');
 box(g,[-4.2,.75,-1.2],[.18,1.5,5.7],'#e1dfd5');box(g,[4.2,.75,-1.2],[.18,1.5,5.7],'#e1dfd5');
 for(let x=-3.1;x<=3.11;x+=1.55)box(g,[x,2.0,-3.88],[.055,2.08,.07],'#546b6d',{metalness:.6});box(g,[0,1.0,-3.86],[6.3,.07,.17],'#586969');box(g,[0,3.03,-3.86],[6.3,.07,.17],'#586969');
 // Glass is only a thin faint plane so the mountain world remains visible through it.
 mesh(g,new T.PlaneGeometry(6.2,2.0),'#d5eced',[0,2.02,-3.92],{transparent:true,opacity:.045,roughness:.08,metalness:.25,side:T.DoubleSide,depthWrite:false});
 for(let i=0;i<5;i++){const x=-2.7+i*1.34;box(g,[x,.43,-3.5],[1.28,.84,.56],'#e1e7e2',{roughness:.42});box(g,[x,.65,-3.20],[.56,.024,.025],'#677c79',{metalness:.8});}box(g,[0,.9,-3.5],[6.65,.065,.66],'#667c79',{metalness:.25,roughness:.25});
 for(const x of[-3.62,3.62]){box(g,[x,2.53,-2.95],[.8,.055,1.6],'#a59274');for(let i=0;i<3;i++){mesh(g,new T.CylinderGeometry(.068,.09,.25,24),'#b6d1c9',[x,2.68,-3.45+i*.42],{transparent:true,opacity:.7,metalness:.08,roughness:.15});mesh(g,new T.CylinderGeometry(.038,.038,.045,16),'#536967',[x,2.83,-3.45+i*.42]);}}
}
export function makeObject(o){const g=new T.Group(),white=o.color||'#e5ebe8',dark='#344a4b',metal='#a4b9b5',accent=o.color||'#3a8982';
 if(o.type==='bench'){box(g,[0,.94,0],[4.3,.14,2.05],'#dfe9e4',{metalness:.22,roughness:.18});box(g,[0,.86,0],[4.15,.06,1.90],dark);for(const x of[-1.8,1.8])for(const z of[-.78,.78]){box(g,[x,.43,z],[.075,.86,.075],metal,{metalness:.8,roughness:.22});box(g,[x,.045,z],[.23,.08,.17],dark);}rod(g,[-1.8,.28,-.78],[1.8,.28,-.78],.04,metal);}
 if(o.type==='microscope'){
  const base=mesh(g,new T.CylinderGeometry(.27,.30,.09,48),white,[0,.06,0]);base.scale.set(1,.99,.78);box(g,[.14,.32,.065],[.12,.52,.16],white);rod(g,[.12,.50,.065],[-.05,.68,.015],.092,white);rod(g,[-.05,.68,.015],[-.17,.84,-.10],.065,dark);rod(g,[-.17,.84,-.10],[-.23,.90,-.16],.072,dark);rod(g,[-.03,.55,-.02],[-.05,.40,-.02],.035,metal);mesh(g,new T.CylinderGeometry(.085,.085,.045,32),dark,[-.05,.48,-.02]);for(const x of[-.07,0,.07])rod(g,[x-.05,.47,-.02],[x-.05,.39,-.02],.018,'#c8b570');box(g,[-.06,.29,-.01],[.29,.028,.24],dark);box(g,[-.05,.31,-.015],[.11,.007,.06],'#b2d2d7',{transparent:true,opacity:.75,roughness:.1});rod(g,[.13,.29,.04],[.28,.29,.04],.063,dark);mesh(g,new T.CylinderGeometry(.075,.075,.04,32),dark,[.29,.29,.04]).rotation.z=Math.PI/2;
 }
 if(o.type==='arm'){
  mesh(g,new T.CylinderGeometry(.27,.29,.12,48),dark,[0,.06,0]);const joints=[[0,.14,0],[0,.49,0],[-.31,.83,.01],[-.64,.63,.03]];for(let i=0;i<3;i++){rod(g,joints[i],joints[i+1],.09,white);ball(g,joints[i],.105,accent,{metalness:.65,roughness:.18});}ball(g,joints[3],.073,accent);rod(g,joints[3],[-.68,.48,.03],.046,dark);for(const z of[-.045,.105])box(g,[-.68,.44,z],[.036,.14,.026],metal);line(g,[[.08,.25,-.1],[.09,.54,-.1],[-.28,.90,-.07],[-.59,.71,-.06]],'#4c6263',.012);
 }
 if(o.type==='agent'){
  mesh(g,new T.CylinderGeometry(.24,.29,.12,48),dark,[0,.10,0]);const shell=ball(g,[0,.25,0],.25,white,{roughness:.19,metalness:.3});shell.scale.set(1,.72,1);box(g,[0,.29,.218],[.21,.07,.025],dark);box(g,[0,.29,.235],[.13,.028,.009],'#81dcd4',{emissive:'#81dcd4',emissiveIntensity:.7});for(const x of[-.27,.27])mesh(g,new T.CylinderGeometry(.115,.115,.068,24),dark,[x,.11,0]).rotation.z=Math.PI/2;
 }
 if(o.type==='plant'){mesh(g,new T.CylinderGeometry(.22,.17,.35,40),'#b38567',[0,.175,0],{roughness:.8});rod(g,[0,.30,0],[0,1.15,0],.02,'#567358');for(let i=0;i<10;i++){const a=i*2.4,y=.48+i*.07,x=Math.cos(a)*.17,z=Math.sin(a)*.17;rod(g,[0,y-.05,0],[x,y+.04,z],.012,'#567358');const leaf=ball(g,[x*1.5,y+.04,z*1.5],.17,o.color||'#597e60',{roughness:.8});leaf.scale.set(1,.23,1.8);leaf.rotation.set(.35,a,.2);}}
 if(o.type==='lamp'){mesh(g,new T.CylinderGeometry(.24,.28,.035,48),dark,[0,.024,0]);rod(g,[0,.04,0],[0,1.65,0],.024,metal);const shade=mesh(g,new T.ConeGeometry(.27,.34,40,1,true),white,[0,1.64,0],{side:T.DoubleSide,roughness:.4});mesh(g,new T.CircleGeometry(.22,40),'#f9db9e',[0,1.47,0],{emissive:'#f9db9e',emissiveIntensity:.75}).rotation.x=Math.PI/2;}
 if(o.type==='sphere')ball(g,[0,.22,0],.22,accent,{metalness:.45,roughness:.14});if(o.type==='cube')box(g,[0,.18,0],[.35,.35,.35],accent,{metalness:.35,roughness:.22});
 g.name=o.id;g.userData={pick:o.id,draggable:!['bench','window'].includes(o.type),height:o.position.y,position:o.position,objectType:o.type};g.position.set(o.position.x,o.position.y,o.position.z);g.rotation.y=o.yaw*Math.PI/180;return g;
}
