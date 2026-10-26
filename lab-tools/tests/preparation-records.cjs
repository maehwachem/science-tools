// Run with jsdom 26 installed (for example: NODE_PATH=/tmp/lab-audit-deps/node_modules node lab-tools/tests/preparation-records.cjs).
const {JSDOM,VirtualConsole}=require('jsdom');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const advancedKey='kje-lab-preparation-v1',basicKey='kje-lab-scenario-v1';
const old='저울과 부피를 확인한 이전 완료 기록';
function open(seed={}){
 const errors=[],downloads=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
 const dom=new JSDOM(html,{url:'https://lab-test.example/',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
  w.matchMedia=()=>({matches:false,addEventListener(){}});w.scrollTo=()=>{};
  w.URL.createObjectURL=b=>{downloads.push(b);return 'blob:test';};w.URL.revokeObjectURL=()=>{};w.HTMLAnchorElement.prototype.click=function(){};
  for(const [k,v]of Object.entries(seed))w.localStorage.setItem(k,typeof v==='string'?v:JSON.stringify(v));
 }});assert.deepEqual(errors,[]);return {dom,w:dom.window,doc:dom.window.document,downloads};
}
const meta=open();const tasks=meta.w.LAB_PREPARATION.tasks.map(t=>({id:t.id,selected:meta.w.LAB_PREPARATION.groups(t).map(g=>g.any[0])}));meta.dom.window.close();
let cases=0;
for(const {id,selected}of [{id:'basic'},...tasks]){
 const key=id==='basic'?basicKey:advancedKey;
 const record=id==='basic'?{complete:true,reflection:old}:{[id]:{complete:true,reflection:old,selected,date:'2026-10-26T00:00:00.000Z'}};
 const h=open({[key]:record}),{w,doc}=h;const q=s=>doc.querySelector(s),click=s=>{assert(q(s),s);q(s).click();};
 w.LAB_PREP_UI.show(id);click('[data-scenario-action="saved"]');
 const input=q(id==='basic'?'#scenario-reflection':'#prep-reflection-text');assert(input);input.focus();
 const downloadSelector=id==='basic'?'[data-scenario-action="download"]':'[data-prep-action="download"]';
 assert(q(downloadSelector));click(downloadSelector);assert.equal(h.downloads.length,1);
 input.value='한글 조합 중 수정한 새 기록';input.setSelectionRange(5,5);input.dispatchEvent(new w.InputEvent('input',{bubbles:true,isComposing:true,inputType:'insertCompositionText'}));
 assert.equal(doc.activeElement,input);assert.equal(input.selectionStart,5);assert.equal(q(downloadSelector),null);assert.equal(q('.scenario-complete'),null);
 assert.equal(w.localStorage.getItem(key),JSON.stringify(record));
 // Defensive download check: an old/forged button must not export a dirty draft.
 const stale=doc.createElement('button');if(id==='basic')stale.dataset.scenarioAction='download';else stale.dataset.prepAction='download';q('#scenario-section').append(stale);stale.click();stale.remove();assert.equal(h.downloads.length,1);
 let form=q(id==='basic'?'#scenario-reflect':'#prep-reflection');form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));assert(q(downloadSelector));click(downloadSelector);assert.equal(h.downloads.length,2);
 const newStored=w.localStorage.getItem(key);assert(newStored.includes('한글 조합 중 수정한 새 기록'));
 if(id!=='basic'){
  const checkbox=q('[data-prep-check="0"]');checkbox.focus();checkbox.click();assert.equal(doc.activeElement,checkbox);assert.equal(q(downloadSelector),null);assert.equal(q('.scenario-complete'),null);
  q('#prep-reflection').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));assert.equal(q(downloadSelector),null);assert.equal(w.localStorage.getItem(key),newStored);
  q('[data-prep-check="0"]').click();
  q('#prep-reflection').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));assert(q(downloadSelector));
 }
 // Switching activities retains this draft and never marks it complete again.
 const draftInput=q(id==='basic'?'#scenario-reflection':'#prep-reflection-text');
 draftInput.value='활동별 초안';draftInput.dispatchEvent(new w.Event('input',{bubbles:true}));
 w.LAB_PREP_UI.show(id==='basic'?'micro':'basic');w.LAB_PREP_UI.show(id);
 assert.equal(q(id==='basic'?'#scenario-reflection':'#prep-reflection-text').value,'활동별 초안');assert.equal(q(downloadSelector),null);
 // Unsaved edits never overwrite the previous completed record, including after refresh.
 const currentInput=q(id==='basic'?'#scenario-reflection':'#prep-reflection-text');currentInput.value='아직 저장하지 않은 초안';currentInput.dispatchEvent(new w.Event('input',{bubbles:true}));
 const persisted=w.localStorage.getItem(key);assert(!persisted.includes('아직 저장하지 않은 초안'));w.close();
 const reopened=open({[key]:persisted});reopened.w.LAB_PREP_UI.show(id);reopened.doc.querySelector('[data-scenario-action="saved"]').click();assert.equal(reopened.doc.querySelector(id==='basic'?'#scenario-reflection':'#prep-reflection-text').value,'한글 조합 중 수정한 새 기록');reopened.w.close();
 cases++;console.log('PASS save/edit/check/download/reopen:',id);
}
// Every advanced activity must still be completable through its actual model sequence.
const h=open();assert.equal(h.w.LAB_TOOLS.length,31);assert.equal(h.w.LAB_PRACTICE.lessons.length,31);assert.equal(new Set(h.w.LAB_TOOLS.map(t=>t.id)).size,31);
for(const t of h.w.LAB_TOOLS){assert(h.w.labDrawing(t.id).includes('<svg'));assert(h.w.LAB_PRACTICE.lessons.some(l=>l.id===t.id),t.id);for(const id of t.related)assert(h.w.LAB_TOOLS.some(x=>x.id===id));}
console.log('PASS 31 tool/guide IDs, drawings and related links');for(const t of h.w.LAB_PREPARATION.tasks){let s=h.w.LAB_PREPARATION.create(t.id);const r=h.w.LAB_PREPARATION.reduce;
 for(const g of h.w.LAB_PREPARATION.groups(t))s=r(s,'select',g.any[0]);s=r(s,'check-tools');assert.equal(s.stage,1);
 for(const op of t.ops)s=r(s,'operate',{action:op.action,value:op.action==='set-volume'?100:undefined});assert.equal(s.stage,2,t.id);
 for(let i=0;i<t.checks.length;i++)s=r(s,'check',i);s=r(s,'finish','도구와 순서를 확인했습니다.');assert(h.w.LAB_PREPARATION.canDownload(s),t.id);
 s=r(s,'reflect','');assert(!h.w.LAB_PREPARATION.canDownload(s));s=r(s,'finish','');assert(!s.finished);
 console.log('PASS complete model and blank reflection guard:',t.id);
}h.w.close();console.log('PASS',cases,'record flows and 5 activity model flows');

