import {computeWeights} from './weights.js';
self.onmessage=({data})=>{try{const result=computeWeights(data.positions,data.segments);self.postMessage(result,[result.indices.buffer,result.weights.buffer]);}catch(e){self.postMessage({error:e.message});}};
