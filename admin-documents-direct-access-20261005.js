/* Acceso directo y trazabilidad de documentos desde Administración — 06-10-2026 */
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
function requestHistory(mesa,title){
  try{
    const all=typeof getPubRequests==='function'?getPubRequests():[];
    const exact=(all||[]).filter(r=>String(r.mesa||'')===String(mesa)&&String(r.titulo||'')===String(title||''));
    return exact.length?exact:(all||[]).filter(r=>String(r.mesa||'')===String(mesa));
  }catch(e){return []}
}
function dateValue(v){
  const raw=v?.created_at||v?.createdAt||v?.fecha||v?.requested_at||v?.requestedAt||v?.responded_at||v?.respondidaEn||'';
  const n=raw?Date.parse(raw):NaN;
  if(Number.isFinite(n))return n;
  return 0;
}
function displayDate(v){
  const raw=v?.created_at||v?.createdAt||v?.fecha||v?.requested_at||v?.requestedAt||v?.responded_at||v?.respondidaEn||'';
  if(!raw)return 'Sin fecha registrada';
  const n=Date.parse(raw);
  if(Number.isFinite(n))return new Date(n).toLocaleString('es-CL');
  return String(raw);
}
function traceEntries(mesa,d){
  const out=[];
  const versions=Array.isArray(d?.versiones)?d.versiones:[];
  versions.forEach(v=>out.push({
    when:dateValue(v),date:displayDate(v),kind:'Versión',tone:'',
    title:'Versión '+safe(v.numero??'—')+' guardada',
    detail:(v.autor?'Por '+safe(v.autor):'')+(v.estado?' · Estado registrado: '+safe(v.estado):'')
  }));

  const comments=Array.isArray(d?.comentarios)?d.comentarios:[];
  comments.forEach(c=>out.push({
    when:dateValue(c),date:displayDate(c),kind:c.tipo||'Observación',tone:c.estado==='Resuelto'?'green':'amber',
    title:safe(c.tipo||'Observación / mensaje'),
    detail:safe(c.texto||'')+(c.estado?' · '+safe(c.estado):'')+(c.autor?' · '+safe(c.autor):'')
  }));

  const reqs=requestHistory(mesa,d?.titulo).slice().sort((a,b)=>(a.ciclo||1)-(b.ciclo||1));
  reqs.forEach(r=>{
    out.push({
      when:dateValue({requested_at:r.requested_at,requestedAt:r.fecha}),
      date:r.fecha||displayDate({requested_at:r.requested_at}),kind:'Solicitud',tone:'',
      title:'Solicitud de publicación · Ciclo '+safe(r.ciclo||1),
      detail:'Versión '+safe(r.version||'—')+' · Estado inicial: En revisión de Administración'
    });
    if(r.estado==='Devuelta'||r.estado==='Publicada'||r.respondidaEn||r.responded_at){
      out.push({
        when:dateValue({responded_at:r.responded_at,respondidaEn:r.respondidaEn}),
        date:r.respondidaEn||displayDate({responded_at:r.responded_at}),
        kind:r.estado==='Publicada'?'Publicación':'Resolución',tone:r.estado==='Publicada'?'green':'amber',
        title:r.estado==='Publicada'?'Documento publicado en Biblioteca':'Solicitud devuelta a la Mesa',
        detail:'Ciclo '+safe(r.ciclo||1)+(r.observacion?' · Observación: '+safe(r.observacion):'')
      });
    }
  });

  const p=publishedFor(mesa,d?.titulo);
  if(p&&p.publicadoEn){
    out.push({when:dateValue({fecha:p.publicadoEn}),date:String(p.publicadoEn),kind:'Biblioteca',tone:'green',title:'Registro en Biblioteca pública',detail:'Documento final disponible para consulta.'});
  }
  return out.sort((a,b)=>a.when-b.when);
}
function statusSummary(mesa,d){
  const estado=typeof normalizeEstado==='function'?normalizeEstado(d?.estado):String(d?.estado||'En elaboración');
  const reqs=requestHistory(mesa,d?.titulo);
  const latest=reqs.slice().sort((a,b)=>(a.ciclo||1)-(b.ciclo||1)).at(-1);
  if(latest?.estado==='Publicada')return 'Publicado';
  if(latest?.estado==='Pendiente')return 'En revisión de Administración';
  if(latest?.estado==='Devuelta')return 'En corrección de Mesa';
  return estado;
}