function prepared(h,id){
 const {w,doc}=h,q=s=>doc.querySelector(s),click=s=>{assert(q(s),s);q(s).click();};w.LAB_PREP_UI.show(id);
 if(id==='basic'){
  for(const tool of ['balance','boat','spatula','cylinder','beaker','rod'])click(`[data-scenario-tool="${tool}"]`);
  click('[data-scenario-action="check-tools"]');
  for(const value of ['dish','settle','tare','add50','add50','add50','add50','settle','record'])click(`[data-scenario-action="balance"][data-value="${value}"]`);
  click('[data-scenario-action="next"]');click('[data-scenario-action="cylinder"][data-value="stand"]');click('[data-scenario-action="eye"][data-value="level"]');
  q('#scenario-answer').value='20';q('#scenario-volume').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));click('[data-scenario-action="next"]');
  for(const action of ['solid','water','stir','next'])click(`[data-scenario-action="${action}"]`);
 }else{
  const t=w.LAB_PREPARATION.tasks.find(t=>t.id===id);
  for(const g of w.LAB_PREPARATION.groups(t))click(`[data-prep-action="select"][data-value="${g.any[0]}"]`);
  click('[data-prep-action="check-tools"]');
  for(const op of t.ops){if(op.action==='set-volume'){q('#prep-micro-volume').value='100';q('#prep-volume').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));}else click(`[data-prep-action="operate"][data-value="${op.action}"]`);}
  for(const check of doc.querySelectorAll('[data-prep-check]'))check.click();
 }
}
function editAndSave(h,id,text){
 const {w,doc}=h;const input=doc.querySelector(id==='basic'?'#scenario-reflection':'#prep-reflection-text');input.value=text;input.dispatchEvent(new w.Event('input',{bubbles:true}));doc.querySelector(id==='basic'?'#scenario-reflect':'#prep-reflection').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
}
function readReflection(h,id){return h.doc.querySelector(id==='basic'?'#scenario-reflection':'#prep-reflection-text').value;}
function failWrites(h){const original=h.w.Storage.prototype.setItem;h.w.Storage.prototype.setItem=function(){throw new h.w.DOMException('Test quota exceeded','QuotaExceededError');};return ()=>{h.w.Storage.prototype.setItem=original;};}
for(const {id,selected}of [{id:'basic'},...tasks]){
 const key=id==='basic'?basicKey:advancedKey;
 const record=id==='basic'?{complete:true,reflection:old}:{[id]:{complete:true,reflection:old,selected,date:'2026-10-26T00:00:00.000Z'}};
 const h=open({[key]:record});h.w.LAB_PREP_UI.show(id);h.doc.querySelector('[data-scenario-action="saved"]').click();const recover=failWrites(h);
 editAndSave(h,id,'저장에 실패한 새 초안');assert.equal(h.w.localStorage.getItem(key),JSON.stringify(record));assert.match(h.doc.querySelector('#scenario-record-status').textContent,/저장/);
 const dl=h.doc.querySelector(id==='basic'?'[data-scenario-action="download"]':'[data-prep-action="download"]');assert(dl);dl.click();assert.equal(h.downloads.length,1);
 h.doc.querySelector('[data-scenario-action="saved"]').click();assert.equal(readReflection(h,id),old,'Failed write must not replace last saved record: '+id);
 recover();editAndSave(h,id,'재시도에 성공한 완료 기록');const stored=h.w.localStorage.getItem(key);assert(stored.includes('재시도에 성공한 완료 기록'));h.w.close();
 const again=open({[key]:stored});again.w.LAB_PREP_UI.show(id);again.doc.querySelector('[data-scenario-action="saved"]').click();assert.equal(readReflection(again,id),'재시도에 성공한 완료 기록');again.w.close();
 // No prior record: a failed first completion must not create a saved-record badge.
 const first=open();prepared(first,id);const retry=failWrites(first);editAndSave(first,id,'첫 기록 저장 실패');assert.equal(first.w.localStorage.getItem(key),null);assert(first.doc.querySelector('#scenario-saved').hidden);assert(!first.doc.querySelector(`[data-preparation="${id}"]`).textContent.includes('기록 있음'));
 retry();editAndSave(first,id,'첫 기록 재저장 성공');assert(!first.doc.querySelector('#scenario-saved').hidden);assert(first.w.localStorage.getItem(key).includes('첫 기록 재저장 성공'));first.w.close();
 console.log('PASS failed save preserves old record; retry and first-save recovery:',id);
}
// A failed draft must never be silently committed when another activity saves.
const a=tasks[0],b=tasks[1],recordFor=t=>({complete:true,reflection:old,selected:t.selected,date:'2026-10-26T00:00:00.000Z'});
const records={[a.id]:recordFor(a),[b.id]:recordFor(b)},multi=open({[advancedKey]:records});multi.w.LAB_PREP_UI.show(a.id);multi.doc.querySelector('[data-scenario-action="saved"]').click();const recoverMulti=failWrites(multi);editAndSave(multi,a.id,'A 저장 실패');recoverMulti();multi.w.LAB_PREP_UI.show(b.id);multi.doc.querySelector('[data-scenario-action="saved"]').click();editAndSave(multi,b.id,'B 저장 성공');let storedMulti=JSON.parse(multi.w.localStorage.getItem(advancedKey));assert.deepEqual(storedMulti[a.id],JSON.parse(JSON.stringify(records[a.id])));assert.equal(storedMulti[b.id].reflection,'B 저장 성공');const preservedB=JSON.stringify(storedMulti[b.id]);multi.w.LAB_PREP_UI.show(a.id);editAndSave(multi,a.id,'A 재저장 성공');storedMulti=JSON.parse(multi.w.localStorage.getItem(advancedKey));assert.equal(storedMulti[a.id].reflection,'A 재저장 성공');assert.equal(JSON.stringify(storedMulti[b.id]),preservedB);multi.w.close();console.log('PASS failed draft isolation between activities');
