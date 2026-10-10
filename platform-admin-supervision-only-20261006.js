/* Permisos del Administrador de Plataforma — Supervisión de Mesas, 06-10-2026.
   Los permisos de escritura se aplican también en Supabase. */
(function(){
'use strict';
function platformOnly(){
  try{return !!currentUser && currentUser.systemRole==='administrador_plataforma' && currentUser.accountRole!=='administrador_general';}
  catch(_){return false;}
}
function escText(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
async function supervision(){
  if(!platformOnly())return;
  const c=document.getElementById('admincontent');
  if(!c)return;
  c.innerHTML='<div class="kicker">Administración de Plataforma</div><h1 class="section-title">Supervisión de Mesas de Trabajo</h1><p class="muted">Consultando estado de las Mesas…</p>';
  try{
    const {data,error}=await sbAuth.rpc('platform_mesa_overview');
    if(error)throw error;
    const items=Array.isArray(data)?data:[];
    c.innerHTML='<div class="kicker">Administración de Plataforma</div><h1 class="section-title">Supervisión de Mesas de Trabajo</h1>'+
      '<div class="notice">Acceso exclusivo de consulta. No se permite modificar documentos, integrantes, Mesas, publicaciones, versiones ni trazabilidad. Los permisos de un rol propio dentro de una Mesa se mantienen en «Mi Trabajo».</div>'+
      (items.length?items.map(t=>{
        const doc=t.documento||{},members=Array.isArray(t.integrantes)?t.integrantes:[];
        return '<div class="card" style="margin-top:16px"><h3>'+escText(t.mesa)+'</h3><span class="pill">'+(t.activa?'Activa':'Inactiva')+'</span>'+
        '<p>'+escText(t.descripcion||'')+'</p>'+
        '<p><b>Integrantes:</b> '+members.length+'</p>'+
        (members.length?'<div class="mini-note">'+members.map(m=>escText(m.nombre||'Sin nombre')+' — '+escText(m.rol||'Integrante')+(m.coordinador?' (Coordinación)':'')).join('<br>')+'</div>':'')+
        '<hr><p><b>Documento actual:</b> '+escText(doc.titulo||((doc.estado||Number(doc.secciones_completadas||0)>0)?'Documento de trabajo en elaboración':'Sin documento registrado'))+'</p>'+
        '<p><b>Estado:</b> '+escText(doc.estado||'Sin estado')+
        ' · <b>Observaciones registradas:</b> '+Number(doc.observaciones||0)+
        ' · <b>Secciones con contenido:</b> '+Number(doc.secciones_completadas||0)+'</p>'+
        '<div class="mini-note" style="margin-top:9px"><b>Observaciones actuales:</b> '+(Array.isArray(doc.observaciones_detalle)&&doc.observaciones_detalle.length?doc.observaciones_detalle.map(o=>'<p>'+escText(o.texto||'Observación sin texto')+' <small>('+escText(o.estado||'Sin estado')+' · '+escText(o.autor||'Autor no indicado')+')</small></p>').join(''):' Sin observaciones registradas')+'</div>'+ 
        '<p><button type="button" class="btn soft" onclick="platformMesaVerAvance('+Number(t.id)+')">Ver avance del documento (solo lectura)</button></p>'+ 
        '<p class="muted">Última actualización: '+(doc.actualizado?escText(new Date(doc.actualizado).toLocaleString('es-CL')):'Sin registro')+'</p></div>';
      }).join(''):'<div class="notice">No existen Mesas registradas.</div>')+
      '<br><button class="btn soft" onclick="platformMesaSupervision()">Actualizar estado</button>';
  }catch(e){console.error(e);c.innerHTML='<h1 class="section-title">Supervisión de Mesas de Trabajo</h1><div class="notice">No se pudo consultar el estado. Compruebe su sesión y vuelva a intentar.</div><button class="btn soft" onclick="platformMesaSupervision()">Reintentar</button>';}
}

window.platformMesaVerAvance=async function(mesaId){
 if(!platformOnly())return;
 const box=document.getElementById('admincontent');if(!box)return;
 const modal=document.createElement('div');modal.className='card';modal.style.cssText='position:relative;margin:16px 0;border:2px solid #1e5d91';
 modal.innerHTML='<button type="button" class="btn soft" style="float:right" aria-label="Cerrar avance">Cerrar</button><h2>Avance del documento · solo lectura</h2><p>Consultando…</p>';
 box.prepend(modal);modal.querySelector('button').onclick=()=>modal.remove();
 try{
  const {data,error}=await sbAuth.rpc('platform_mesa_document_readonly',{p_table_id:mesaId});if(error)throw error;
  if(!modal.isConnected||!platformOnly())return;
  if(!data){modal.querySelector('p').textContent='Esta mesa todavía no tiene documento de trabajo registrado.';return;}
  const fields=data.contenido&&typeof data.contenido==='object'?Object.entries(data.contenido):[];
  const populated=fields.filter(([k,v])=>String(v??'').trim().length);
  modal.innerHTML='<button type="button" class="btn soft" style="float:right">Cerrar</button><h2>'+escText(data.mesa||'Mesa')+'</h2><p><b>Documento:</b> '+escText(data.titulo)+'</p><p><b>Estado:</b> '+escText(data.estado||'—')+' · <b>Secciones con contenido:</b> '+populated.length+'</p>'+ (populated.length?populated.map(([k,v])=>'<section style="margin:16px 0;border-top:1px solid #dde5ec;padding-top:12px"><h3>'+escText(k.replace(/_/g,' '))+'</h3><div style="white-space:pre-wrap;line-height:1.6">'+escText(typeof v==='string'?v:JSON.stringify(v,null,2))+'</div></section>').join(''):'<p>Documento sin secciones con texto todavía.</p>')+'<p class="muted">Consulta sin edición, aprobación ni publicación.</p>';
  modal.querySelector('button').onclick=()=>modal.remove();modal.scrollIntoView({behavior:'smooth',block:'start'});
 }catch(e){console.error(e);if(modal.isConnected)modal.querySelector('p').textContent='No fue posible cargar el avance. Compruebe la sesión y reintente.';}
};
window.platformMesaSupervision=supervision;
const originalShell=window.renderAdminShell;
window.renderAdminShell=function(){
  if(!platformOnly())return originalShell.apply(this,arguments);
  const shell=document.getElementById('adminShell');if(!shell)return;
  shell.innerHTML='<div class="sidebar-layout"><aside class="side"><b>Administrador de Plataforma</b>'+
    '<button onclick="platformMesaSupervision()">🧩 Mesas de Trabajo · Supervisión</button>'+
    '<button onclick="irAMiTrabajo()">🧭 Ir a Mi Trabajo</button>'+
    '<button onclick="logout()">↩ Salir</button></aside><div id="admincontent"></div></div>';
};
const oldHome=window.adminHome;
window.adminHome=function(){return platformOnly()?supervision():oldHome.apply(this,arguments);};
const oldMesas=window.adminMesas;
window.adminMesas=function(){return platformOnly()?supervision():oldMesas.apply(this,arguments);};
const prohibited=['adminUsuarios','adminInvitaciones','adminPublicaciones','adminSolicitudes','adminCorreoInstitucional','adminContactos','adminRepresentantes','abrirGestionGaleria','adminBloqueos','adminEstado','adminPresidencia','adminSeguridadLimites','adminDocumentosMesas','guardarMesaTecnica','editarMesaTecnica','toggleMesaTecnica','eliminarMesaTecnica','guardarRolGlobal','asignarRolAdmin','publicarSolicitud','rechazarSolicitudPublicacion','volverAPublicar'];
for(const name of prohibited){
  const old=window[name];if(typeof old!=='function')continue;
  window[name]=function(){if(platformOnly()){alert('El Administrador de Plataforma solo puede supervisar las Mesas de Trabajo.');return;}return old.apply(this,arguments);};
}
})();