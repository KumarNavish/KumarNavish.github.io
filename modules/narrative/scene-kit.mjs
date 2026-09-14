import {T,mesh,box,ball,line,rod,ring,clear,V,createStage} from '../worlds/stage.mjs?v=scroll-4.1';
export {T,mesh,box,ball,line,rod,ring,clear,V,createStage};
export const fmt=(x,n=3)=>Number(x).toFixed(n);
export function group(parent){const g=new T.Group();parent.add(g);return g;}
export function alpha(g,value){value=Math.max(0,Math.min(1,value));g.visible=value>.002&&!g.userData.empty;if(g.userData.fade===value)return;g.userData.fade=value;g.traverse(o=>{if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material]){m.userData.baseOpacity??=m.opacity;m.userData.baseDepth??=m.depthWrite;m.opacity=m.userData.baseOpacity*value;m.transparent=m.opacity<.999;m.depthWrite=value>.98&&m.userData.baseDepth;}});}
export function segment(parent,color,r=.024,dashed=false){
 const g=group(parent),pieces=Array.from({length:dashed?9:1},()=>mesh(g,new T.CylinderGeometry(1,1,1,12),color,[0,0,0],{roughness:.48,metalness:.2}));
 return {g,set(a,b){const A=V(a),B=V(b),d=B.clone().sub(A),len=d.length();g.userData.empty=len<=1e-7;g.visible=!g.userData.empty;if(!g.visible)return;pieces.forEach((p,i)=>{const begin=dashed?i/9:0,end=dashed?(i+.58)/9:1;p.position.copy(A).addScaledVector(d,(begin+end)/2);p.scale.set(r,len*(end-begin),r);p.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.clone().normalize());});},color(c){pieces.forEach(p=>p.material.color.set(c));}};
}
export function vector(parent,color,r=.03,dashed=false){const g=group(parent),s=segment(g,color,r,dashed),head=mesh(g,new T.ConeGeometry(1,1,20),color);return{g,set(a,b){const A=V(a),B=V(b),d=B.clone().sub(A),l=d.length();g.userData.empty=l<=1e-7;g.visible=!g.userData.empty;if(!g.visible)return;const h=Math.min(.2,l*.23),end=B.clone().addScaledVector(d,-h/l*.75);s.set(a,end.toArray());head.position.copy(B).addScaledVector(d,-h/l*.5);head.scale.set(r*3,h,r*3);head.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());},color(c){s.color(c);head.material.color.set(c);}};}
export const point=(o,p)=>o.position.set(...p);
export function annotation(view){let signature='';return items=>{const next=JSON.stringify(items);if(signature!==next){signature=next;view.setLabels(items);}};}
export function contentHTML(el,html){if(el._lastHTML!==html){el.innerHTML=html;el._lastHTML=html;}}
export const metric=(label,value,cls='')=>`<div class="n-metric ${cls}"><span>${label}</span><strong>${value}</strong></div>`;
export function basePlane(parent,color='#e2e9e2',size=12){const m=mesh(parent,new T.PlaneGeometry(size,size),color,[0,-.18,0],{roughness:1,metalness:0});m.rotation.x=-Math.PI/2;return m;}
