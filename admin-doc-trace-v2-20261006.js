/* Documentos de las Mesas · acceso y trazabilidad robusta — 06-10-2026 */
(function(){
'use strict';

const esc2=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtDate=v=>{if(!v)return '—';const d=new Date(v);return Number.isNaN(d.getTime())?String(v):d.toLocaleString('es-CL')};
const isAdmin=()=>!!window.currentUser&&['Administrador General','Administrador de Plataforma'].includes(window.currentUser.rol);

async function loadRows(){
  if(!window.sbAuth)throw new Error('Sin conexión a la base de datos');
  const {data,error}=await sbAuth.from('workspace_documents')
    .select('id,technical_table_id,title,state,data,updated_at,created_at,revision,technical_tables(name)')
    .order('updated_at',{ascending:false});
  if(error)throw error;
  return data||[];
}

async function loadTrace(row){
  const versions=Array.isArray(row?.data?.versiones)?row.data.versiones:[];
  const comments=Array.isArray(row?.data?.comentarios)?row.data.comentarios:[];
  const {data:reqs,error}=await sbAuth.from('publication_requests')
    .select('id,title,version,status,observation,requested_at,responded_at,cycle,parent_request_id')
    .eq('workspace_id',row.id)
    .order('requested_at',{ascending:true});
  if(error)throw error;
  const {data:libs,error:libErr}=await sbAuth.from('public_library')
    .select('id,title,published_at,is_public,withdrawn_at,withdrawal_reason,publication_request_id')
    .eq('technical_table_id',row.technical_table_id)
    .order('published_at',{ascending:true});
  if(libErr)throw libErr;

  const events=[];
  versions.forEach(v=>events.push({at:v.created_at||v.fecha||'',type:'Versión',text:'Versión '+esc2(v.numero??'—')+' guardada'+(v.autor?' por '+esc2(v.autor):'')+(v.estado?' · '+esc2(v.estado):'')}));
  comments.forEach(c=>events.push({at:c.created_at||c.fecha||'',type:c.tipo||'Observación',text:esc2(c.texto||'')+(c.estado?' · '+esc2(c.estado):'')+(c.autor?' · '+esc2(c.autor):'')}));
  (reqs||[]).forEach(r=>{
    events.push({at:r.requested_at,type:'Solicitud',text:'Ciclo '+esc2(r.cycle||1)+' · versión '+esc2(r.version||'—')+' · enviada a Administración'});
    if(r.status==='Devuelta')events.push({at:r.responded_at,type:'Devuelta',text:'Ciclo '+esc2(r.cycle||1)+(r.observation?' · Observación: '+esc2(r.observation):'')});
    if(r.status==='Publicada')events.push({at:r.responded_at,type:'Publicada',text:'Ciclo '+esc2(r.cycle||1)+' · documento autorizado para Biblioteca'});
  });
  (libs||[]).filter(x=>String(x.title||'')===String(row.title||'') || (reqs||[]).some(r=>String(r.id)===String(x.publication_request_id))).forEach(p=>{
    events.push({at:p.published_at,type:p.withdrawn_at?'Retirada':'Biblioteca',text:p.withdrawn_at?'Publicación retirada · '+esc2(p.withdrawal_reason||'Sin motivo'):'Documento publicado en Biblioteca'});
    if(p.withdrawn_at)events.push({at:p.withdrawn_at,type:'Retirada',text:'Retirado de publicación · '+esc2(p.withdrawal_reason||'Sin motivo')});
  });
  return events.sort((a,b)=>new Date(b.at||0)-new Date(a.at||0));
}

window.abrirSeguimientoDocumentoMesa=async function(workspaceId){
  const c=document.getElementById('admincontent');
  if(!c||!isAdmin())return;
  c.innerHTML='<div class="notice">Cargando trazabilidad del documento…</div>';
  try{
    const {data:row,error}=await sbAuth.from('workspace_documents')
      .select('id,technical_table_id,title,state,data,updated_at,created_at,revision,technical_tables(name)')
      .eq('id',workspaceId).single();
    if(error)throw error;
    const events=await loadTrace(row);
    const mesa=row.technical_tables?.name||'Mesa Técnica';
    const versiones=Array.isArray(row.data?.versiones)?row.data.versiones:[];
    const ultimaVersion=versiones.length?(versiones[versiones.length-1]?.numero??versiones.length):'—';
    const timeline=events.length?events.map(e=>'<div style="padding:12px 0;border-bottom:1px solid var(--line)"><small class="muted">'+esc2(fmtDate(e.at))+'</small><br><b>'+esc2(e.type)+'</b><div class="muted" style="margin-top:4px">'+e.text+'</div></div>').join(''):'<p class="muted">No hay movimientos registrados.</p>';
    c.innerHTML='<div class="kicker">Seguimiento documental</div><div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap"><div><h1 class="section-title" style="margin-bottom:6px">'+esc2(row.title||'Documento de trabajo')+'</h1><p class="muted" style="margin-top:0">'+esc2(mesa)+' · Estado actual: <b>'+esc2(row.state||'En elaboración')+'</b> · Última versión '+esc2(ultimaVersion)+'</p></div><button id="volverDocsMesa" class="btn soft" type="button">← Volver</button></div><div class="notice"><b>Solo lectura.</b> Esta vista permite revisar el seguimiento completo sin modificar el documento.</div><div class="card" style="margin-top:14px"><h2 class="section-sub" style="margin-top:0">Trazabilidad completa de: '+esc2(row.title||'Documento de trabajo')+'</h2>'+timeline+'</div>';
    document.getElementById('volverDocsMesa')?.addEventListener('click',()=>window.adminDocumentosMesas());
    window.scrollTo({top:0,behavior:'smooth'});
  }catch(err){console.error(err);c.innerHTML='<div class="notice">No fue posible abrir el seguimiento del documento.</div><br><button class="btn soft" id="volverDocsMesa">← Volver</button>';document.getElementById('volverDocsMesa')?.addEventListener('click',()=>window.adminDocumentosMesas())}
};

window.adminDocumentosMesas=async function(){
  const c=document.getElementById('admincontent');
  if(!c)return;
  if(!isAdmin()){c.innerHTML='<div class="notice">Esta sección requiere Administración General o Administración de Plataforma.</div>';return}
  c.innerHTML='<div class="notice">Cargando documentos de las Mesas…</div>';
  try{
    const rows=await loadRows();
    c.innerHTML='<div class="kicker">Supervisión transversal</div><h1 class="section-title">Documentos de las Mesas</h1><div class="notice">Haga clic sobre una fila o en <b>Ver seguimiento</b> para consultar la trazabilidad completa. Esta sección es solo de lectura.</div><br><div class="library-table-wrap"><table class="library-table"><thead><tr><th>Mesa</th><th>Documento</th><th>Estado actual</th><th>Versión</th><th>Última modificación</th><th></th></tr></thead><tbody>'+rows.map(r=>{const vs=Array.isArray(r.data?.versiones)?r.data.versiones:[];const v=vs.length?(vs[vs.length-1]?.numero??vs.length):'—';const mesa=r.technical_tables?.name||('Mesa '+r.technical_table_id);return '<tr class="doc-mesa-row" data-id="'+esc2(r.id)+'" style="cursor:pointer"><td><b>'+esc2(mesa)+'</b></td><td>'+esc2(r.title||'Documento de trabajo')+'</td><td><span class="pill '+(r.state==='Publicado'?'green':'')+'">'+esc2(r.state||'En elaboración')+'</span></td><td>'+esc2(v)+'</td><td>'+esc2(fmtDate(r.updated_at))+'</td><td><button type="button" class="btn soft doc-mesa-open" data-id="'+esc2(r.id)+'">Ver seguimiento</button></td></tr>'}).join('')+'</tbody></table></div>';
    c.querySelectorAll('.doc-mesa-row').forEach(tr=>tr.addEventListener('click',()=>window.abrirSeguimientoDocumentoMesa(Number(tr.dataset.id))));
    c.querySelectorAll('.doc-mesa-open').forEach(btn=>btn.addEventListener('click',e=>{e.stopPropagation();window.abrirSeguimientoDocumentoMesa(Number(btn.dataset.id))}));
  }catch(err){console.error(err);c.innerHTML='<div class="notice">No fue posible cargar los documentos de las Mesas. Actualice la página e inténtelo nuevamente.</div>'}
};
})();
