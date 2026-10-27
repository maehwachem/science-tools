// Regression checks for the second scientific/visual audit.
const {JSDOM,VirtualConsole}=require('jsdom'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
const d=new JSDOM(fs.readFileSync(path.join(__dirname,'../index.html'),'utf8'),{url:'https://details.test/',runScripts:'dangerously',virtualConsole:vc,beforeParse(w){w.matchMedia=()=>({matches:true});w.HTMLElement.prototype.scrollIntoView=()=>{};}}),w=d.window;
const frame=(id,step,t,state={},previous)=>new w.DOMParser().parseFromString(w.LAB_MOTION.frame({id,step,state:{...w.LAB_PRACTICE.create(id),stage:step+1,...state},previous,mode:'guide'},t),'image/svg+xml');
assert.equal(w.LAB_TOOLS.find(x=>x.id==='boat').parts.length,2);
assert.match(w.LAB_TOOLS.find(x=>x.id==='retriever').caution,/가열했다면/);
for(const id of ['filler','pump','controller']){const l=w.LAB_PRACTICE.lessons.find(x=>x.id===id),f=frame(id,l.phases.indexOf('adjust'),1);assert(!f.documentElement.textContent.includes('조절액'));assert.equal(f.querySelectorAll('[data-vessel="open-beaker"]').length,2);assert.match(f.querySelector('[data-assembly]').getAttribute('transform'),/translate\(105 23\)/);}
for(const t of [.1,.4,.6,.9,1]){const f=frame('balance',2,t,{dish:true,tared:true,mass:0,stable:true});const value=f.querySelector('text[x="136"][y="233"]').textContent;assert(['8.20','0.00'].includes(value),value);}
const first=frame('dropper',4,0,{drops:1}),mid=frame('dropper',4,.8,{drops:1}),last=frame('dropper',4,1,{drops:1});
for(const f of [first,mid])assert(!f.querySelector('path[d^="M268 "]'),'receiver fills before arrival');assert(last.querySelector('path[d^="M268 "]'));
assert(!frame('balance',3,.5,{dish:true,tared:true,mass:200,stable:true}).querySelector('path[d="M108 224l4 4 6-8"]'));
assert.equal([...frame('graduated',4,1).querySelectorAll('text[y="345"]')].length,1);
assert(frame('pipette',3,1).querySelector('[data-horizontal-liquid]'));
const fp=frame('pipette',3,1,{receiverKind:'volflask'});assert(fp.querySelector('g[transform="translate(272 42) rotate(0 0 0)"]')||[...fp.querySelectorAll('g')].some(g=>g.getAttribute('transform')?.startsWith('translate(272 42)')),'bulb clears narrow neck');
assert(w.labDrawing('holder').includes('data-part="test-tube-holder"'));assert(frame('holder',1,1).querySelector('[data-part="test-tube-holder"]'));
// Sample the entire delivery: inverse-transform flow points into the tilted beaker.
for(let i=61;i<98;i++){
 const f=frame('pipette',3,i/100),flow=f.querySelector('[data-wall-flow]');
 if(!flow)continue;
 assert(flow.getAttribute('clip-path').includes('inclined-receiver'));
 const nums=flow.getAttribute('d').match(/-?\d+(?:\.\d+)?/g).map(Number);
 for(let j=0;j<nums.length;j+=2){const dx=nums[j]-265.4,dy=nums[j+1]-264,a=12*Math.PI/180,lx=265.4+dx*Math.cos(a)-dy*Math.sin(a),ly=264+dx*Math.sin(a)+dy*Math.cos(a);assert(lx>=265.4&&lx<=335.4,'flow crosses beaker wall');assert(ly>=246&&ly<=320,'flow outside receiver');}
 assert(![...f.querySelectorAll('path')].some(p=>/^M267 .*q-9 14/.test(p.getAttribute('d')||'')),'free drop outside tilted receiver');
}
for(const [k,t] of [[0,1],[1,.2],[1,.6],[1,1],[2,.3],[3,.5]])assert(frame('spatula',k,t).querySelector('[data-part="lab-spatula"]'),'spatula shape differs between steps');
assert(w.labDrawing('spatula').includes('data-part="lab-spatula"'));
assert.equal(frame('spatula',1,.1).querySelector('[data-spoon-loaded]').getAttribute('data-spoon-loaded'),'false');
assert.equal(frame('spatula',1,.8).querySelector('[data-spoon-loaded]').getAttribute('data-spoon-loaded'),'true');
assert.deepEqual(errors,[]);console.log('PASS dish, filler, conditional cooling, TARE/stability, drop arrival, labels, pipette clearance and shared holder');w.close();
