/* Trazabilidad visible de solicitudes de publicación — 06-10-2026 */
(function(){
'use strict';

function safe(v){
  const d=document.createElement('div');
  d.textContent=String(v??'');
  return d.innerHTML;
}
function stateClass(s){
  if(s==='Publicada')return 'green';
  if(s==='Devuelta')return 'amber';
  return '';
}
function groupRequests(){
  let reqs=[];
  try{reqs=typeof getPubRequests==='function'?(getPubRequests()||[]):[]}catch(e){reqs=[]}
  const groups=new Map();
  reqs.forEach(r=>{
    const key=(String(r.mesa||'').trim().toLowerCase()+'|'+String(r.titulo||'').trim().toLowerCase());
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(r);
  });
  groups.forEach(a=>a.sort((x,y)=>(Number(x.ciclo||1)-Number(y.ciclo||1))||(Number(x.id||0)-Number(y.id||0))));
  return groups;
}
function traceHTML(items){
  if(!items?.length)return '';
  const latest=items[items.length-1];
  const steps=items.map(r=>{
    const when=r.respondidaEn||r.fecha||'';
    const obs=r.observacion?(' · Obs.: '+r.observacion):'';
    return '<span class="pill '+stateClass(r.estado)+'" style="margin:4px 5px 2px 0">Ciclo '+safe(r.ciclo||1)+': '+safe(r.estado)+'</span>'+
      '<small style="display:block;margin:1px 0 5px 0">Versión '+safe(r.version||'')+(when?' · '+safe(when):'')+safe(obs)+'</small>';
  }).join('');
  return '<div class="publication-trace" style="margin-top:8px;padding-top:8px;border-top:1px dashed var(--line)">'+
    '<small><b>Trazabilidad:</b> estado actual: <span class="pill '+stateClass(latest.estado)+'">'+safe(latest.estado)+'</span></small>'+steps+'</div>';
}
function decorate(){
  const c=document.getElementById('admincontent');
  if(!c)return;
  const groups=groupRequests();
  let section='';
  [...c.children].forEach(el=>{
    if(el.tagName==='H2'){section=(el.textContent||'').trim();return;}
    if(!el.classList?.contains('row'))return;
    if(!/Documentos de Mesa pendientes|Solicitudes devueltas para corrección/i.test(section))return;
    const title=(el.querySelector('b')?.textContent||'').trim();
    if(!title)return;
    const small=el.querySelector('small');
    const mesaMatch=(small?.textContent||'').match(/Mesa\s+([^·]+)/i);
    const mesa=(mesaMatch?.[1]||'').trim();
    const key=(mesa.toLowerCase()+'|'+title.toLowerCase());
    const items=groups.get(key)||[];
    if(!items.length)return;
    const left=el.firstElementChild;
    if(!left||left.querySelector('.publication-trace'))return;
    left.insertAdjacentHTML('beforeend',traceHTML(items));
    const latest=items[items.length-1];
    if(/Solicitudes devueltas para corrección/i.test(section)&&latest.estado!=='Devuelta'){
      const pill=left.querySelector('.pill');
      if(pill){pill.textContent='Devuelta · ciclo anterior';pill.classList.remove('green');pill.classList.add('amber');}
      const status=document.createElement('div');
      status.style.marginTop='6px';
      status.innerHTML='<small><b>Estado vigente del documento:</b> <span class="pill '+stateClass(latest.estado)+'">'+safe(latest.estado)+'</span></small>';
      left.appendChild(status);
    }
  });
}

const base=window.adminPublicaciones;
if(typeof base==='function'){
  window.adminPublicaciones=async function(){
    const r=await base.apply(this,arguments);
    decorate();
    return r;
  };
}
})();
