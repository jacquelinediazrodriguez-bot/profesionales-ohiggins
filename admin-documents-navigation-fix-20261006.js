/* Corrección de navegación directa a "Documentos de las mesas" — 06-10-2026 */
(function(){
'use strict';

function esc(s){
  if(typeof window.esc==='function') return window.esc(String(s??''));
  return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function jsq(s){return String(s??'').replace(/\\/g,'\\\\').replace(/'/g,"\\'")}
function mesaList(){
  try{
    if(typeof mesas!=='undefined'&&Array.isArray(mesas)&&mesas.length){
      return mesas.map(m=>typeof m==='string'?m:(m?.nombre||m?.name||m?.mesa||'')).filter(Boolean);
    }
  }catch(e){}
  try{
    const reqs=typeof getPubRequests==='function'?getPubRequests():[];
    const names=[...new Set((reqs||[]).map(r=>r?.mesa).filter(Boolean))];
    if(names.length)return names;
  }catch(e){}
  return ['Salud','Educación','Economía','Trabajo','Agricultura'];
}
function getDoc(mesa){
  try{
    if(typeof getWorkView==='function')return getWorkView(mesa);
    if(typeof getWork==='function')return getWork(mesa);
  }catch(e){console.warn('No se pudo leer documento de '+mesa,e)}
  return null;
}
function versionOf(d){
  const v=Array.isArray(d?.versiones)?d.versiones:[];
  return v.length?(v[v.length-1]?.numero??v.length):'—';
}
function statusOf(mesa,d){
  try{
    const reqs=typeof getPubRequests==='function'?getPubRequests():[];
    const same=(reqs||[]).filter(r=>String(r?.mesa||'')===String(mesa) && (!d?.titulo || !r?.titulo || String(r.titulo)===String(d.titulo)));
    const latest=same.slice().sort((a,b)=>(Number(a?.ciclo)||0)-(Number(b?.ciclo)||0)).slice(-1)[0];
    if(latest?.estado==='Publicada')return 'Publicado';
    if(latest?.estado==='Pendiente')return 'En revisión de Administración';
    if(latest?.estado==='Devuelta')return 'En corrección de Mesa';
  }catch(e){}
  try{if(typeof normalizeEstado==='function')return normalizeEstado(d?.estado)}catch(e){}
  return d?.estado||'En elaboración';
}
function render(){
  if(typeof window.requireAdmin==='function'&&!window.requireAdmin())return;
  const c=document.getElementById('admincontent');
  if(!c)return;
  const rows=mesaList().map(m=>{
    const d=getDoc(m)||{};
    const titulo=d.titulo||('Documento de trabajo de la Mesa '+m);
    const estado=statusOf(m,d);
    const tone=estado==='Publicado'?'green':String(estado).toLowerCase().includes('corrección')?'amber':'';
    return '<tr tabindex="0" role="button" onclick="abrirDocumentoMesaAdmin(\''+jsq(m)+'\')" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();abrirDocumentoMesaAdmin(\''+jsq(m)+'\')}" style="cursor:pointer">'+
      '<td><b>'+esc(m)+'</b></td>'+
      '<td><button type="button" onclick="event.stopPropagation();abrirDocumentoMesaAdmin(\''+jsq(m)+'\')" style="border:0;background:transparent;padding:0;color:var(--blue);font:inherit;font-weight:700;text-align:left;cursor:pointer">'+esc(titulo)+'</button></td>'+
      '<td><span class="pill '+tone+'">'+esc(estado)+'</span></td>'+
      '<td>'+esc(versionOf(d))+'</td>'+
      '<td>'+esc(d.ultima||d.updated_at||'—')+'</td>'+
    '</tr>';
  }).join('');

  c.innerHTML='<div class="kicker">Supervisión transversal</div>'+
    '<h1 class="section-title">Documentos de las Mesas</h1>'+
    '<div class="notice">Vista de Administración para revisar el avance de todas las Mesas. <b>Haga clic sobre una fila o sobre el nombre del documento para abrir su seguimiento.</b> Esta vista es solo de consulta.</div><br>'+
    '<div class="library-table-wrap"><table class="library-table admin-doc-nav-table">'+
      '<thead><tr><th>Mesa</th><th>Documento</th><th>Estado actual</th><th>Versión</th><th>Última modificación</th></tr></thead><tbody>'+rows+'</tbody></table></div>'+
    '<style>.admin-doc-nav-table tbody tr:hover td{background:#eef6ff}.admin-doc-nav-table tbody tr:focus{outline:3px solid #9cc3e6;outline-offset:-3px}.admin-doc-nav-table tbody tr:focus td{background:#eef6ff}</style>';
  window.scrollTo({top:0,behavior:'smooth'});
}

/* Sustituye la cadena anterior: no llama a la vista antigua ni a adminHome. */
window.adminDocumentosMesas=function(){render()};
window.adminDocumentosMesas.__directDocumentsFix=true;
})();
