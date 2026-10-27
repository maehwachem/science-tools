// NODE_PATH=<jsdom 26 installation>/node_modules node lab-tools/tests/visual-instructions.cjs
const {JSDOM,VirtualConsole}=require('jsdom');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
const dom=new JSDOM(fs.readFileSync(path.join(__dirname,'../index.html'),'utf8'),{url:'https://lab-test.example/',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){w.matchMedia=()=>({matches:true,addEventListener(){}});w.scrollTo=()=>{};}});
const w=dom.window,prep=w.LAB_PREPARATION,practice=w.LAB_PRACTICE,parser=new w.DOMParser();
function frame(id,step,t=1){const s=practice.create(id);s.stage=step+1;return w.LAB_MOTION.frame({id,step,state:s,mode:'guide'},t);}
function xml(svg){assert(!/NaN|undefined|Infinity/.test(svg));const d=parser.parseFromString(svg,'image/svg+xml');assert.equal(d.querySelector('parsererror'),null);assert(d.documentElement.tagName==='svg');return d;}
// Follow the actual selection reducer: each compatible filler works alone; combinations never advance.
for(const id of ['aliquot','dilution']){
 const task=prep.tasks.find(t=>t.id===id),groups=prep.groups(task),others=groups.filter(g=>!g.any.includes('pump')).map(g=>g.any[0]);
 for(const fillers of [[],['pump'],['filler'],['controller'],['pump','filler'],['pump','controller'],['filler','controller'],['pump','filler','controller']]){
  let s=prep.create(id);for(const tool of [...others,...fillers])s=prep.reduce(s,'select',tool);s=prep.reduce(s,'check-tools');assert.equal(s.stage,fillers.length===1?1:0,id+': '+fillers);if(fillers.length>1)assert.match(s.feedback,/여러 종류/);
 }
 console.log('PASS single filler acceptance and all multi-filler rejections:',id);
}
// Verify the rendered activity, not just its source strings, keeps stock solution context through the steps.
w.LAB_PREP_UI.show('dilution');
const d=prep.tasks.find(t=>t.id==='dilution');
for(const g of prep.groups(d))w.document.querySelector(`[data-prep-action="select"][data-value="${g.any[0]}"]`).click();
w.document.querySelector('[data-prep-action="check-tools"]').click();
for(const op of d.ops){
 const body=w.document.querySelector('.prep-step-body').textContent;
 if(['attach','aspirate','align','deliver'].includes(op.action)){assert.match(body,/원액/);assert(!/물속|물 표면/.test(body));}
 w.document.querySelector(`[data-prep-action="operate"][data-value="${op.action}"]`).click();
 if(op.scene==='pipette'){const view=w.document.querySelector('#scenario-section').textContent;assert.match(view,/원액/);assert.match(view,/100 mL 부피 플라스크/);}
}
assert.match(w.document.querySelector('#scenario-section').textContent,/최종 용액의 부피: 100 mL/);
console.log('PASS dilution UI stock solution and final-volume context');
// Every guide must produce a valid finite SVG at endpoints and intermediate progress values.
let frames=0;
for(const l of practice.lessons){assert(l.steps.length);for(let k=0;k<l.steps.length;k++)for(const t of [0,.2,.5,.8,1]){const svg=frame(l.id,k,t);xml(svg);frames++;}}
assert.equal(practice.lessons.length,31);console.log('PASS valid guide SVG samples:',frames,'frames across 31 guides');
// A burette reading stays still. A graduated pipette first drains to its start mark outside the source.
for(const id of ['graduated','burette']){
 const readings=[];for(const step of [2,4]){const values=[0,.2,.5,.8,1].map(t=>Number(xml(frame(id,step,t)).querySelector('[data-liquid-reading]').getAttribute('data-liquid-reading')));if(id==='graduated'&&step===2){assert(values.at(-1)>values[0]);assert.equal(values.at(-1),1);for(let i=1;i<values.length;i++)assert(values[i]>=values[i-1]);}else assert.equal(new Set(values).size,1,id+' reading motion');readings.push(values.at(-1));}
 assert(readings[1]>readings[0]);assert(xml(frame(id,4)).querySelector('[data-liquid-reading]'));console.log('PASS stable initial/final meniscus and retained liquid:',id,readings.join(' -> '));
}
// A pipette must move as an instrument, not merely move its caption text.
for(const id of ['pipette','micropipette']){
 const step=id==='pipette'?3:5,first=xml(frame(id,step,0)),last=xml(frame(id,step,1));
 const shape=id==='pipette'?'path[d^="M-4 25h8"]':'rect[x="-26"]';
 function transforms(doc){let e=doc.querySelector(shape),a=[];assert(e,id+' instrument missing');for(;e;e=e.parentElement)if(e.getAttribute('transform'))a.push(e.getAttribute('transform'));return a.join('|');}
 assert.notEqual(transforms(first),transforms(last),id+' full instrument must transfer');
}
assert.deepEqual(errors,[]);w.close();console.log('PASS full-instrument transfers and no runtime errors');
