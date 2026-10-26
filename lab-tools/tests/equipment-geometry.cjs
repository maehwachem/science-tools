// NODE_PATH=<jsdom 26>/node_modules node lab-tools/tests/equipment-geometry.cjs
const {JSDOM,VirtualConsole}=require('jsdom');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
const d=new JSDOM(fs.readFileSync(process.env.LAB_HTML||path.join(__dirname,'../index.html'),'utf8'),{url:'https://geometry.example',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){w.matchMedia=()=>({matches:true,addEventListener(){}});w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};}});
const w=d.window,parser=new w.DOMParser();
function frame(id,step,t){const state=w.LAB_PRACTICE.create(id);state.stage=step+1;return parser.parseFromString(w.LAB_MOTION.frame({id,step,state,mode:'guide'},t),'image/svg+xml');}
const mul=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
function matrix(e){let m=[1,0,0,1,0,0],ancestry=[];for(;e&&e.getAttribute;e=e.parentElement)ancestry.unshift(e);for(const n of ancestry){for(const [,name,arg]of(n.getAttribute('transform')||'').matchAll(/(translate|scale|rotate)\(([^)]+)\)/g)){const v=arg.trim().split(/[ ,]+/).map(Number);let b;if(name==='translate')b=[1,0,0,1,v[0],v[1]||0];else if(name==='scale')b=[v[0],0,0,v[1]??v[0],0,0];else{const a=v[0]*Math.PI/180,c=Math.cos(a),s=Math.sin(a),x=v[1]||0,y=v[2]||0;b=[c,s,-s,c,x-c*x+s*y,y-s*x-c*y];}m=mul(m,b);}}return m;}
function point(e,x,y){const m=matrix(e);return [m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];}
// A liquid-filled dropper must leave the source mouth vertically before crossing its wall.
for(let n=0;n<=40;n++){const doc=frame('dropper',3,n/40),tip=doc.querySelector('path[d^="M-7 50H7"]'),p=point(tip,0,159);if(p[1]>197)assert(p[0]>71&&p[0]<148,'dropper must lift before lateral transfer');}
assert.equal(frame('boat',3,0).querySelector('[data-transfer-phase]').getAttribute('data-transfer-phase'),'lift');
console.log('PASS dropper vertical clearance and solid-transfer lift phase');
// The complete tip, not just its centre, must fit through each mouth at every sampled time.
let checks=0;
for(const step of [3,4,5,6,7])for(let n=0;n<=40;n++){
 const doc=frame('micropipette',step,n/40),tip=doc.querySelector('[data-part="tip"]')||doc.querySelector('path[d^="M-11 168h22"]');assert(tip,'micro tip missing');
 const half=tip.tagName==='path'?11:10,poly=[[-half,168],[half,168],[2,213],[-2,213]].map(([x,y])=>point(tip,x,y));
 const centre=point(tip,0,213),receiving=centre[0]>200;
 const bounds=receiving?[258.85,335.15]:[65.85,158.15];
 for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length];if(a[1]>=244){assert(a[0]>=bounds[0]-.1&&a[0]<=bounds[1]+.1,`tip crosses vessel wall step ${step}, t=${n/40}: ${a}`);}if((a[1]-244)*(b[1]-244)<0){const x=a[0]+(b[0]-a[0])*(244-a[1])/(b[1]-a[1]);assert(x>=bounds[0]&&x<=bounds[1],`tip intersects mouth rim: ${step}/${n}`);}}
 if(step===4)assert(centre[1]>279&&centre[1]<324,'aspiration tip shallowly inside source liquid');
 if(step===7){const depth=Number(doc.querySelector('[data-plunger-depth]').getAttribute('data-plunger-depth'));if(depth<17.99)assert(centre[1]<244,'release only after tip leaves receiving vessel');}
 checks++;
}
console.log('PASS entire-tip clearance and held withdrawal:',checks,'frames');
const micro=(t)=>frame('micropipette',6,t).querySelector('[data-plunger-depth]');
assert(Number(micro(.3).getAttribute('data-plunger-depth'))>0);
assert.equal(Number(micro(.5).getAttribute('data-plunger-depth')),10);
assert(Number(micro(.9).getAttribute('data-plunger-depth'))>10);
assert(Number(micro(.9).getAttribute('data-liquid-fraction'))<Number(micro(.5).getAttribute('data-liquid-fraction')));
console.log('PASS first stop, dwell and second-stop residual discharge');
for(const step of [0,1,2,3,4])for(const t of [0,.25,.5,.75,1]){
 const doc=frame('burette',step,t);for(const part of ['graduated-tube','stopcock-body','stopcock-handle','outlet-tube','padded-clamp'])assert(doc.querySelector(`[data-part="${part}"]`),part);
 assert(doc.querySelector('[data-burette-opening]'));
 for(const mark of doc.querySelectorAll('[data-scale="main"]')){const nums=mark.getAttribute('d').match(/-?\d+(?:\.\d+)?/g).map(Number);assert(nums[0]>=187&&nums[2]<=221,'scale printed on the glass');}
 if(step===2||step===4){const reading=Number(doc.querySelector('[data-liquid-reading]').getAttribute('data-liquid-reading'));const labels=[...doc.querySelector('[data-scale-inset]').querySelectorAll('text')].map(e=>e.textContent);assert(labels.includes(reading.toFixed(1)),'inset and main reading match');assert(doc.documentElement.textContent.includes(reading.toFixed(2)+' mL'));}
}
assert(w.labDrawing('burette').includes('data-burette-opening'));
assert(w.labDrawing('micropipette').includes('data-tip-opening'));
console.log('PASS shared open burette/tip, internal marks and matching reading inset');
for(const id of ['filler','pump','controller']){
 const lesson=w.LAB_PRACTICE.lessons.find(l=>l.id===id),k=lesson.phases.indexOf('dispense');
 const first=frame(id,k,0).querySelector('[data-assembly="filler-pipette"]'),last=frame(id,k,1).querySelector('[data-assembly="filler-pipette"]');assert.notEqual(first.getAttribute('transform'),last.getAttribute('transform'));
 const rest=frame(id,lesson.phases.indexOf('detach'),1);assert(rest.querySelector('[data-part="attached-pipette"]'));
 assert(!frame(id,k,.5).querySelector('.filler-finger'));
}
console.log('PASS auxiliary pipette assemblies transfer between two distinct vessels');
for(const l of w.LAB_PRACTICE.lessons)for(let k=0;k<l.steps.length;k++)for(const t of [0,.25,.5,.75,1]){
 const doc=frame(l.id,k,t);assert(!doc.querySelector('parsererror'));assert(!/NaN|undefined|Infinity|\$\{/.test(doc.documentElement.outerHTML),l.id+'/'+k);
 assert(!doc.querySelector('[fill="#efd5b7"],[fill="#f0d4b5"],[fill="#eed3b3"]'),'old disembodied hand fragments removed');
}
console.log('PASS all 31 guides: 730 valid geometry frames and no capsule hand fragments');
assert.deepEqual(errors,[]);w.close();
