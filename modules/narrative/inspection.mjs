/** Inspect an existing computed operator; do not substitute another graph model. */
export function gainEigenmode(state, index = 0) {
  const n = state.re.length, N = 2 * n;
  if (!Number.isInteger(index) || index < 0 || index >= n) throw new RangeError('Unknown eigenmode.');
  const a = Array.from({length:N}, (_,i) => Array.from({length:N}, (_,j) => i<n
    ? (j<n ? state.re[i][j] : -state.im[i][j-n])
    : (j<n ? state.im[i-n][j] : state.re[i-n][j-n])));
  const q = Array.from({length:N}, (_,i) => Array.from({length:N}, (_,j) => +(i===j)));
  for (let iter=0; iter<100*N*N; iter++) {
    let p=0, r=1, largest=0;
    for(let i=0;i<N;i++) for(let j=i+1;j<N;j++) if(Math.abs(a[i][j])>largest) {largest=Math.abs(a[i][j]);p=i;r=j;}
    if(largest<1e-13) break;
    const t=.5*Math.atan2(2*a[p][r],a[r][r]-a[p][p]),c=Math.cos(t),s=Math.sin(t),ap=a[p][p],ar=a[r][r],off=a[p][r];
    for(let k=0;k<N;k++) {
      if(k!==p&&k!==r) {const x=a[k][p],y=a[k][r];a[k][p]=a[p][k]=c*x-s*y;a[k][r]=a[r][k]=s*x+c*y;}
      const x=q[k][p],y=q[k][r];q[k][p]=c*x-s*y;q[k][r]=s*x+c*y;
    }
    a[p][p]=c*c*ap-2*s*c*off+s*s*ar;a[r][r]=s*s*ap+2*s*c*off+c*c*ar;a[p][r]=a[r][p]=0;
  }
  // Each Hermitian eigenvalue appears twice in the real representation.
  const order=Array.from({length:N},(_,i)=>i).sort((i,j)=>a[i][i]-a[j][j]),col=order[2*index];
  let z=Array.from({length:n},(_,i)=>[q[i][col],q[i+n][col]]);
  const length=Math.hypot(...z.flat());z=z.map(([r,i])=>[r/length,i/length]);
  const pivot=z.reduce((best,v,i)=>Math.hypot(...v)>Math.hypot(...z[best])?i:best,0);
  const phase=Math.atan2(z[pivot][1],z[pivot][0]),c=Math.cos(phase),s=Math.sin(phase);
  z=z.map(([r,i])=>[c*r+s*i,c*i-s*r]); // global phase is arbitrary; fix a stable reference
  const eigenvalue=state.eigenvalues[index];let residual2=0;
  for(let i=0;i<n;i++) {
    let re=-eigenvalue*z[i][0],im=-eigenvalue*z[i][1];
    for(let j=0;j<n;j++) {re+=state.re[i][j]*z[j][0]-state.im[i][j]*z[j][1];im+=state.im[i][j]*z[j][0]+state.re[i][j]*z[j][1];}
    residual2+=re*re+im*im;
  }
  return {index,eigenvalue,vector:z,amplitudes:z.map(v=>Math.hypot(...v)),phases:z.map(v=>Math.atan2(v[1],v[0])),residual:Math.sqrt(residual2)};
}

/** Relax only A and B. Keeping C unchanged makes the rank-two boundary inspectable. */
export function recoveryConstraints(base, tolerance=0) {
  if(!Number.isFinite(tolerance)||tolerance<0||tolerance>1.4) throw new RangeError('Recovery tolerance must be between 0 and 1.4.');
  return base.map((c,i)=>({...c,n:c.n.slice(),b:c.b-(i<2?tolerance:0)}));
}

export function positionAtProgress(progress, anchors) {
  const u=Math.max(0,Math.min(1,progress))*(anchors.length-1),i=Math.floor(u),j=Math.min(anchors.length-1,i+1);
  return anchors[i]+(anchors[j]-anchors[i])*(u-i);
}
