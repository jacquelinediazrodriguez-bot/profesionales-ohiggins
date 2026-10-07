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
        '<hr><p><b>Documento actual:</b> '+escText(doc.titulo||'Sin documento')+'</p>'+
        '<p><b>Estado:</b> '+escText(doc.estado||'Sin estado')+
        ' · <b>Observaciones registradas:</b> '+Number(doc.observaciones||0)+
        ' · <b>Secciones con contenido:</b> '+Number(doc.secciones_completadas||0)+'</p>'+
        '<div class="mini-note" style="margin-top:9px"><b>Observaciones actuales:</b> '+(Array.isArray(doc.observaciones_detalle)&&doc.observaciones_detalle.length?doc.observaciones_detalle.map(o=>'<p>'+escText(o.texto||'Observación sin texto')+' <small>('+escText(o.estado||'Sin estado')+' · '+escText(o.autor||'Autor no indicado')+')</small></p>').join(''):' Sin observaciones registradas')+'</div>'+ 
        '<p class="muted">Última actualización: '+(doc.actualizado?escText(new Date(doc.actualizado).toLocaleString('es-CL')):'Sin registro')+'</p></div>';
      }).join(''):'<div class="notice">No existen Mesas registradas.</div>')+
      '<br><button class="btn soft" onclick="platformMesaSupervision()">Actualizar estado</button>';
  }catch(e){console.error(e);c.innerHTML='<h1 class="section-title">Supervisión de Mesas de Trabajo</h1><div class="notice">No se pudo consultar el estado. Compruebe su sesión y vuelva a intentar.</div><button class="btn soft" onclick="platformMesaSupervision()">Reintentar</button>';}
}
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