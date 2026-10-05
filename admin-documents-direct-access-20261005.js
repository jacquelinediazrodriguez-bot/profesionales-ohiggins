/* Acceso directo a documentos desde Administración — 05-10-2026 */
(function(){
'use strict';

function safe(s){
  if(typeof window.esc==='function')return window.esc(String(s??''));
  return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function jsq(s){return String(s??'').replace(/\\/g,'\\\\').replace(/'/g,"\\'")}
function versionOf(d){
  const a=Array.isArray(d?.versiones)?d.versiones:[];
  return a.length?(a[a.length-1]?.numero??a.length):'—';
}
function publishedFor(mesa,title){
  try{
    const pubs=typeof getPublicaciones==='function'?getPublicaciones():[];
    return (pubs||[]).slice().reverse().find(p=>String(p.mesa||p.tema||'')===String(mesa)&&String(p.titulo||'')===String(title))
      ||(pubs||[]).slice().reverse().find(p=>String(p.mesa||p.tema||'')===String(mesa));
  }catch(e){return null}
}

window.abrirDocumentoMesaAdmin=function(mesa){
  const d=typeof getWorkView==='function'?getWorkView(mesa):getWork(mesa);
  if(!d)return alert('No fue posible cargar el documento de esta Mesa.');
  const estado=typeof normalizeEstado==='function'?normalizeEstado(d.estado):String(d.estado||'En elaboración');
  if(estado==='Publicado'){
    const p=publishedFor(mesa,d.titulo);
    if(p&&typeof verDocumentoFinalPDF==='function'&&p.finalPdfPath){
      verDocumentoFinalPDF(p.id,false);
      return;
    }
    if(p&&typeof leerBiblioteca==='function'){
      if(typeof go==='function')go('biblioteca');
      setTimeout(()=>leerBiblioteca(p.id),80);
      return;
    }
  }
  const c=document.getElementById('admincontent');
  if(!c)return;
  const sections=(window.STUDY_SECTION_NAMES||[]);
  const body=sections.length?sections.map((s,i)=>{
    const html=typeof cleanSectionHTML==='function'?cleanSectionHTML(s,d.contenido?.[s]||''):(d.contenido?.[s]||'');
    return '<section class="card" style="margin-bottom:12px"><h3>'+(i+1)+'. '+safe(s)+'</h3><div style="line-height:1.65">'+(html||'<p class="muted">Sin contenido.</p>')+'</div></section>';
  }).join(''):'<div class="card"><p>No se encontraron secciones para mostrar.</p></div>';
  c.innerHTML='<div class="kicker">Supervisión transversal</div>'+
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">'+
      '<div><h1 class="section-title" style="margin-bottom:6px">'+safe(d.titulo||'Documento de trabajo')+'</h1>'+
      '<p class="muted" style="margin-top:0">Mesa '+safe(mesa)+' · Estado: '+safe(estado)+' · Versión '+safe(versionOf(d))+'</p></div>'+
      '<button class="btn soft" type="button" onclick="adminDocumentosMesas()">← Volver a Documentos de las Mesas</button>'+
    '</div>'+
    '<div class="notice" style="margin-bottom:14px"><b>Vista directa de Administración.</b> Este documento se muestra en modo consulta para supervisar su avance sin ingresar previamente a la Mesa.</div>'+
    body;
  window.scrollTo({top:0,behavior:'smooth'});
};

function renderDirectTable(){
  if(typeof requireAdmin==='function'&&!requireAdmin())return;
  const c=document.getElementById('admincontent');if(!c)return;
  const list=(window.mesas||[]).map(m=>{
    const d=typeof getWorkView==='function'?getWorkView(m):getWork(m);
    const estado=typeof normalizeEstado==='function'?normalizeEstado(d?.estado):String(d?.estado||'En elaboración');
    return {mesa:m,d,estado};
  });
  c.innerHTML='<div class="kicker">Supervisión transversal</div><h1 class="section-title">Documentos de las Mesas</h1>'+
    '<div class="notice">Vista de Administración para revisar el avance de todas las Mesas sin ingresar una por una. <b>Haga un clic sobre el documento o sobre cualquier parte de la fila para abrirlo directamente.</b></div><br>'+
    '<div class="library-table-wrap"><table class="library-table admin-doc-direct-table"><thead><tr><th>Mesa</th><th>Documento</th><th>Estado</th><th>Versión</th><th>Última modificación</th></tr></thead><tbody>'+
    list.map(x=>'<tr tabindex="0" role="button" aria-label="Abrir documento '+safe(x.mesa)+'" onclick="abrirDocumentoMesaAdmin(\''+jsq(x.mesa)+'\')" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();abrirDocumentoMesaAdmin(\''+jsq(x.mesa)+'\')}" style="cursor:pointer">'+
      '<td><b>'+safe(x.mesa)+'</b></td>'+
      '<td><button type="button" style="border:0;background:transparent;padding:0;color:var(--blue);font:inherit;text-align:left;cursor:pointer;font-weight:650" onclick="event.stopPropagation();abrirDocumentoMesaAdmin(\''+jsq(x.mesa)+'\')">'+safe(x.d?.titulo||('Documento de trabajo de la Mesa '+x.mesa))+'</button></td>'+
      '<td><span class="pill '+(x.estado==='Publicado'?'green':'')+'">'+safe(x.estado)+'</span></td>'+
      '<td>'+safe(versionOf(x.d))+'</td>'+
      '<td>'+safe(x.d?.ultima||'—')+'</td></tr>').join('')+
    '</tbody></table></div>'+
    '<style>.admin-doc-direct-table tbody tr:hover td{background:#eef6ff}.admin-doc-direct-table tbody tr:focus{outline:3px solid #9cc3e6;outline-offset:-3px}.admin-doc-direct-table tbody tr:focus td{background:#eef6ff}</style>';
}

const previous=window.adminDocumentosMesas;
window.adminDocumentosMesas=function(){
  try{
    const r=previous?previous.apply(this,arguments):undefined;
    renderDirectTable();
    return r;
  }catch(e){
    console.warn('Se reemplazó la vista de documentos por el acceso directo.',e);
    renderDirectTable();
  }
};
})();
