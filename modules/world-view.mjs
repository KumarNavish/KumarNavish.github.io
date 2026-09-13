/** The spatial editor and scientific scenes share one renderer, not one scene. */
import {createStudio} from './studio-engine.mjs?v=studio-2';
import {buildScene,sceneCameras} from './project-scenes.mjs?v=studio-2';
export function createWorldView(canvas,labels,callbacks={}){
 let state=null,selected='microscope-1',dragBase=null;
 const view=createStudio(canvas,labels,{camera:sceneCameras.world,
 onPick:id=>callbacks.select?.(id),onCamera:()=>callbacks.camera?.(),
 onSelect:id=>{dragBase=state.objects.find(o=>o.id===id)?.position;callbacks.select?.(id);},
 onDrag:(id,delta,done)=>{if(dragBase)callbacks.move?.(id,{x:dragBase.x+delta[0],z:dragBase.z+delta[2]},done);}
 });
 return{set(s,id=selected){state=s;selected=id;view.set(buildScene('world',{...s,selected},0));},project(p){return view.project(p);},rotate:delta=>view.orbit(delta),zoom:delta=>view.zoom(delta),resetCamera:()=>view.reset(),dispose:()=>view.dispose()};
}
