import {mountGain,mountBounds} from './graph.mjs';
import {mountReplay,mountRank,mountNatural} from './geometry.mjs';
import {mountTime,mountUrban,mountInteraction} from './temporal.mjs';
import {mountCase} from './case.mjs';
import {mountSpatial} from './spatial.mjs';
const worlds={gain:mountGain,bounds:mountBounds,replay:mountReplay,rank:mountRank,natural:mountNatural,time:mountTime,urban:mountUrban,interaction:mountInteraction,case:mountCase,world:mountSpatial};
export function mountLivingWorld(work,root){const mount=worlds[work.mechanism];if(!mount)throw Error('Unknown scientific world.');return mount(root);}
