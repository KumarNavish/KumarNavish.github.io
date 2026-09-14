import test from 'node:test';import assert from 'node:assert/strict';
import {gainEigenmode,recoveryConstraints,positionAtProgress} from '../modules/narrative/inspection.mjs';
import {graphState,rankState,constraints,dot} from '../modules/worlds/math.mjs';
import {evaluateNarrative,caseAt,progressFromAnchors} from '../modules/narrative/model.mjs';
import {feasibleGeometry} from '../modules/narrative/feasible.mjs';
import {stories} from '../modules/narrative/chapters.mjs';
const near=(a,b,t=1e-8)=>assert(Math.abs(a-b)<t,`${a} != ${b}`);
for(const angles of [Array(7).fill(0),[0,110,0,0,0,0,0],[30,-110,45,0,100,-20,0]])test(`all computed Hermitian modes satisfy Lv=λv: ${angles}`,()=>{
 const s=graphState(angles),snapshot=JSON.stringify(s);
 for(let k=0;k<5;k++){const m=gainEigenmode(s,k);near(Math.hypot(...m.vector.flat()),1);assert(m.residual<1e-10,m.residual);near(m.eigenvalue,s.eigenvalues[k]);}
 assert.equal(JSON.stringify(s),snapshot);
});
test('mode inspection leaves the graph unchanged',()=>{const p={angles:[0,110,35,0,0,0,0],edge:1,angle:110,cycle:1};const a=evaluateNarrative('gain',1,{explore:p}),b=evaluateNarrative('gain',1,{explore:{...p,eigenmode:2}});assert.deepEqual(a.science,b.science);assert(b.inspection.residual<1e-10);assert.equal(b.visual.cycle,1);});
test('different edges retain their angles rather than resetting on selection',()=>{const angles=[0,110,-70,0,0,0,0];for(const edge of [1,2]){const f=evaluateNarrative('gain',1,{explore:{angles,edge,angle:angles[edge]}});assert.deepEqual(f.science.angles,angles);}const s=graphState(angles);assert.equal(graphState(s.repair.target).inconsistent,0);});
test('matrix and spectrum are disclosed in distinct narrative beats',()=>{const m=evaluateNarrative('gain',.6),s=evaluateNarrative('gain',.8);assert(m.reveal.operator>.95);assert.equal(m.reveal.spectrum,0);assert(s.reveal.spectrum>.95);assert(m.science.angles[1]===110);});
test('relaxing actual recovery constraints creates a rank-two intersection',()=>{const strict=rankState(2,.6),rules=recoveryConstraints(constraints,1.1),loose=rankState(2,.6,rules);assert(!strict.feasible);assert(loose.feasible);near(loose.repair[2],0);near(loose.repair[0],.3);near(loose.repair[1],.65);for(const c of rules)assert(dot(c.n,loose.repair)>=c.b-1e-9);assert.deepEqual(constraints.map(c=>c.b),[1.4,.7,.65]);});
test('every rendered rank-two region vertex lies in the solver subspace and satisfies its inequalities',()=>{const rules=recoveryConstraints(constraints,1.1),geo=feasibleGeometry(rules,2),p=geo.attributes.position;assert(p.count>0);for(let i=0;i<p.count;i++){const v=[p.getX(i),p.getY(i),p.getZ(i)];near(v[2],0);for(const c of rules)assert(dot(c.n,v)>=c.b-1e-6);}geo.dispose();});
test('threshold boundary is not a decorative volume',()=>{for(const e of[0,.3,.7,1.0])assert(!rankState(2,.6,recoveryConstraints(constraints,e)).feasible);assert(rankState(2,.6,recoveryConstraints(constraints,1.05)).feasible);});
test('CasePath actually goes READY -> HOLD -> reviewed admissibility',()=>{const a=caseAt(1),b=caseAt(3),c=caseAt(5);assert(a.nodes.gate.value);assert(!b.nodes.gate.value);assert(c.nodes.gate.value);assert.equal(b.review,null);assert(a.events.some(e=>e.includes('Initial reviewer')));assert.equal(a.nodes.invoice.version,c.nodes.invoice.version);assert.deepEqual(a.source,c.source);});
test('semantic progress maps to new viewport anchors without loss',()=>{for(const p of[0,.019,.371,.5,.89,1])for(const anchors of[[400,1000,1600,2200,2800,3400],[680,1450,2270,3000,3940,4790]])near(progressFromAnchors(positionAtProgress(p,anchors),anchors),p);});
test('each authored chapter states reader change, attention and camera intent',()=>{const valid=new Set(['localize','follow','reveal context','compare','transition','release']);for(const s of Object.values(stories))for(const c of s.chapters){assert(valid.has(c.cameraIntent));assert(c.readerStateIn&&c.readerStateOut);assert(c.attention.primary&&c.attention.secondary&&c.attention.hidden);}});
