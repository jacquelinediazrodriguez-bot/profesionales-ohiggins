/* Corrección restauración por estado del documento — 05-10-2026 */
(function(){
'use strict';

const originalRenderHistory=window.renderHistory;
const originalRestaurarVersion=window.restaurarVersion;

function estadoActual(){
  try{
    const d=typeof getWork==='function'?getWork(currentDocMesa):null;
    return typeof normalizeEstado==='function'?normalizeEstado(d?.estado||''):(d?.estado||'');
  }catch(e){return ''}
}

/* No mostrar Restaurar para editar en documentos bloqueados/publicados. */
window.renderHistory=function(d){
  if(!d||!Array.isArray(d.versiones)||!d.versiones.length){
    return '<div class="muted">Aún no hay versiones guardadas.</div>';
  }
  const estado=typeof normalizeEstado==='function'?normalizeEstado(d.estado||''):(d.estado||'');
  const editable=estado==='En elaboración';
  const canRestore=editable && typeof puedeGestionarMesa==='function' && puedeGestionarMesa(currentDocMesa);
  return d.versiones.slice().reverse().map(v=>{
    const meta=typeof esc==='function'
      ? `${esc(v.fecha)} · ${esc(v.autor)} · ${esc(typeof normalizeEstado==='function'?normalizeEstado(v.estado):v.estado)}`
      : `${v.fecha||''} · ${v.autor||''} · ${v.estado||''}`;
    return `<div class="history-item"><div><b>Versión ${v.numero}</b><br><small>${meta}</small></div>${canRestore?`<button class="btn soft" onclick="restaurarVersion(${v.numero})">Restaurar para editar</button>`:''}</div>`;
  }).join('') + (!editable?'<div class="mini-note" style="margin-top:10px"><b>Documento bloqueado para edición.</b> Las versiones pueden consultarse, pero solo se restauran cuando el documento está en estado <b>En elaboración</b>. Si Administración lo devuelve con observaciones, la plataforma lo reabre automáticamente para corregirlo.</div>':'');
};

window.restaurarVersion=async function(n){
  const estado=estadoActual();
  if(estado!=='En elaboración'){
    const msg=estado==='Publicado'
      ? 'Este documento ya está publicado. No se puede restaurar una versión para editar mientras permanezca publicado.'
      : 'Este documento está bloqueado para edición en su estado actual ('+(estado||'sin estado')+').';
    return alert(msg+' Si Administración lo devuelve con observaciones, quedará nuevamente En elaboración y podrá restaurar una versión.');
  }
  return originalRestaurarVersion?originalRestaurarVersion.apply(this,arguments):undefined;
};

})();
