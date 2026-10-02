/* Corrección 2026-10-02: aviso de versión más reciente y normalización de nombre. */
(function(){
'use strict';

const FELIPE_BAD='Felipe Alejandra Vergara Diaz';
const FELIPE_OK='Felipe Alejandro Vergara Diaz';
const FELIPE_EMAIL='felipe.vergara.d@gmail.com';
let staleMesa=null;
let checking=false;
let lastCheck=0;

function normalizarNombre(n){
  const s=String(n||'').trim();
  return s===FELIPE_BAD?FELIPE_OK:s;
}
function normalizarDocumento(d){
  if(!d||typeof d!=='object')return d;
  if(Array.isArray(d.versiones))d.versiones=d.versiones.map(v=>({...v,autor:normalizarNombre(v?.autor)}));
  return d;
}
function normalizarUsuarioActual(){
  try{
    if(window.currentUser&&String(currentUser.correo||'').toLowerCase()===FELIPE_EMAIL){
      currentUser.nombre=FELIPE_OK;
      try{sessionStorage.setItem('frentePT_user',JSON.stringify(currentUser));}catch(e){}
    }
  }catch(e){}
}

normalizarUsuarioActual();

/* Toda información de trabajo que entra al navegador conserva el historial,
   pero corrige la etiqueta histórica del nombre para mostrarlo correctamente. */
const baseSetWork=window.setWork;
if(typeof baseSetWork==='function'){
  window.setWork=function(m,d){return baseSetWork.call(this,m,normalizarDocumento(d));};
}
const baseRenderHistory=window.renderHistory;
if(typeof baseRenderHistory==='function'){
  window.renderHistory=function(d){
    normalizarDocumento(d);
    return baseRenderHistory.apply(this,arguments);
  };
}

function localVersion(m){
  try{
    const d=typeof getWork==='function'?getWork(m):null;
    const a=Array.isArray(d?.versiones)?d.versiones:[];
    return Number(a.at(-1)?.numero||0);
  }catch(e){return 0}
}
function remoteVersion(data){
  const a=Array.isArray(data?.versiones)?data.versiones:[];
  return Number(a.at(-1)?.numero||0);
}
function removeNotice(){
  document.getElementById('workspaceFreshnessWarning')?.remove();
}
function showNotice(remoteN,localN){
  const host=document.getElementById('autosaveStatus')?.parentElement||document.getElementById('privatecontent');
  if(!host)return;
  let n=document.getElementById('workspaceFreshnessWarning');
  if(!n){
    n=document.createElement('div');
    n.id='workspaceFreshnessWarning';
    n.className='notice';
    n.style.cssText='margin-top:12px;border-left:5px solid #9a6800;background:#fff8e6';
    const anchor=document.getElementById('autosaveStatus');
    if(anchor)anchor.insertAdjacentElement('afterend',n);else host.prepend(n);
  }
  n.innerHTML='<b>Existe una versión más reciente del documento.</b><br>'+ 
    'Este computador muestra la versión '+localN+' y en la plataforma ya está disponible la versión '+remoteN+'. ' +
    '<b>Actualice antes de continuar editando</b> para no trabajar sobre una versión desactualizada.<br>'+
    '<button class="btn warn" style="margin-top:9px" onclick="actualizarDocumentoMasReciente()">↻ Actualizar documento</button>';
}

async function readRemote(m){
  if(!window.sbAuth||!window.currentUser?.supabaseId||typeof mesaId!=='function')return null;
  const id=mesaId(m);if(!id)return null;
  const {data,error}=await sbAuth.from('workspace_documents').select('data,revision,updated_at,updated_by').eq('technical_table_id',id).maybeSingle();
  if(error)throw error;
  return data||null;
}

window.checkWorkspaceFreshness=async function(force){
  const now=Date.now();
  if(checking||(!force&&now-lastCheck<3500))return staleMesa===window.currentDocMesa;
  if(!window.currentUser?.supabaseId||!window.currentDocMesa)return false;
  checking=true;lastCheck=now;
  try{
    normalizarUsuarioActual();
    const m=currentDocMesa;
    const r=await readRemote(m);if(!r)return false;
    const rv=remoteVersion(r.data),lv=localVersion(m);
    if(rv>lv){staleMesa=m;showNotice(rv,lv);return true;}
    if(staleMesa===m)staleMesa=null;
    removeNotice();
    return false;
  }catch(e){console.warn('No se pudo comprobar la versión más reciente:',e);return false}
  finally{checking=false}
};

window.actualizarDocumentoMasReciente=async function(){
  if(!window.currentDocMesa)return;
  try{
    const m=currentDocMesa;
    const editing=[...document.querySelectorAll('.doc-page[contenteditable="true"]')].length>0;
    if(editing&&!confirm('Hay una sección abierta en edición en este computador. Al actualizar se cargará la versión más reciente de la plataforma.\n\n¿Desea continuar?'))return;
    const r=await readRemote(m);if(!r)return alert('No fue posible obtener la versión más reciente.');
    const remote={...(typeof defaultWork==='function'?defaultWork(m):{}),...(r.data||{})};
    if(typeof migrateContenido==='function')remote.contenido=migrateContenido(remote.contenido||{});
    normalizarDocumento(remote);
    if(typeof setWork==='function')setWork(m,remote);
    if(typeof clearDraft==='function')clearDraft(m);
    if(typeof releaseMyLocks==='function')releaseMyLocks();
    staleMesa=null;removeNotice();
    if(typeof renderEspacio==='function')renderEspacio(document.getElementById('privatecontent'));
  }catch(e){console.error(e);alert('No fue posible actualizar el documento. Intente nuevamente.');}
};

/* Antes de comenzar a editar o guardar, comprobar que no haya aparecido una
   nueva versión en otro computador. */
const baseAcquire=window.acquireLock;
if(typeof baseAcquire==='function'){
  window.acquireLock=async function(s){
    if(await checkWorkspaceFreshness(true))return alert('Existe una versión más reciente. Pulse «Actualizar documento» antes de editar.');
    return baseAcquire.apply(this,arguments);
  };
}
const baseGuardar=window.guardarVersion;
if(typeof baseGuardar==='function'){
  window.guardarVersion=async function(){
    normalizarUsuarioActual();
    if(await checkWorkspaceFreshness(true))return alert('Existe una versión más reciente. Actualice el documento antes de guardar una nueva versión.');
    return baseGuardar.apply(this,arguments);
  };
}

/* Al volver a dibujar el espacio de trabajo, conservar el aviso y revisar la nube. */
const baseRender=window.renderEspacio;
if(typeof baseRender==='function'){
  window.renderEspacio=function(){
    normalizarUsuarioActual();
    const out=baseRender.apply(this,arguments);
    setTimeout(()=>checkWorkspaceFreshness(true),150);
    return out;
  };
}

setInterval(()=>{
  try{
    const area=document.getElementById('privatecontent');
    if(area&&area.offsetParent!==null&&window.currentUser?.supabaseId&&window.currentDocMesa)checkWorkspaceFreshness(false);
  }catch(e){}
},5000);

})();
