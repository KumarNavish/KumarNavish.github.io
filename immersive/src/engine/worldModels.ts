import * as T from 'three';
import { box,cylinder,rod,sphere,mesh,material,C,ring,line,type Model } from './primitives';
import { agentPath,initialWorld,type WorldObject,type WorldState } from './world';
import type { V3 } from './science';
export function pine(scale=1){const g=new T.Group();g.add(cylinder(.07,.9,0x766452,[0,.45,0]));for(let i=0;i<3;i++)g.add(mesh(new T.ConeGeometry(.57-i*.1,1.1,8),i===2?0x6d8b83:0x537369,[0,.85+i*.38,0]));g.scale.setScalar(scale);return g;}
export function makeObject(o:WorldObject){
 const g=new T.Group();g.name=o.name;g.userData.objectId=o.id;
 if(o.kind==='bench'){
  g.add(box([5,.14,1.7],0xe2e7e9,[0,1.05,0]),box([5.04,.035,1.73],C.white,[0,1.14,0]));
  for(const x of [-2.22,2.22])for(const z of [-.62,.62])g.add(box([.12,1.02,.12],0x85959f,[x,.51,z]));
  g.add(rod([-2.2,.2,-.62],[2.2,.2,-.62],.045,0x85959f));
 }else if(o.kind==='microscope'){
  g.add(box([.54,.075,.4],C.ink,[0,.04,0]),box([.4,.09,.28],C.white,[0,.11,0]));
  g.add(rod([-.15,.13,.03],[-.15,.65,-.1],.075,0xd7e0e5),box([.36,.035,.31],C.ink,[.07,.39,.02]));
  const head=new T.Group();head.position.set(-.12,.67,-.07);head.rotation.z=-.28;head.add(cylinder(.085,.38,C.white,[0,.06,0]),cylinder(.06,.1,C.ink,[0,.29,0]),cylinder(.05,.11,C.ink,[0,-.18,0]));g.add(head);
  g.add(sphere(.065,C.blue,[-.22,.4,.04]),cylinder(.055,.035,C.cyan,[.05,.423,.02]));
 }else if(o.kind==='robot'){
  g.add(cylinder(.23,.13,0x526573,[0,.065,0]),cylinder(.14,.19,C.white,[0,.2,0]));
  const elbow:V3=[.14,.74,0],wrist:V3=[-.4,1.04,.08];g.add(rod([0,.25,0],elbow,.105,C.white),sphere(.125,C.ink,elbow),rod(elbow,wrist,.085,C.white),sphere(.09,C.ink,wrist));
  g.add(rod(wrist,[-.55,.85,.1],.052,C.white),rod([-.55,.85,.1],[-.55,.72,.1],.038,C.warm),rod([-.62,.72,.1],[-.48,.72,.1],.018,C.ink));
  g.add(rod([-.62,.72,.1],[-.64,.63,.1],.014,C.ink),rod([-.48,.72,.1],[-.46,.63,.1],.014,C.ink));
 }else if(o.kind==='sample'){
  g.add(cylinder(.17,.036,0xacc7d5,[0,.025,0]),cylinder(.13,.022,0xc1ded4,[0,.053,0]));
  for(let i=0;i<5;i++)g.add(sphere(.022,i%2?C.blue:C.warm,[Math.cos(i*2.4)*.07,.067,Math.sin(i*2.4)*.07]));
 }
 else if(o.kind==='window'){
  g.add(box([5.8,.07,.08],0x52616c,[0,1.15,0]),box([5.8,.07,.08],0x52616c,[0,2.4,0]));
  for(const x of [-2.88,0,2.88])g.add(box([.07,1.3,.08],0x52616c,[x,1.77,0]));
  g.add(box([5.7,1.2,.035],0xaacbdc,[0,1.78,0],.24));
 }else if(o.kind==='lamp'){
  g.add(cylinder(.15,.04,C.ink,[0,.03,0]),rod([0,.05,0],[0,.66,0],.025,C.ink),rod([0,.64,0],[-.25,.74,0],.022,C.ink));
  const shade=mesh(new T.ConeGeometry(.19,.17,24,1,true),C.white,[-.25,.71,0]);g.add(shade,cylinder(.16,.01,0xffe5ae,[-.25,.626,0]));
 }else if(o.kind==='tree')g.add(pine(1.05));
 else if(o.kind==='cabinet'){
  g.add(box([.86,1.45,.58],0xe6ebeb,[0,.725,0]));
  for(let i=0;i<3;i++){g.add(box([.79,.38,.035],C.white,[0,.31+i*.44,.31]),box([.2,.025,.06],0x73838a,[0,.35+i*.44,.34]));}
 }
 g.position.set(...o.position);g.rotation.y=o.rotation*Math.PI/180;return g;
}
export function explorerRobot(){const g=new T.Group();g.add(box([.38,.26,.43],C.white,[0,.23,0]),box([.31,.095,.025],C.ink,[0,.3,.23]));for(const x of [-.21,.21])for(const z of [-.14,.14]){const w=cylinder(.075,.045,C.ink,[x,.13,z]);w.rotation.z=Math.PI/2;g.add(w);}g.add(sphere(.027,C.blue,[-.07,.3,.25]),sphere(.027,C.blue,[.07,.3,.25]),rod([0,.35,0],[0,.55,0],.012,C.ink),sphere(.035,C.warm,[0,.57,0]));return g;}
function terrain(){
 const geo=new T.PlaneGeometry(36,28,100,80);geo.rotateX(-Math.PI/2);const p=geo.attributes.position,colors:number[]=[];
 const peaks=[[-9,-9,8.2,3.4],[-3,-11,10,3.1],[4,-10,7.8,2.8],[11,-9,10,4],[-12,-1,5,3.2],[12,-1,4,3.2]];
 for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i);let h=-.55;for(const [cx,cz,high,sigma]of peaks)h+=high*Math.exp(-((x-cx)**2+(z-cz)**2)/(sigma*sigma));h+=(Math.sin(x*2.6)*Math.cos(z*2.4)*.26+Math.sin(x*.7+z*2)*.32)*Math.min(1,Math.max(0,Math.hypot(x,z)-4));h*=Math.min(1,Math.max(0,(Math.hypot(x,z*.85)-4.6)/2));p.setY(i,h-.24);const c=new T.Color(h>6.2?0xf4f5f4:h>3.6?0xa9b6c4:h>1.1?0x788994:0xa4b3ad);colors.push(c.r,c.g,c.b);}
 geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.computeVertexNormals();const m=new T.Mesh(geo,new T.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:.94}));m.receiveShadow=true;m.castShadow=true;return m;
}
export function buildWorld(world:WorldState,selected='',runAgent=false,onDone?:()=>void,mini=false):Model{
 const group=new T.Group();
 if(!mini&&world.environment==='mountain')group.add(terrain());
 else if(!mini){const floor=box([30,.2,25],0xc5d1c7,[0,-.35,-3]);group.add(floor);if(world.environment==='forest')for(let i=0;i<20;i++){const tree=pine(.9+(i%4)*.25),angle=i*2.4;tree.position.set(Math.cos(angle)*(7+i%5),0,Math.sin(angle)*(7+i%4));group.add(tree);}}
 group.add(box([8,.24,5.7],0xe6e9e8,[0,-.13,0]),box([7.7,.04,5.4],0xf6f4ee,[0,.01,0]));
 for(let i=0;i<12;i++)group.add(box([.012,.008,5.2],0xd6d7d2,[-3.7+i*.64,.036,0]));
 group.add(box([6.3,.48,.15],0xc4cbd0,[0,.24,-2.2]));
 for(const x of [-3.1,3.1])for(const z of [-2.2,2.2])group.add(box([.1,2.8,.1],C.white,[x,1.4,z]));
 group.add(box([6.4,.16,1.5],0xf5f4ef,[0,2.8,-1.5]));
 for(const x of [-3.1,3.1])group.add(rod([x,2.7,-2.2],[x,2.7,2.2],.055,0x87949c));
 group.add(rod([-3.1,2.7,2.2],[3.1,2.7,2.2],.05,0x87949c));
 for(let i=0;i<4;i++)group.add(box([1.1,.09,.5],0xd6d9d7,[-2.7,.05,3.2+i*.68]));
 if(!mini)for(const [x,z,s]of [[-4.8,-3.5,1.3],[4.8,-4,1.2],[5.2,2,.85],[-5.4,1.2,.9]]){const p=pine(s);p.position.set(x,-.1,z);group.add(p);}
 const objects=world.objects.map(makeObject);objects.forEach(o=>group.add(o));
 const selectedObject=world.objects.find(o=>o.id===selected);if(selectedObject)group.add(ring(.48,C.blue,[selectedObject.position[0],selectedObject.position[1]+.03,selectedObject.position[2]]));
 const robot=explorerRobot();robot.position.set(-3,0,2);group.add(robot);
 const route=world.goal?agentPath(world,world.goal):[];let finished=false;
 if(route.length&&runAgent)group.add(line(route.map(p=>[p[0],.055,p[2]]),C.blue,.65));
 const lamp=new T.PointLight(world.time==='night'?0xb6d7ff:0xffe3b3,world.time==='night'?14:2,8,2);lamp.position.set(0,2.45,-.4);group.add(lamp);
 if(world.time==='night'){const glow=box([5.6,.018,.6],0xffdda5,[0,2.7,-1.5]);(glow.material as T.MeshStandardMaterial).emissive.set(0xffc77d);(glow.material as T.MeshStandardMaterial).emissiveIntensity=.8;group.add(glow);}
 return {group,update:(seconds)=>{if(!runAgent||!route.length||finished)return false;const index=Math.min(route.length-1,Math.floor(seconds*10)),p=route[index];robot.position.set(p[0],0,p[2]);if(index<route.length-1){const n=route[index+1];robot.rotation.y=Math.atan2(n[0]-p[0],n[2]-p[2]);}if(index===route.length-1){finished=true;onDone?.();return false;}return true;}};
}
export function miniatureWorld(){const w=initialWorld();return buildWorld(w,'',false,undefined,true).group;}
