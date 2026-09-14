import test from 'node:test';import assert from 'node:assert/strict';
import {placeAnnotation,overlaps} from '../modules/worlds/label-layout.mjs';
const base={width:350,height:300,labelWidth:160,labelHeight:42,x:240,y:100};
test('an unobstructed annotation remains attached at its preferred location',()=>{const r=placeAnnotation(base);assert.deepEqual(r,{left:160,top:58,right:320,bottom:100});});
test('wrapped mobile annotation clears the actual memory readout',()=>{const obstacles=[{left:170,top:9,right:340,bottom:94}];const r=placeAnnotation({...base,obstacles});assert(r&&!overlaps(r,obstacles[0]));assert(r.left>=12&&r.right<=338);});
test('panel and earlier-label intersections have a valid separated layout',()=>{const obstacles=[{left:200,top:8,right:345,bottom:125},{left:8,top:230,right:342,bottom:290}];const a=placeAnnotation({...base,obstacles});assert(a);const b=placeAnnotation({...base,x:160,y:190,obstacles:[...obstacles,a]});assert(b);for(const o of [...obstacles,a])assert(!overlaps(b,o));});
test('overcrowded viewport returns no misleading overlapped annotation',()=>{assert.equal(placeAnnotation({...base,obstacles:[{left:0,top:0,right:350,bottom:300}]}),null);});
