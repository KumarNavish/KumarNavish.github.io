import * as T from '../../vendor/three.module.min.js';
import {OrbitControls} from '../../vendor/OrbitControls.js';
import {RoomEnvironment} from '../../vendor/RoomEnvironment.js';
export {T};
export const V=a=>new T.Vector3(...a);
export function material(color,options={}){return new T.MeshStandardMaterial({color,roughness:.34,metalness:.18,...options});}
export function mesh(parent,geometry,color,pos=[0,0,0],options={}){const m=new T.Mesh(geometry,typeof color==='object'?color:material(color,options));m.position.set(...pos);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
export function box(g,pos,size,color,opt={}){return mesh(g,new T.BoxGeometry(...size),color,pos,opt);}
export function ball(g,pos,r,color,opt={}){return mesh(g,new T.SphereGeometry(r,32,20),color,pos,opt);}
export function line(g,points,color,width=.018,opt={}){if(points.length<2)return null;const curve=new T.CatmullRomCurve3(points.map(V),false,'centripetal');return mesh(g,new T.TubeGeometry(curve,Math.max(2,points.length*6),width,8,false),color,[0,0,0],opt);}
export function rod(g,a,b,r,color,opt={}){const av=V(a),bv=V(b),d=bv.clone().sub(av),m=mesh(g,new T.CylinderGeometry(r,r,d.length(),14),color,av.clone().add(bv).multiplyScalar(.5).toArray(),opt);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());return m;}
export function arrow(g,a,b,color,r=.025,opt={}){const d=V(b).sub(V(a)),len=d.length();if(len<1e-5)return;const head=Math.min(.22,len*.28),end=V(b).addScaledVector(d.clone().normalize(),-head*.5);rod(g,a,end.toArray(),r,color,opt);const h=mesh(g,new T.ConeGeometry(r*3.4,head,20),color,V(b).addScaledVector(d.clone().normalize(),-head*.5).toArray(),opt);h.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());return h;}
export function ring(g,pos,r,color,rotation=[-Math.PI/2,0,0],thickness=.014){const m=mesh(g,new T.TorusGeometry(r,thickness,10,96),color,pos);m.rotation.set(...rotation);return m;}
export function clear(g){g.traverse(o=>{o.geometry?.dispose();if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material]){m.map?.dispose();m.dispose();}}});g.clear();}
export function createStage(host,{background='#f3f5f4',dark=false,camera=[6,4.5,8],target=[0,.5,0],onPick=()=>{},onDrag=null,floor=true}={}){
 host.innerHTML='<canvas class="world-canvas" tabindex="0" aria-label="Interactive spatial explanation. Drag to orbit, select an object, use arrow keys to rotate."></canvas><div class="world-label-layer" aria-hidden="true"></div><div class="camera-hint">Drag to orbit · Scroll to zoom</div><div class="camera-tools"><button data-view="left" aria-label="Rotate view left">↶</button><button data-view="right" aria-label="Rotate view right">↷</button><button data-view="reset">Reset view</button><button data-view="expand">Expand</button></div>';
 const canvas=host.querySelector('canvas'),labels=host.querySelector('.world-label-layer');
 const context=canvas.getContext('webgl2',{antialias:true,alpha:false,preserveDrawingBuffer:true});
 if(!context)throw Error('Interactive 3D needs WebGL 2. All controls, calculations, and the reading view remain available.');
 const renderer=new T.WebGLRenderer({canvas,context,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.6));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=dark?1.4:1.15;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
 const scene=new T.Scene();scene.background=new T.Color(background);scene.fog=new T.Fog(background,28,80);
 const cam=new T.PerspectiveCamera(40,1,.08,180);cam.position.set(...camera);
 const controls=new OrbitControls(cam,canvas);controls.target.set(...target);controls.enableDamping=true;controls.dampingFactor=.075;controls.maxDistance=26;controls.minDistance=3;controls.maxPolarAngle=Math.PI*.485;controls.enablePan=true;controls.update();
 const hemi=new T.HemisphereLight(dark?'#a6d7fa':'#dbefff',dark?'#172733':'#bcb3a0',dark?2:2.2);scene.add(hemi);
 const key=new T.DirectionalLight('#fff4dd',dark?3:3.7);key.position.set(3,9,5);key.castShadow=true;key.shadow.mapSize.set(1024,1024);Object.assign(key.shadow.camera,{left:-14,right:14,top:14,bottom:-14,near:.5,far:45});key.shadow.bias=-.0006;key.shadow.normalBias=.035;scene.add(key);
 const rim=new T.DirectionalLight(dark?'#409dde':'#cde9ff',dark?3:1.8);rim.position.set(-7,4,-6);scene.add(rim);
 const pmrem=new T.PMREMGenerator(renderer),envScene=new RoomEnvironment(),env=pmrem.fromScene(envScene,.04);scene.environment=env.texture;envScene.dispose();pmrem.dispose();
 const fixed=new T.Group(),content=new T.Group(),transient=new T.Group();scene.add(fixed,content,transient);
 if(floor){const f=mesh(fixed,new T.PlaneGeometry(100,100),dark?'#091923':'#ecefed',[0,-.16,0],{roughness:.7,metalness:.08});f.rotation.x=-Math.PI/2;}
 let labelItems=[],tick=null,disposed=false,frame=0,visible=true,last=0,down=null,drag=null,fly=null,paused=false;
 const ray=new T.Raycaster(),ndc=new T.Vector2();let pickables=[];
 function getRay(e){const r=canvas.getBoundingClientRect();ndc.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(ndc,cam);return ray;}
 function hit(e){return getRay(e).intersectObjects(pickables,true).find(h=>{let o=h.object;while(o&&!o.userData.pick)o=o.parent;return o;});}
 function pickRoot(o){while(o&&!o.userData.pick)o=o.parent;return o;}
 const pointerdown=e=>{if(e.button!==0)return;down=[e.clientX,e.clientY];const h=hit(e),o=h&&pickRoot(h.object);if(o&&onDrag&&o.userData.draggable){const plane=new T.Plane(new T.Vector3(0,1,0),-o.userData.height);const start=new T.Vector3();ray.ray.intersectPlane(plane,start);drag={id:o.userData.pick,plane,start,position:o.userData.position};controls.enabled=false;canvas.setPointerCapture(e.pointerId);}};
 const pointermove=e=>{if(drag){const p=new T.Vector3();getRay(e).ray.intersectPlane(drag.plane,p);onDrag(drag.id,{x:drag.position.x+p.x-drag.start.x,z:drag.position.z+p.z-drag.start.z},false);}else{canvas.style.cursor=hit(e)?'pointer':'grab';}};
 const pointerup=e=>{if(drag){const p=new T.Vector3();getRay(e).ray.intersectPlane(drag.plane,p);onDrag(drag.id,{x:drag.position.x+p.x-drag.start.x,z:drag.position.z+p.z-drag.start.z},true);drag=null;controls.enabled=true;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);}else if(down&&Math.hypot(e.clientX-down[0],e.clientY-down[1])<5){const h=hit(e),o=h&&pickRoot(h.object);if(o)onPick(o.userData.pick);}down=null;};
 const cancel=e=>{drag=null;down=null;controls.enabled=true;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);};
 canvas.addEventListener('pointerdown',pointerdown);canvas.addEventListener('pointermove',pointermove);canvas.addEventListener('pointerup',pointerup);canvas.addEventListener('pointercancel',cancel);
 function orbit(a){const off=cam.position.clone().sub(controls.target);off.applyAxisAngle(new T.Vector3(0,1,0),a);cam.position.copy(controls.target).add(off);controls.update();}
 const keydown=e=>{if(['ArrowLeft','ArrowRight','+','-','Escape'].includes(e.key)){e.preventDefault();if(e.key==='Escape'){host.classList.remove('expanded');host.querySelector('[data-view="expand"]').textContent='Expand';}else if(e.key.startsWith('Arrow'))orbit(e.key==='ArrowLeft'?-.22:.22);else cam.position.sub(controls.target).multiplyScalar(e.key==='+'?.9:1.1).add(controls.target);}};canvas.addEventListener('keydown',keydown);
 host.querySelector('.camera-tools').addEventListener('click',e=>{const a=e.target.dataset.view;if(a==='left')orbit(-.3);if(a==='right')orbit(.3);if(a==='reset')go(camera,target);if(a==='expand'){host.classList.toggle('expanded');e.target.textContent=host.classList.contains('expanded')?'Close':'Expand';}});
 function size(){const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);cam.aspect=w/h;cam.updateProjectionMatrix();}const ro=new ResizeObserver(size);ro.observe(host);size();
 const io=new IntersectionObserver(e=>{visible=e[0].isIntersecting;});io.observe(host);
 function setLabels(items){labelItems=items.map(({text,pos,tone='',...rest})=>{const el=document.createElement('span');el.className='spatial-label '+tone;el.textContent=text;labels.append(el);return{el,pos,...rest};});labels.replaceChildren(...labelItems.map(l=>l.el));}
 function go(pos,at=target){fly={start:performance.now(),a:cam.position.clone(),b:controls.target.clone(),p:V(pos),t:V(at)};}
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 function loop(now){if(disposed)return;frame=requestAnimationFrame(loop);if(!visible||document.hidden)return;const dt=Math.min(.05,(now-last)/1000||0);last=now;
  if(fly){const a=reduced?1:Math.min(1,(now-fly.start)/850),k=a*a*(3-2*a);cam.position.lerpVectors(fly.a,fly.p,k);controls.target.lerpVectors(fly.b,fly.t,k);if(a===1)fly=null;}
  controls.update();if(!paused)tick?.(reduced?0:now/1000,reduced?0:dt);renderer.render(scene,cam);
  for(const l of labelItems){const p=V(typeof l.pos==='function'?l.pos():l.pos).project(cam);l.el.style.left=(p.x*.5+.5)*host.clientWidth+'px';l.el.style.top=(-p.y*.5+.5)*host.clientHeight+'px';l.el.hidden=p.z>1||p.z< -1||Math.abs(p.x)>1.04||Math.abs(p.y)>1.04;}
  canvas.dataset.rendered='webgl2';canvas.dataset.camera=cam.position.toArray().map(v=>v.toFixed(3)).join(',');canvas.dataset.calls=renderer.info.render.calls;canvas.dataset.pickPoints=JSON.stringify(pickables.filter(o=>o.userData.draggable).map(o=>{const p=o.localToWorld(new T.Vector3(0,.1,0)).project(cam);return{id:o.userData.pick,x:(p.x*.5+.5)*host.clientWidth,y:(-p.y*.5+.5)*host.clientHeight};}));
 }frame=requestAnimationFrame(loop);
 return{T,scene,cam,controls,renderer,fixed,content,transient,key,hemi,rim,go,orbit,setLabels,setPickables:a=>{pickables=a;},setTick:f=>{tick=f;},pause:v=>{paused=v;},background(color){scene.background.set(color);scene.fog.color.set(color);},dispose(){disposed=true;cancelAnimationFrame(frame);ro.disconnect();io.disconnect();controls.dispose();canvas.removeEventListener('pointerdown',pointerdown);canvas.removeEventListener('pointermove',pointermove);canvas.removeEventListener('pointerup',pointerup);canvas.removeEventListener('pointercancel',cancel);canvas.removeEventListener('keydown',keydown);clear(content);clear(fixed);clear(transient);env.dispose();renderer.dispose();renderer.forceContextLoss();}};
}
