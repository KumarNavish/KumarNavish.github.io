import * as T from 'three';
import type { V3 } from './science';
export const C={ink:0x18232c,blue:0x315fe8,cyan:0x42aaa9,warm:0xd9734e,gray:0xaebbc5,light:0xe7edf2,white:0xffffff,green:0x41836a,gold:0xc29552};
export function material(color:number,opacity=1,metalness=.06){return new T.MeshStandardMaterial({color,roughness:.48,metalness,transparent:opacity<1,opacity,depthWrite:opacity>=1});}
export function mesh(geometry:T.BufferGeometry,color:number,position:V3=[0,0,0],opacity=1){const m=new T.Mesh(geometry,material(color,opacity));m.position.set(...position);m.castShadow=opacity>=1;m.receiveShadow=true;return m;}
export function box(size:V3,color:number,position:V3=[0,0,0],opacity=1){return mesh(new T.BoxGeometry(...size),color,position,opacity);}
export function sphere(radius:number,color:number,position:V3=[0,0,0],opacity=1){return mesh(new T.SphereGeometry(radius,24,16),color,position,opacity);}
export function cylinder(radius:number,height:number,color:number,position:V3=[0,0,0],top=radius){return mesh(new T.CylinderGeometry(top,radius,height,32),color,position);}
export function rod(a:V3,b:V3,radius=.025,color=C.ink){const av=new T.Vector3(...a),bv=new T.Vector3(...b),d=bv.clone().sub(av);const m=cylinder(radius,d.length(),color);m.position.copy(av.add(bv).multiplyScalar(.5));m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());return m;}
export function arrow(a:V3,b:V3,color=C.blue,width=.035){const g=new T.Group(),v=new T.Vector3(...b).sub(new T.Vector3(...a)),length=v.length();if(length<.001)return g;g.add(rod(a,b,width,color));const tip=mesh(new T.ConeGeometry(width*3.5,Math.min(.27,length*.28),20),color,b);tip.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.normalize());g.add(tip);return g;}
export function line(points:V3[],color=C.ink,opacity=1){return new T.Line(new T.BufferGeometry().setFromPoints(points.map(p=>new T.Vector3(...p))),new T.LineBasicMaterial({color,transparent:opacity<1,opacity}));}
export function tube(points:V3[],color=C.blue,radius=.03){if(points.length<2)return new T.Group();return mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),Math.max(24,points.length*2),radius,6,false),color);}
export function ring(radius:number,color=C.blue,position:V3=[0,.03,0]){const m=mesh(new T.TorusGeometry(radius,.012,6,80),color,position);m.rotation.x=-Math.PI/2;return m;}
export function label(text:string,position:V3,size=.3,color='#52616f'){
 const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=128;const ctx=canvas.getContext('2d')!;
 ctx.clearRect(0,0,1024,128);ctx.font='500 52px -apple-system, BlinkMacSystemFont, Arial, sans-serif';ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,512,64);
 const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.minFilter=T.LinearFilter;
 const sprite=new T.Sprite(new T.SpriteMaterial({map:texture,depthTest:false,transparent:true}));sprite.position.set(...position);sprite.scale.set(size*8,size,1);sprite.userData.label=true;return sprite;
}
export function grid(size=9,divisions=18){const g=new T.GridHelper(size,divisions,0xcdd6de,0xe2e8ee);g.position.y=-.015;return g;}
export function platform(width=8,depth=6){const g=new T.Group();g.add(box([width,.16,depth],0xf1f4f7,[0,-.15,0]));return g;}
export function disposeObject(root:T.Object3D){root.traverse(o=>{const x=o as T.Mesh;if(x.geometry)x.geometry.dispose();if(x.material){const mats=Array.isArray(x.material)?x.material:[x.material];mats.forEach(m=>{const p=m as T.MeshStandardMaterial;if(p.map)p.map.dispose();m.dispose();});}});}
export function surface(height:(x:number,z:number)=>number,color=C.blue,size=7,segments=48){
 const geo=new T.PlaneGeometry(size,size,segments,segments);geo.rotateX(-Math.PI/2);const a=geo.attributes.position;
 for(let i=0;i<a.count;i++)a.setY(i,height(a.getX(i),a.getZ(i)));geo.computeVertexNormals();const m=mesh(geo,color);m.material=material(color,.88);(m.material as T.MeshStandardMaterial).side=T.DoubleSide;return m;
}
export type Model={group:T.Group;update?:(seconds:number,dt:number)=>boolean};
