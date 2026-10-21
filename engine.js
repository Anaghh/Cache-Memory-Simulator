(function(root){
class CacheSimulator {
 constructor({size=32,block=8,mapping='direct',ways=2,policy='LRU'}={}){this.blockSize=block;this.policy=policy;this.lines=size/block;this.ways=mapping==='full'?this.lines:mapping==='direct'?1:Math.min(ways,this.lines);this.setCount=this.lines/this.ways;this.cache=Array.from({length:this.setCount},()=>Array.from({length:this.ways},()=>null));this.clock=0;this.hits=0;this.misses=0;}
 access(address){const block=Math.floor(address/this.blockSize),set=block%this.setCount,tag=Math.floor(block/this.setCount),offset=address%this.blockSize;this.clock++;const rows=this.cache[set];let way=rows.findIndex(x=>x&&x.tag===tag),hit=way!==-1,evicted=null;if(hit){this.hits++;rows[way].used=this.clock;}else{this.misses++;way=rows.findIndex(x=>!x);if(way<0){let key=this.policy==='LRU'?'used':'inserted';way=rows.reduce((best,x,i)=>x[key]<rows[best][key]?i:best,0);evicted=rows[way].block;}rows[way]={tag,block,used:this.clock,inserted:this.clock};}return {address,block,set,tag,offset,way,hit,evicted,hits:this.hits,misses:this.misses,cache:JSON.parse(JSON.stringify(this.cache))};}
}
root.CacheSimulator=CacheSimulator;if(typeof module!=='undefined')module.exports=CacheSimulator;
})(typeof window!=='undefined'?window:globalThis);
