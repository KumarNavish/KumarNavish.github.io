import { gainGraph,replayExample,rankExample,temporalExample,urbanExample,gaussianExample,evidenceGate,type EvidenceSource } from '../engine/science';
import type { ScienceState } from '../engine/scientificModels';
export const DEMO_SOURCES:EvidenceSource[]=[{id:'source-A',field:'inspection-date',value:'2026-08-20'},{id:'source-B',field:'inspection-date',value:'2026-08-21'}];
export const CORRECTION:EvidenceSource={id:'correction-C',field:'inspection-date',value:'2026-08-20',supersedes:'source-B'};
const fmt=(x:number|null,d=3)=>x===null?'—':x.toFixed(d);
function Metrics({items}:{items:[string,string][]}){return <dl className="readouts">{items.map(([term,value])=><div key={term}><dt>{term}</dt><dd>{value}</dd></div>)}</dl>;}
export function Readouts({state}:{state:ScienceState}){
 const s=state;
 if(s.kind==='graph'||s.kind==='frustration'){
  const d=gainGraph(s.value*Math.PI/180,!!s.normalized,!!s.repaired);
  return <Metrics items={[["Least eigenvalue",fmt(d.eigen[0])],['Cycle state',d.balanced?'Balanced':'Unbalanced'],['Minimum edge repair',String(d.frustration)]]}/>;
 }
 if(s.kind==='replay'){
  const d=replayExample(s.value,s.secondary??155,(s.comparison??'greedy') as 'greedy'|'random'|'dense',s.repaired);
  return <div className="replay-readouts"><Metrics items={[["Gradient residual",fmt(d.residual)],['Selected memories',`${d.selected.length} / 12`]]}/><table className="loss-table"><thead><tr><th>Quadratic loss</th><th>Before</th><th>Current only</th><th>With replay</th></tr></thead><tbody><tr><th>Old examples</th><td>{fmt(d.oldBefore)}</td><td>{s.step>=1?fmt(d.oldAfterCurrent):'—'}</td><td>{s.step>=4?fmt(d.oldAfterReplay):'—'}</td></tr><tr><th>New task</th><td>{fmt(d.newBefore)}</td><td>{s.step>=1?fmt(d.newAfterCurrent):'—'}</td><td>{s.step>=4?fmt(d.newAfterReplay):'—'}</td></tr></tbody></table></div>;
 }
 if(s.kind==='rank'){
  const d=rankExample(s.value,s.secondary??2);
  return <Metrics items={[["Minimum correction norm",fmt(d.magnitude)],['Update budget',fmt(s.secondary??2,1)],['Result',!d.feasible?'Infeasible':d.usable?'Feasible & usable':'Feasible, too costly']]}/>;
 }
 if(s.kind==='temporal'){
  const d=temporalExample(s.value,s.secondary??.8,4);
  return <><Metrics items={[["Current + historical",`${d.currentTokens} + ${d.oldTokens} = 100`],['Net replacement value',fmt(d.net)],['Suggested replay',d.net>0?`${d.recommended} tokens`:'0 tokens']]}/><div className="token-budget" aria-label={`${d.currentTokens} current tokens, ${d.oldTokens} historical tokens`}><span style={{width:`${d.currentTokens}%`}}/><i style={{width:`${d.oldTokens}%`}}/></div></>;
 }
 if(s.kind==='urban'){
  const d=urbanExample(s.value,s.secondary??2);
  return <Metrics items={[["Van service time",`${fmt(d.vanTime,2)} min`],['Bike service time',`${fmt(d.bikeTime,2)} min`],['Faster in this scenario',d.winner]]}/>;
 }
 if(s.kind==='gaussian'){
  const d=gaussianExample(s.value,180);
  return <Metrics items={[["Initial Gaussian KL",fmt(d.n.losses[0])],['Fisher-flow KL at step 180',fmt(d.n.losses[180])],['Euclidean KL at step 180',fmt(d.e.losses[180])]]}/>;
 }
 if(s.kind==='evidence'){
  const d=evidenceGate(s.repaired?[...DEMO_SOURCES,CORRECTION]:s.step<3?[DEMO_SOURCES[0]]:DEMO_SOURCES);
  return <Metrics items={[["Admission",d.status],['Active sources',d.active.join(', ')],['Superseded source',d.superseded.join(', ')||'None']]}/>;
 }
 return <Metrics items={[["Example users",'16'],['Evidence type','Observational'],['Visualization data','Synthetic']]}/>;
}
export function Matrix({state}:{state:ScienceState}){
 const d=gainGraph(state.value*Math.PI/180,!!state.normalized,!!state.repaired);
 const cell=(i:number,j:number)=>{const r=d.re[i][j],im=d.im[i][j];return Math.abs(im)<1e-8?r.toFixed(2):`${r.toFixed(2)} ${im<0?'−':'+'} ${Math.abs(im).toFixed(2)}i`;};
 return <div className="matrix-wrap"><table className="matrix" aria-label="Computed Hermitian gain Laplacian"><tbody>{d.re.map((row,i)=><tr key={i}>{row.map((_,j)=><td key={j}>{cell(i,j)}</td>)}</tr>)}</tbody></table><p>Real and imaginary entries are recomputed. Reverse orientations are complex conjugates.</p></div>;
}
