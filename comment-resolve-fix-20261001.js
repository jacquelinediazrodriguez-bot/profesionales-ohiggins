/* Corrección 01-10-2026: resolver observaciones con IDs numéricos o de texto. */
(function(){
'use strict';

function safeId(id){return JSON.stringify(String(id));}

window.renderComments=function(d){
  return d.comentarios.length?d.comentarios.slice().reverse().map(c=>{
    const canResolve=puedeResolverComentario(c),canDelete=puedeEliminarComentario(c),formal=esObservacionAdministracion(c);
    const id=safeId(c.id);
    const resolved=c.estado==='Resuelto';
    const resolvedMeta=resolved&&c.resueltoPor?`<br><small>Resuelta por ${esc(c.resueltoPor)}${c.resueltoFecha?' · '+esc(c.resueltoFecha):''}</small>`:'';
    return `<div class="comment-item">${formal?'<span class="pill amber">OBSERVACIÓN DE ADMINISTRACIÓN</span><br>':''}<b>${esc(c.autor)}</b> <span class="pill ${resolved?'green':'amber'}">${esc(c.estado)}</span><br><small>${esc(c.fecha)}</small><p>${esc(c.texto)}</p>${resolvedMeta}<div class="toolbar-row">${!resolved&&canResolve?`<button class="btn soft" onclick='resolverComentario(${id})'>Marcar resuelto</button>`:''}${canDelete?` <button class="btn danger" onclick='eliminarComentario(${id})'>Eliminar</button>`:''}${formal?'<small class="muted">Esta observación forma parte del historial de devolución y no puede eliminarse.</small>':''}</div></div>`;
  }).join(''):'<div class="muted">No hay mensajes u observaciones registrados.</div>';
};

window.resolverComentario=function(id){
  const d=getWork(currentDocMesa),x=d.comentarios.find(c=>String(c.id)===String(id));
  if(!x)return alert('No fue posible identificar la observación. Recargue la página e inténtelo nuevamente.');
  if(!puedeResolverComentario(x))return alert(esObservacionAdministracion(x)?'Solo Coordinación, Secretaría Técnica o Administración pueden resolver esta observación formal.':'Solo el autor del comentario, Coordinación, Secretaría Técnica o Administración pueden marcarlo como resuelto.');
  x.estado='Resuelto';
  x.resueltoPor=currentUser?.nombre||currentUser?.correo||'Usuario';
  x.resueltoFecha=new Date().toLocaleString('es-CL');
  setWork(currentDocMesa,d);
  renderEspacio(document.getElementById('privatecontent'));
};

window.eliminarComentario=function(id){
  const d=getWork(currentDocMesa),x=d.comentarios.find(c=>String(c.id)===String(id));
  if(!x)return alert('No fue posible identificar el comentario. Recargue la página e inténtelo nuevamente.');
  if(esObservacionAdministracion(x))return alert('Las observaciones formales de Administración no pueden eliminarse porque forman parte del historial de revisión.');
  if(!puedeEliminarComentario(x))return alert('No tiene permiso para eliminar este comentario.');
  if(!confirm('¿Eliminar este comentario? Se retirará de la vista de trabajo, pero quedará archivado para trazabilidad.'))return;
  d.comentarios=d.comentarios.filter(c=>String(c.id)!==String(id));
  setWork(currentDocMesa,d);
  renderEspacio(document.getElementById('privatecontent'));
};
})();
