import {mountGain,mountBounds} from './graph.mjs?v=scroll-4.2.2';
import {mountReplay,mountRank,mountNatural} from './geometry.mjs?v=scroll-4.2.2';
import {mountTime,mountUrban,mountInteraction} from './temporal.mjs?v=scroll-4.2.2';
import {mountCase} from './case.mjs?v=scroll-4.2.2';
import {mountSpatial} from './spatial.mjs?v=scroll-4.2.2';
const worlds={gain:mountGain,bounds:mountBounds,replay:mountReplay,rank:mountRank,natural:mountNatural,time:mountTime,urban:mountUrban,interaction:mountInteraction,case:mountCase,world:mountSpatial};
export function mountLivingWorld(work,root){const mount=worlds[work.mechanism];if(!mount)throw Error('Unknown scientific world.');return mount(root);}