window.abrirDocumentoMesaAdmin=function(mesa){
  const d=typeof getWorkView==='function'?getWorkView(mesa):getWork(mesa);
  if(!d)return alert('No fue posible cargar el documento de esta Mesa.');
  const estado=statusSummary(mesa,d);
  const c=document.getElementById('admincontent');
  if(!c)return;
  const trace=traceEntries(mesa,d);
  const sections=(window.STUDY_SECTION_NAMES||[]);
  const body=sections.length?sections.map((s,i)=>{
    const html=typeof cleanSectionHTML==='function'?cleanSectionHTML(s,d.contenido?.[s]||''):(d.contenido?.[s]||'');
    return '<section class="card" style="margin-bottom:12px"><h3>'+(i+1)+'. '+safe(s)+'</h3><div style="line-height:1.65">'+(html||'<p class="muted">Sin contenido.</p>')+'</div></section>';
  }).join(''):'<div class="card"><p>No se encontraron secciones para mostrar.</p></div>';
  const timeline=trace.length?trace.map(x=>
    '<div style="display:grid;grid-template-columns:165px 1fr;gap:14px;padding:12px 0;border-bottom:1px solid var(--line)">'+
      '<div><small class="muted">'+safe(x.date)+'</small><br><span class="pill '+safe(x.tone||'')+'">'+safe(x.kind)+'</span></div>'+
      '<div><b>'+x.title+'</b><div class="muted" style="margin-top:4px;line-height:1.5">'+(x.detail||'')+'</div></div>'+
    '</div>').join(''):'<p class="muted">No hay movimientos registrados todavía.</p>';

  c.innerHTML='<div class="kicker">Seguimiento documental</div>'+
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">'+
      '<div><h1 class="section-title" style="margin-bottom:6px">'+safe(d.titulo||'Documento de trabajo')+'</h1>'+
      '<p class="muted" style="margin-top:0">Mesa '+safe(mesa)+' · Estado actual: <b>'+safe(estado)+'</b> · Última versión '+safe(versionOf(d))+'</p></div>'+
      '<button class="btn soft" type="button" onclick="adminDocumentosMesas()">← Volver a Documentos de las Mesas</button>'+
    '</div>'+
    '<div class="notice" style="margin-bottom:14px"><b>Vista de seguimiento en modo solo lectura.</b> Administración puede conocer el historial completo del documento, sus versiones, observaciones, devoluciones y publicación, sin habilitar ninguna función de edición.</div>'+
    '<div class="card" style="margin-bottom:16px"><h2 class="section-sub" style="margin-top:0">Trazabilidad completa</h2>'+timeline+'</div>'+
    '<details class="card"><summary style="cursor:pointer;font-weight:800;color:var(--blue)">Ver contenido actual del documento</summary><div style="margin-top:14px">'+body+'</div></details>'+
    '<style>@media(max-width:680px){#admincontent .card>div[style*="grid-template-columns:165px"]{grid-template-columns:1fr!important}}</style>';
  window.scrollTo({top:0,behavior:'smooth'});
};

function renderDirectTable(){
  if(typeof requireAdmin==='function'&&!requireAdmin())return;
  const c=document.getElementById('admincontent');if(!c)return;
  const list=(window.mesas||[]).map(m=>{
    const d=typeof getWorkView==='function'?getWorkView(m):getWork(m);
    const estado=statusSummary(m,d);
    return {mesa:m,d,estado};
  });
  c.innerHTML='<div class="kicker">Supervisión transversal</div><h1 class="section-title">Documentos de las Mesas</h1>'+
    '<div class="notice">Vista de Administración para revisar el avance de todas las Mesas. <b>Haga clic sobre cualquier fila para abrir la hoja de seguimiento y ver la trazabilidad completa del documento.</b> Esta vista es solo de consulta.</div><br>'+
    '<div class="library-table-wrap"><table class="library-table admin-doc-direct-table"><thead><tr><th>Mesa</th><th>Documento</th><th>Estado actual</th><th>Versión</th><th>Última modificación</th></tr></thead><tbody>'+
    list.map(x=>'<tr tabindex="0" role="button" aria-label="Ver seguimiento del documento '+safe(x.mesa)+'" onclick="abrirDocumentoMesaAdmin(\''+jsq(x.mesa)+'\')" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();abrirDocumentoMesaAdmin(\''+jsq(x.mesa)+'\')}" style="cursor:pointer">'+
      '<td><b>'+safe(x.mesa)+'</b></td>'+
      '<td><button type="button" style="border:0;background:transparent;padding:0;color:var(--blue);font:inherit;text-align:left;cursor:pointer;font-weight:650" onclick="event.stopPropagation();abrirDocumentoMesaAdmin(\''+jsq(x.mesa)+'\')">'+safe(x.d?.titulo||('Documento de trabajo de la Mesa '+x.mesa))+'</button></td>'+
      '<td><span class="pill '+(x.estado==='Publicado'?'green':x.estado.includes('corrección')?'amber':'')+'">'+safe(x.estado)+'</span></td>'+
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
