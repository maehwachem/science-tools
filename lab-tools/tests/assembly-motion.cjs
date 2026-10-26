// Regression for detached vessel layers, unrelated captions and disconnected cleaning scenes.
// Run with jsdom 26 available: NODE_PATH=<node_modules> node lab-tools/tests/assembly-motion.cjs [HTML]
const {JSDOM,VirtualConsole}=require('jsdom');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const file=process.argv[2]||path.join(__dirname,'../index.html'),errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
const dom=new JSDOM(fs.readFileSync(file,'utf8'),{url:'https://lab-test.example/',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){w.matchMedia=()=>({matches:true,addEventListener(){}});w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};}});
const w=dom.window,doc=w.document,parser=new w.DOMParser();
function frame(id,step,t){const state={...w.LAB_PRACTICE.create(id),stage:step+1};return parser.parseFromString(w.LAB_MOTION.frame({id,step,state,mode:'guide'},t),'image/svg+xml');}
// During placement, wall/liquid/bar must share the same moving coordinate system and liquid clip.
const moves=[];
for(const t of [0,.1,.25,.5,.75,.9,1]){
 const f=frame('hotstirrer',1,t),v=f.querySelector('[data-assembly="vessel"]');assert(v,'Placement needs one complete vessel assembly, not a moved outline');
 const wall=v.querySelector('[data-piece="wall"]'),liquid=v.querySelector('[data-piece="liquid"]'),bar=v.querySelector('rect[x="-18"]');assert(wall&&liquid&&bar,'Wall, water and stir bar all belong to the vessel');
 for(const part of [wall,liquid,bar]){assert.equal(part.closest('[data-assembly]'),v);assert.equal(part.getAttribute('transform'),null,'No independent layer movement');}
 const clipGroup=liquid.parentElement,ref=clipGroup.getAttribute('clip-path');assert.match(ref,/^url\(#.+\)$/);assert.equal(bar.parentElement,clipGroup,'Bar remains in the same clipped interior');assert(v.querySelector(`[id="${ref.slice(5,-1)}"]`));
 moves.push(v.getAttribute('transform'));
}
assert.notEqual(moves[0],moves.at(-1));assert(moves.some(x=>x!==moves[0]&&x!==moves.at(-1)));console.log('PASS moving vessel contains all layers at 7 intermediate positions');
// Different rendered SVGs in the same page must not share their interior clipping IDs.
const first=frame('hotstirrer',1,.4),second=frame('stirbar',2,.6),ids=[...first.querySelectorAll('[id]'),...second.querySelectorAll('[id]')].map(e=>e.id);assert.equal(ids.length,new Set(ids).size);
// Rotation changes direction/foreshortening inside the vessel; stopping removes the rotation symbol.
assert.notEqual(frame('stirbar',2,0).querySelector('[data-piece="stirbar"]').getAttribute('d'),frame('stirbar',2,.25).querySelector('[data-piece="stirbar"]').getAttribute('d'));
assert(!frame('hotstirrer',5,.5).querySelector('[data-piece="stirbar"]'));console.log('PASS distinct clip IDs, visible rotation and stopped-bar state');
// Actual guide UI: each selected step gets its own nearby instruction. Initial conditions are not repeated.
doc.querySelector('[data-chapter="usage"]').click();let checked=0;
for(const l of w.LAB_PRACTICE.lessons){let picker=doc.querySelector('#practice-lesson-select');picker.value=l.id;picker.dispatchEvent(new w.Event('change',{bubbles:true}));for(let k=0;k<l.steps.length;k++){
 doc.querySelector(`[data-step="${k}"]`).click();assert.equal(doc.querySelector('.scene-caption').textContent,l.steps[k][0],l.id+' caption');assert.equal(doc.querySelector('.scene-instruction').textContent,l.steps[k][1],l.id+' instruction');
 if(k>0)assert.equal(doc.querySelector('.practice-conditions'),null,'Do not repeat starting conditions at every step');assert.equal(doc.activeElement.id,'practice-title','Mobile step changes return focus to the visible workspace heading');assert(doc.querySelector('.practice-visual > .guide-navigation'),'Previous/next controls stay beside the graphic');checked++;
}}
console.log('PASS selected instruction beside graphic:',checked,'guide steps');
for(const [id,step]of [['retriever',4],['rod',3],['spatula',3]]){
 const f=frame(id,step,.5),water=f.querySelector('[data-cleaning-water]');assert(water);assert(f.querySelector(`[data-cleaning-target="${id}"]`));assert(f.querySelector('[data-cleaning-support]'));assert.match(water.getAttribute('d'),/M292 100V212/,'Water reaches the target at x292,y212');
 const end=frame(id,step,1);assert(!end.querySelector('[data-cleaning-water]'));assert.match(end.documentElement.textContent,/건조/);
}
for(const id of ['beaker','flask','tube']){const f=frame(id,3,.5);assert(!f.querySelector('[data-cleaning-water]'),'Container finishing scene shows supported drying, not an unrelated tap');assert(f.querySelector(`[data-cleaning-target="${id}"]`));}
assert.match(frame('retriever',3,.5).documentElement.textContent,/지정 폐액/);assert.deepEqual(errors,[]);w.close();console.log('PASS supported washing/drying and a designated waste container');
