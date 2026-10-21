/* Cache Lab: deterministic educational models. No external dependencies. */
(function(root){
'use strict';
const clone=x=>JSON.parse(JSON.stringify(x));
const POLICIES=['LRU','FIFO','LFU','Random','MRU','Optimal','PLRU','ARC'];
function parseTrace(text,{writes=true}={}){
 const tokens=text.trim().split(/[\s,;]+/).filter(Boolean);
 if(!tokens.length||tokens.length>256)throw Error('Enter 1–256 accesses.');
 return tokens.map(token=>{const m=/^(?:([RIW]):)?(0x[\da-f]+|\d+)(?:=(0x[\da-f]+|\d+))?$/i.exec(token);if(!m)throw Error(`Invalid access “${token}”. Use R:16, I:0x20, or W:8=42.`);const op=(m[1]||'R').toUpperCase(),address=Number(m[2]),value=m[3]===undefined?1:Number(m[3]);if(address>65535||value>255)throw Error('Addresses must be 0–65535 and byte values 0–255.');if(m[3]!==undefined&&op!=='W')throw Error('Only W accesses accept a value.');if(!writes&&op==='W')throw Error('This lab accepts read/instruction accesses only. Try R:0, R:8, R:0.');return {op,address,value};});
}
class ARCSet{
 constructor(capacity){this.c=capacity;this.p=0;this.T1=[];this.T2=[];this.B1=[];this.B2=[];}
 remove(list,x){const i=list.indexOf(x);if(i>=0)list.splice(i,1);}
 touch(x){this.remove(this.T1,x);this.remove(this.T2,x);this.T2.unshift(x);}
 replace(x){let list,ghost;if(this.T1.length&&(this.T1.length>this.p||(this.B2.includes(x)&&this.T1.length===this.p))){list=this.T1;ghost=this.B1;}else{list=this.T2;ghost=this.B2;}const victim=list.pop();if(victim!==undefined)ghost.unshift(victim);return victim;}
 miss(x){let victim;
  if(this.B1.includes(x)){this.p=Math.min(this.c,this.p+Math.max(1,this.B2.length/this.B1.length));victim=this.replace(x);this.remove(this.B1,x);this.T2.unshift(x);}
  else if(this.B2.includes(x)){this.p=Math.max(0,this.p-Math.max(1,this.B1.length/this.B2.length));victim=this.replace(x);this.remove(this.B2,x);this.T2.unshift(x);}
  else{if(this.T1.length+this.B1.length===this.c){if(this.T1.length<this.c){this.B1.pop();victim=this.replace(x);}else victim=this.T1.pop();}
   else if(this.T1.length+this.B1.length<this.c){const total=this.T1.length+this.T2.length+this.B1.length+this.B2.length;if(total>=this.c){if(total===2*this.c)this.B2.pop();victim=this.replace(x);}}
   this.T1.unshift(x);
  }return victim;
 }
}
class CacheSimulator{
 constructor({size=32,block=8,mapping='direct',ways=2,policy='LRU',writePolicy='WB',allocate=true,seed=42,memory=null}={}){
  if(!Number.isInteger(size)||!Number.isInteger(block)||size<block||size%block||!Number.isInteger(Math.log2(size))||!Number.isInteger(Math.log2(block)))throw Error('Cache and block sizes must be powers of two; a block must fit in the cache.');
  if(!POLICIES.includes(policy)||!['direct','set','full'].includes(mapping)||!['WB','WT'].includes(writePolicy))throw Error('Unknown cache policy.');
  this.blockSize=block;this.lines=size/block;this.ways=mapping==='full'?this.lines:mapping==='direct'?1:Math.min(ways,this.lines);if(!Number.isInteger(Math.log2(this.ways))||this.ways<1)throw Error('Associativity must be a power of two.');
  this.setCount=this.lines/this.ways;this.policy=policy;this.writePolicy=writePolicy;this.allocate=allocate;this.seed=seed>>>0;this.memory=memory||new Map();this.cache=Array.from({length:this.setCount},()=>Array(this.ways).fill(null));this.trees=Array.from({length:this.setCount},()=>Array(this.ways-1).fill(0));this.arc=Array.from({length:this.setCount},()=>new ARCSet(this.ways));this.clock=0;this.hits=0;this.misses=0;this.reads=0;this.writes=0;this.writebacks=0;this.bytesRead=0;this.bytesWritten=0;this.seen=new Set();this.shadow=[];
 }
 random(){this.seed=(Math.imul(1664525,this.seed)+1013904223)>>>0;return this.seed/4294967296;}
 touchTree(set,way){let node=0,lo=0,hi=this.ways;while(hi-lo>1){const mid=(lo+hi)/2;if(way<mid){this.trees[set][node]=1;node=node*2+1;hi=mid;}else{this.trees[set][node]=0;node=node*2+2;lo=mid;}}}
 treeVictim(set){let node=0,lo=0,hi=this.ways;while(hi-lo>1){const mid=(lo+hi)/2;if(this.trees[set][node]===0){node=node*2+1;hi=mid;}else{node=node*2+2;lo=mid;}}return lo;}
 victim(set,future){const rows=this.cache[set];switch(this.policy){case 'Random':return Math.floor(this.random()*this.ways);case 'PLRU':return this.treeVictim(set);case 'Optimal':{let best=0,far=-1;rows.forEach((line,i)=>{let d=future.findIndex(x=>Math.floor((typeof x==='number'?x:x.address)/this.blockSize)===line.block);if(d<0)d=Infinity;if(d>far){far=d;best=i}});return best;}
  default:return rows.reduce((best,line,i)=>{const a=rows[best];if(this.policy==='LFU')return line.frequency<a.frequency||(line.frequency===a.frequency&&line.used<a.used)?i:best;if(this.policy==='MRU')return line.used>a.used?i:best;const k=this.policy==='FIFO'?'inserted':'used';return line[k]<a[k]?i:best;},0);}}
 writeMemory(address,value){this.memory.set(address,value);this.writes++;this.bytesWritten++;}
 access(input,{future=[]}={}){const {op='R',address,value=1}=typeof input==='number'?{address:input}:input;if(!Number.isInteger(address)||address<0||address>65535||!['R','I','W'].includes(op)||!Number.isInteger(value)||value<0||value>255)throw Error('Invalid memory access.');
  const block=Math.floor(address/this.blockSize),set=block%this.setCount,tag=Math.floor(block/this.setCount),offset=address%this.blockSize,rows=this.cache[set];this.clock++;
  let way=rows.findIndex(x=>x&&x.tag===tag),hit=way>=0,evicted=null,writeback=false,bypass=false;
  const missType=hit?null:!this.seen.has(block)?'Compulsory':this.shadow.includes(block)?'Conflict / policy':'Capacity';
  this.seen.add(block);this.shadow=this.shadow.filter(x=>x!==block);this.shadow.unshift(block);this.shadow.length=Math.min(this.shadow.length,this.lines);
  if(hit){this.hits++;rows[way].used=this.clock;rows[way].frequency++;if(this.policy==='ARC')this.arc[set].touch(block);}
  else{this.misses++;if(op==='W'&&!this.allocate){bypass=true;this.writeMemory(address,value);}
   else{if(this.policy==='ARC'){const victim=this.arc[set].miss(block);way=victim===undefined?rows.findIndex(x=>!x):rows.findIndex(x=>x&&x.block===victim);}
    else{way=rows.findIndex(x=>!x);if(way<0)way=this.victim(set,future);}
    if(way<0)throw Error('Replacement state is inconsistent.');
    if(rows[way]){evicted=rows[way].block;if(rows[way].dirty){writeback=true;this.writebacks++;this.writes++;this.bytesWritten+=this.blockSize;rows[way].data.forEach((v,i)=>this.memory.set(evicted*this.blockSize+i,v));}}
    this.reads++;this.bytesRead+=this.blockSize;rows[way]={tag,block,used:this.clock,inserted:this.clock,frequency:1,dirty:false,data:Array.from({length:this.blockSize},(_,i)=>this.memory.get(block*this.blockSize+i)||0)};
   }
  }
  let returned=value;if(!bypass){const line=rows[way];this.touchTree(set,way);if(op==='W'){line.data[offset]=value;if(this.writePolicy==='WB')line.dirty=true;else this.writeMemory(address,value);}else returned=line.data[offset];}
  return {op,address,value:returned,block,set,tag,offset,way:bypass?null:way,hit,evicted,writeback,bypass,missType,hits:this.hits,misses:this.misses,cache:clone(this.cache),trees:clone(this.trees),arc:clone(this.arc),traffic:{reads:this.reads,writes:this.writes,writebacks:this.writebacks,bytesRead:this.bytesRead,bytesWritten:this.bytesWritten},memory:Array.from(this.memory.entries()).sort((a,b)=>a[0]-b[0])};
 }
}
class CacheLab{
 constructor(config){this.config=config;this.memory=new Map();this.split=config.organization==='split';this.banks=this.split?{I:new CacheSimulator({...config,memory:this.memory}),D:new CacheSimulator({...config,memory:this.memory})}:{Unified:new CacheSimulator({...config,memory:this.memory})};this.history=[];}
 access(input,future=[]){const bank=this.split?(input.op==='I'?'I':'D'):'Unified',f=future.filter(x=>!this.split||(x.op==='I')===(bank==='I'));const r=this.banks[bank].access(input,{future:f});const hits=Object.values(this.banks).reduce((n,b)=>n+b.hits,0),misses=Object.values(this.banks).reduce((n,b)=>n+b.misses,0);const traffic=Object.values(this.banks).reduce((a,b)=>{for(const k of Object.keys(a))a[k]+=b[k];return a},{reads:0,writes:0,writebacks:0,bytesRead:0,bytesWritten:0});const result={...r,bank,hits,misses,traffic,banks:Object.fromEntries(Object.entries(this.banks).map(([k,b])=>[k,{cache:clone(b.cache),trees:clone(b.trees),arc:clone(b.arc)}]))};this.history.push(result);return result;}
}
class HierarchySimulator{
 constructor({sizes=[32,64,128],block=8,mapping='set',ways=2,policy='LRU',latencies=[1,5,15],memoryTime=100}={}){if(sizes.some((s,i)=>i&&s<sizes[i-1]))throw Error('Each lower cache must be at least as large as the cache above it.');if(latencies.some(x=>!Number.isFinite(x)||x<=0)||!Number.isFinite(memoryTime)||memoryTime<=0)throw Error('Latencies must be positive.');if(policy==='Optimal')throw Error('Optimal is only available in the single-level lab.');this.levels=sizes.map(size=>new CacheSimulator({size,block,mapping,ways,policy}));this.latencies=latencies;this.memoryTime=memoryTime;this.total=0;this.accesses=0;this.memoryReads=0;}
 access(input){if(input.op==='W')throw Error('Hierarchy lab models read accesses.');let source=this.levels.length,path=[],time=0;for(let i=0;i<this.levels.length;i++){time+=this.latencies[i];const r=this.levels[i].access(input);path.push({level:i+1,hit:r.hit});if(r.hit){source=i;break;}}if(source===this.levels.length){time+=this.memoryTime;this.memoryReads++;}this.accesses++;this.total+=time;return {source:source===this.levels.length?'RAM':'L'+(source+1),path,time,total:this.total,average:this.total/this.accesses,accesses:this.accesses,memoryReads:this.memoryReads,levels:this.levels.map(c=>({cache:clone(c.cache),hits:c.hits,misses:c.misses}))};}
}
class TLBSimulator{
 constructor({entries=4,pageSize=4096,mappings={0:3,1:7,2:1,3:9,4:2,5:12},policy='LRU'}={}){this.capacity=entries;this.pageSize=pageSize;this.mappings=mappings;this.policy=policy;this.rows=[];this.clock=0;this.hits=0;this.misses=0;this.faults=0;}
 access(address){const vpn=Math.floor(address/this.pageSize),offset=address%this.pageSize;this.clock++;let row=this.rows.find(x=>x.vpn===vpn),hit=!!row,fault=false,evicted=null;if(hit){this.hits++;row.used=this.clock;}else{this.misses++;if(!Object.prototype.hasOwnProperty.call(this.mappings,vpn)){fault=true;this.faults++;}else{if(this.rows.length===this.capacity){const key=this.policy==='FIFO'?'inserted':'used';this.rows.sort((a,b)=>a[key]-b[key]);evicted=this.rows.shift().vpn;}row={vpn,frame:this.mappings[vpn],used:this.clock,inserted:this.clock};this.rows.push(row);}}return {address,vpn,offset,hit,fault,evicted,physical:fault?null:row.frame*this.pageSize+offset,frame:fault?null:row.frame,rows:clone(this.rows),hits:this.hits,misses:this.misses,faults:this.faults};}
}
class BTBSimulator{
 constructor({entries=4}={}){this.entries=entries;this.rows=Array(entries).fill(null);this.hits=0;this.correct=0;this.total=0;}
 access({pc,target,taken}){const index=Math.floor(pc/4)%this.entries,row=this.rows[index],hit=!!row&&row.pc===pc,predTaken=hit&&row.counter>=2,predicted=predTaken?row.target:pc+4,actual=taken?target:pc+4;this.total++;if(hit)this.hits++;if(predicted===actual)this.correct++;const counter=hit?Math.max(0,Math.min(3,row.counter+(taken?1:-1))):(taken?2:1);this.rows[index]={pc,target,counter};return {pc,target,taken,index,hit,predicted,actual,correct:predicted===actual,rows:clone(this.rows),hits:this.hits,correctCount:this.correct,total:this.total};}
}
class CoherenceSimulator{
 constructor(){this.cores=[new Map(),new Map()];this.memory=new Map();this.invalidations=0;}
 access({core,op,address,value=1}){const block=Math.floor(address/8),other=1-core,local=this.cores[core],peer=this.cores[other],hit=local.has(block);let invalidated=false;if(op==='W'){if(peer.delete(block)){invalidated=true;this.invalidations++;}this.memory.set(address,value);local.set(block,true);}else local.set(block,true);return {core,op,address,block,hit,invalidated,value:this.memory.get(address)||0,invalidations:this.invalidations,blocks:Array.from(new Set([...this.cores[0].keys(),...this.cores[1].keys()])).sort((a,b)=>a-b).map(b=>({block:b,states:this.cores.map(c=>!c.has(b)?'Invalid':this.cores.every(p=>p.has(b))?'Shared':'Exclusive (clean)')}))};}
}
const api={CacheSimulator,CacheLab,HierarchySimulator,TLBSimulator,BTBSimulator,CoherenceSimulator,parseTrace,POLICIES,ARCSet};Object.assign(root,api);if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
