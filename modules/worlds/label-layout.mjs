/** Screen-space annotations avoid both other labels and explanatory overlays.
 * Coordinates refer to the rendered viewport, not to scientific world state.
 */
export const overlaps=(a,b,gap=7)=>a.left<b.right+gap&&a.right>b.left-gap&&a.top<b.bottom+gap&&a.bottom>b.top-gap;
export function placeAnnotation({width,height,labelWidth,labelHeight,x,y,dx=0,dy=0,obstacles=[]}){
 const margin=12,bw=Math.min(labelWidth,width-2*margin),bh=labelHeight;
 if(bw<=0||height<bh+2*margin)return null;
 const fit=(cx,cy)=>{const left=Math.max(margin,Math.min(width-margin-bw,cx)),top=Math.max(margin,Math.min(height-margin-bh,cy));return{left,top,right:left+bw,bottom:top+bh};};
 const origin={left:x-bw/2+dx,top:y-bh+dy};
 const distance=r=>(r.left-origin.left)**2+(r.top-origin.top)**2;
 const candidates=[fit(origin.left,origin.top)];
 // A nearby obstacle boundary is normally the least distracting displacement.
 for(const o of obstacles)for(const [cx,cy]of[[o.left-bw-9,origin.top],[o.right+9,origin.top],[origin.left,o.top-bh-9],[origin.left,o.bottom+9]])candidates.push(fit(cx,cy));
 // The bounded fallback handles intersections between several panels/labels.
 for(let top=margin;top<=height-margin-bh;top+=18)for(let left=margin;left<=width-margin-bw;left+=24)candidates.push(fit(left,top));
 candidates.sort((a,b)=>distance(a)-distance(b));
 return candidates.find(r=>obstacles.every(o=>!overlaps(r,o)))||null;
}
