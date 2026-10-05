/* Edición directa de solicitudes devueltas — 05-10-2026 */
(function(){
'use strict';

const CTX_KEY='frentePT_returned_correction_context';
const originalGetAssignedMesas=window.getAssignedMesas;
const originalRenderEspacio=window.renderEspacio;
const originalAdminSolicitudes=window.adminSolicitudes;
const originalIrAAdministracion=window.irAAdministracion;

function isAdmin(){
  return !!window.currentUser && ['Administrador General','Administrador de Plataforma'].includes(String(currentUser.rol||''));
}
function readCtx(){
  try{return JSON.parse(sessionStorage.getItem(CTX_KEY)||'null')}catch(e){return null}
}
function writeCtx(x){
  try{sessionStorage.setItem(CTX_KEY,JSON.stringify(x))}catch(e){}
}
function clearCtx(){
  try{sessionStorage.removeItem(CTX_KEY)}catch(e){}
}
function safe(s){
  if(typeof window.esc==='function')return window.esc(String(s??''));
  return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

/* Administración puede abrir directamente la Mesa devuelta para corregirla.
   Se agrega solo la Mesa del contexto de corrección y no se altera ninguna asignación real. */
window.getAssignedMesas=function(){
  const base=typeof originalGetAssignedMesas==='function'?(originalGetAssignedMesas.apply(this,arguments)||[]):[];
  const ctx=readCtx();
  if(isAdmin()&&ctx?.mesa&&!base.includes(ctx.mesa))return [...base,ctx.mesa];
  return base;
};

function injectCorrectionBanner(){
  const ctx=readCtx();
  if(!ctx||!isAdmin())return;
  let host=document.getElementById('privatecontent');
  if(!host||document.getElementById('returnedCorrectionBanner'))return;
  const b=document.createElement('div');
  b.id='returnedCorrectionBanner';
  b.className='notice';
  b.style.marginBottom='14px';
  b.innerHTML='<b>Documento devuelto para corrección</b><br>'+
    '<span>Mesa '+safe(ctx.mesa)+' · Versión devuelta '+safe(ctx.version||'—')+' · Ciclo '+safe(ctx.ciclo||1)+'</span>'+
    (ctx.observacion?'<div style="margin-top:8px"><b>Observación de Administración:</b> '+safe(ctx.observacion)+'</div>':'')+
    '<div style="margin-top:10px"><button class="btn soft" type="button" onclick="volverSolicitudesDesdeCorreccion()">← Volver a Solicitudes y revisión de publicaciones</button></div>';
  host.prepend(b);
}

window.renderEspacio=function(){
  const r=originalRenderEspacio?originalRenderEspacio.apply(this,arguments):undefined;
  injectCorrectionBanner();
  return r;
};

window.editarSolicitudDevuelta=async function(id){
  if(!isAdmin())return alert('Esta opción está disponible para Administración.');
  const list=typeof getPubRequests==='function'?getPubRequests():[];
  const x=(list||[]).find(r=>String(r.id)===String(id));
  if(!x)return alert('No se encontró la solicitud devuelta. Actualice la pantalla e inténtelo nuevamente.');
  if(String(x.estado||'').toLowerCase()!=='devuelta')return alert('Esta solicitud ya no está en estado Devuelta.');
  writeCtx({id:x.id,mesa:x.mesa,titulo:x.titulo,version:x.version,ciclo:x.ciclo||1,observacion:x.observacion||''});
  currentDocMesa=x.mesa;
  if(typeof go==='function')go('mifrente');
  if(typeof privateTab==='function')privateTab('espacio');
  setTimeout(injectCorrectionBanner,0);
};

window.volverSolicitudesDesdeCorreccion=async function(){
  clearCtx();
  if(typeof go==='function')go('adminarea');
  if(typeof renderAdminShell==='function')renderAdminShell();
  if(typeof adminSolicitudes==='function')await adminSolicitudes();
};

function addEditButtons(){
  if(!isAdmin())return;
  const root=document.getElementById('admincontent');if(!root)return;
  const headings=[...root.querySelectorAll('h2')];
  const h=headings.find(x=>x.textContent.trim()==='Solicitudes devueltas para corrección');
  if(!h)return;
  let n=h.nextElementSibling;
  while(n&&n.tagName!=='H2'){
    if(n.classList?.contains('row')){
      const view=[...n.querySelectorAll('button')].find(b=>b.textContent.trim()==='Ver versión devuelta');
      if(view&&!n.querySelector('[data-edit-returned]')){
        const m=String(view.getAttribute('onclick')||'').match(/verSolicitudPublicacion\((\d+)\)/);
        if(m){
          const b=document.createElement('button');
          b.type='button';b.className='btn primary';b.dataset.editReturned='1';
          b.textContent='Editar / Corregir documento';
          b.onclick=()=>window.editarSolicitudDevuelta(m[1]);
          view.insertAdjacentElement('afterend',b);
        }
      }
    }
    n=n.nextElementSibling;
  }
}

window.adminSolicitudes=async function(){
  const r=originalAdminSolicitudes?await originalAdminSolicitudes.apply(this,arguments):undefined;
  addEditButtons();
  return r;
};

if(typeof originalIrAAdministracion==='function'){
  window.irAAdministracion=function(){
    clearCtx();
    return originalIrAAdministracion.apply(this,arguments);
  };
}

const obs=new MutationObserver(()=>{
  const root=document.getElementById('admincontent');
  if(root&&root.textContent.includes('Solicitudes devueltas para corrección'))addEditButtons();
  injectCorrectionBanner();
});
obs.observe(document.documentElement,{childList:true,subtree:true});
})();
