/* Qualitative motor model: fixed upward B, theta=0 is a vertical coil.
   Half-scraped shaft interrupts current; it never reverses the battery current. */
(function(root){
'use strict';
const TAU=2*Math.PI;
function contact(pattern,theta){
 if(pattern==='full')return 1;
 if(pattern==='none')return 0;
 const phase=pattern==='front'?Math.PI/2:0;
 // A narrow insulating transition avoids numerical chatter at the contact edge.
 return Math.max(0,Math.min(1,Math.cos(theta-phase)/.025));
}
function force(state,cfg){
 const gate=cfg.power?Math.min(contact(cfg.left,state.theta),contact(cfg.right,state.theta)):0;
 const current=gate*cfg.battery;
 const torque=8*cfg.field*current*Math.cos(state.theta);
 return {gate,current,torque};
}
function advance(state,cfg,dt){
 const n=Math.max(1,Math.ceil(dt/.001)); const h=dt/n;
 for(let i=0;i<n;i++){
  const f=force(state,cfg), drag=cfg.friction*state.omega;
  state.omega+=(f.torque-drag)*h;
  state.theta+=state.omega*h; state.time+=h;
  if(Math.abs(state.omega)<.0005&&Math.abs(f.torque)<.002)state.omega=0;
 }
 return force(state,cfg);
}
const api={contact,force,advance,TAU};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
else root.MotorModel=api;
})(typeof globalThis!=='undefined'?globalThis:this);
