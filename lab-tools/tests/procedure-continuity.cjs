// NODE_PATH=<jsdom 26>/node_modules node lab-tools/tests/procedure-continuity.cjs
const {JSDOM,VirtualConsole}=require('jsdom');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
const dom=new JSDOM(fs.readFileSync(process.env.LAB_HTML||path.join(__dirname,'../index.html'),'utf8'),{url:'https://lab-test.example/',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){w.matchMedia=()=>({matches:true});w.HTMLElement.prototype.scrollIntoView=()=>{};}});
const w=dom.window,doc=w.document;
function frame(id,step,t,state={}){return new w.DOMParser().parseFromString(w.LAB_MOTION.frame({id,step,state:{...w.LAB_PRACTICE.create(id),stage:step+1,...state},mode:'guide'},t),'image/svg+xml');}
const pathData=e=>e?.getAttribute('d');
const liquid=f=>f.querySelector('[data-vessel] path[fill="#b7d7df"]');
// No accumulated fluid before the first stream reaches the receiver, then a rising level.
for(const id of ['flask','tube','beaker']){
 const a=frame(id,1,0),b=frame(id,1,.2),c=frame(id,1,1);
 assert.equal(a.querySelector('[fill="#b7d7df"]')?.getAttribute('height')||0,b.querySelector('[fill="#b7d7df"]')?.getAttribute('height')||0,id);
 assert(c.querySelector('[fill="#b7d7df"]'));assert(b.querySelector('[data-inflow]'));
}
for(const [id,k] of [['wash',2],['rod',2]]){
 assert.equal(pathData(liquid(frame(id,k,0))),pathData(liquid(frame(id,k,.2))),id+' rises before arrival');
 assert.notEqual(pathData(liquid(frame(id,k,0))),pathData(liquid(frame(id,k,1))),id+' must fill');
}
for(const id of ['funnel','paper'])assert(!frame(id,2,.2).querySelector('path[fill="#b7d7df"]'),'No early filtrate');
assert.equal(frame('volflask',1,.2).querySelector('[data-liquid-level]').getAttribute('data-liquid-level'),'291');
assert.equal(frame('volflask',1,0,{initialLiquid:true}).querySelector('[data-liquid-level]').getAttribute('data-liquid-level'),'270');
assert(!frame('pipette',0,0,{receiverKind:'volflask'}).querySelector('.flask-liquid'));
assert.equal(frame('pipette',3,1,{receiverKind:'volflask'}).querySelector('.flask-liquid').getAttribute('data-liquid-level'),'270');
assert.equal(pathData(liquid(frame('burette',2,1))),pathData(liquid(frame('burette',3,0))));
console.log('PASS delayed inflow and retained stock/receiver liquid');
// The pipette meniscus must begin adjustment where aspiration ended, then descend to the mark.
const pipeFluid=f=>[...f.querySelectorAll('path')].find(p=>p.getAttribute('fill')==='#9fcbd7');
assert.equal(pathData(pipeFluid(frame('pipette',1,1))),pathData(pipeFluid(frame('pipette',2,0))));
assert.notEqual(pathData(pipeFluid(frame('pipette',2,0))),pathData(pipeFluid(frame('pipette',2,1))));
// Sampling is deliberately dense near phase boundaries; a moving tip must clear a vessel's full rim.
for(const id of ['filler','pump','controller']){
 const lesson=w.LAB_PRACTICE.lessons.find(l=>l.id===id);
 for(const phase of ['adjust','dispense','detach'])for(let i=0;i<=100;i++){
  const f=frame(id,lesson.phases.indexOf(phase),i/100),g=f.querySelector('[data-assembly="filler-pipette"]');
  const [x,y]=g.getAttribute('transform').match(/translate\(([^)]+)/)[1].split(' ').map(Number),tip=y+297*.73;
  const between=x>153&&x<174||x>216&&x<246||x>324&&x<332;
  if(between)assert(tip<255,id+'/'+phase+' crosses wall at '+i);
  if(phase==='adjust'&&f.querySelector('[data-liquid-fraction]')?.getAttribute('data-liquid-fraction')<'1.000')assert(tip<255);
 }
 const asp=lesson.phases.indexOf('aspirate');assert(!frame(id,asp,.2).querySelector('[data-liquid-fraction]'));
}
for(let i=0;i<=100;i++){
 const f=frame('rack',3,i/100),tube=[...f.querySelectorAll('g')].find(g=>g.getAttribute('transform')?.startsWith('translate(')&&g.querySelector('path[d^="M197 91"]')&&g.parentElement.getAttribute('transform')==='translate(42 50) scale(.8)');
 assert(tube);const [x,y]=tube.getAttribute('transform').match(/translate\(([^)]+)/)[1].split(' ').map(Number);
 if(x>0)assert(300+y<179,'rack clearance');assert(50+.8*(91+y)>=0,'whole tube visible');
}
assert(frame('thermometer',2,1).querySelector('path[d="M235 269V215"]'));
for(const [t,y] of [[.5,135],[1,161]])assert(frame('micropipette',6,t).querySelector(`path[d="M54 ${y}L72 ${y}"]`));
assert.match(w.LAB_PRACTICE.lessons.find(l=>l.id==='stirbar').steps[3][1],/가열한 경우/);
console.log('PASS lifted transfers, visible rack extraction, temperature and both plunger stops');
// Fresh SVG instances never share clipping IDs, even when hidden panels stay in the DOM.
for(const id of ['pipette','volflask','rod','wash','funnel']){
 const a=frame(id,1,.5),b=frame(id,1,.5),ids=[...a.querySelectorAll('[id]'),...b.querySelectorAll('[id]')].map(e=>e.id);assert.equal(new Set(ids).size,ids.length);
}
doc.querySelector('[data-chapter="usage"]').click();
function select(id){const p=doc.querySelector('#practice-lesson-select');p.value=id;p.dispatchEvent(new w.Event('change',{bubbles:true}));}
let starts=0,options;const start=w.LAB_MOTION.start;w.LAB_MOTION.start=(n,o,p)=>{starts++;options=o;start(n,o,p);};
select('volflask');doc.querySelector('[data-step="4"]').click();const before=starts;doc.querySelector('[data-guide-reviewed]').click();doc.querySelector('[data-guide-reviewed]').click();assert.equal(starts,before);
select('dropper');doc.querySelector('[data-mode="practice"]').click();
for(const a of ['squeeze','dip','release','move','drop','drop','drop'])doc.querySelector(`[data-practice-action="${a}"]`).click();
doc.querySelector('[data-restart]').click();assert.equal(options.step,0);assert.equal(options.state.stage,0);assert.equal(options.previous,null);
for(const id of ['hotstirrer','micropipette']){select(id);doc.querySelector('[data-mode="practice"]').click();assert(!doc.querySelector('.scene-caption').textContent.includes('피펫을 연결'));if(id==='hotstirrer')assert(!doc.querySelector('.practice-drawing').textContent.includes('바닥에 세게'));}
console.log('PASS completion does not replay; restart and initial captions reset');
for(const id of ['micro','aliquot','dilution']){
 w.LAB_PREP_UI.show(id);const d=w.LAB_PREPARATION.tasks.find(t=>t.id===id);
 for(const g of w.LAB_PREPARATION.groups(d))doc.querySelector(`[data-prep-action="select"][data-value="${g.any[0]}"]`).click();
 doc.querySelector('[data-prep-action="check-tools"]').click();
 for(const op of d.ops){if(op.action==='set-volume'){doc.querySelector('#prep-micro-volume').value='100';doc.querySelector('#prep-volume').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));}else doc.querySelector(`[data-prep-action="operate"][data-value="${op.action}"]`).click();if(id==='micro'&&op.sceneStep===6)assert(doc.querySelector('#scenario-section [data-vessel="receiving-tube"]'));}
 assert(doc.querySelector('#scenario-section svg').textContent.includes('라벨'),id+' label missing');
}
console.log('PASS actual preparation UI receiving vessel, dilution and label illustrations');
assert.deepEqual(errors,[]);w.close();
