/** Screen-space annotations avoid both other labels and explanatory overlays.
 * Coordinates refer to the rendered viewport, not to scientific world state.
 */
export const overlaps=(a,b,gap=7)=>a.left<b.right+gap&&a.right>b.left-gap&&a.top<b.bottom+gap&&a.bottom>b.top-gap;
export function placeAnnotation({width,height,labelWidth,labelHeight,x,y,dx=0,dy=0,obstacles=[]}){
 const margin=12,gap=7,bw=Math.min(labelWidth,width-2*margin),bh=labelHeight;
 if(bw<=0||height<bh+2*margin)return null;
 const fit=(cx,cy)=>{const left=Math.max(margin,Math.min(width-margin-bw,cx)),top=Math.max(margin,Math.min(height-margin-bh,cy));return{left,top,right:left+bw,bottom:top+bh};};
 const origin={left:x-bw/2+dx,top:y-bh+dy};
 const distance=r=>(r.left-origin.left)**2+(r.top-origin.top)**2;
 // Feasible origin regions are axis-aligned cells cut out by obstacle edges.
 // Their nearest points use the preferred coordinate or one of those boundaries.
 // Combine BOTH axes: moving on only one axis or sampling a grid misses narrow lanes.
 const xs=[origin.left,margin,width-margin-bw],ys=[origin.top,margin,height-margin-bh];
 for(const o of obstacles){xs.push(o.left-bw-gap,o.right+gap);ys.push(o.top-bh-gap,o.bottom+gap);}
 const candidates=[],seen=new Set();
 for(const cx of xs)for(const cy of ys){const r=fit(cx,cy),key=r.left+':'+r.top;if(!seen.has(key)){seen.add(key);candidates.push(r);}}
 candidates.sort((a,b)=>distance(a)-distance(b));
 return candidates.find(r=>obstacles.every(o=>!overlaps(r,o,gap)))||null;
}
