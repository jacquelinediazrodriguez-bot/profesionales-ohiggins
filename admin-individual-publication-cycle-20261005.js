/* Ciclo administrativo de aportes individuales — 05-10-2026 */
(function(){
  'use strict';

  const previousAdminPublicaciones=window.adminPublicaciones;
  if(typeof previousAdminPublicaciones!=='function')return;

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=v=>{try{return new Date(v).toLocaleString('es-CL')}catch(e){return String(v||'')}};
  let pendingIndividualRequests=[];

  function findPendingHeading(c){
    return [...c.querySelectorAll('h2')].find(h=>{
      const t=h.textContent.trim();
      return t==='Aportes individuales pendientes'||t==='Aportes individuales pendientes de publicación';
    });
  }

  function clearLegacyPendingArea(heading){
    let n=heading.nextElementSibling;
    while(n && n.tagName!=='H2'){
      const next=n.nextElementSibling;
      if(n.id!=='individualAdminPendingHost')n.remove();
      n=next;
    }
  }

  async function loadPendingRequests(){
    const {data,error}=await sbAuth.from('individual_publication_requests')
      .select('id,contribution_id,requested_by,title,version,snapshot,status,observation,requested_at,responded_at,review_request_id,profiles:requested_by(full_name,profession),individual_review_requests(technical_table_id,technical_tables(name))')
      .eq('status','Pendiente')
      .order('requested_at',{ascending:false});
    if(error)throw error;
    return data||[];
  }

  function requestSnapshot(r){
    const s=r?.snapshot||{};
    return {
      title:s.title||r.title||'Aporte individual',
      document_type:s.document_type||'',
      topic:s.topic||'',
      summary:s.summary||'',
      body:s.body||'',
      author_name:s.author_name||r.profiles?.full_name||'Profesional',
      author_profession:s.author_profession||r.profiles?.profession||''
    };
  }

  function renderPendingRows(host,rows){
    pendingIndividualRequests=rows;
    if(!rows.length){
      host.innerHTML='<div class="card"><p>No hay aportes individuales pendientes de decisión de Administración.</p></div>';
      return;
    }
    host.innerHTML=rows.map(r=>{
      const s=requestSnapshot(r);
      const mesa=r.individual_review_requests?.technical_tables?.name||'';
      return '<div class="row" style="align-items:flex-start">'+
        '<div><span class="pill amber">PENDIENTE ADMINISTRACIÓN</span> <b>'+esc(s.title)+'</b><br>'+ 
        '<small>Autor: '+esc(s.author_name)+(s.author_profession?' · '+esc(s.author_profession):'')+(mesa?' · Mesa '+esc(mesa):'')+' · '+esc(s.document_type)+(s.topic?' · '+esc(s.topic):'')+' · Versión '+esc(r.version)+' · '+esc(fmt(r.requested_at))+'</small></div>'+ 
        '<div style="display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end">'+
          '<button class="btn soft" type="button" onclick="verAportePendienteAdmin('+r.id+')">Ver aporte</button>'+ 
          '<button class="btn success" type="button" onclick="publicarAporteIndividualAdmin('+r.id+')">Publicar</button>'+ 
          '<button class="btn danger" type="button" onclick="devolverAporteIndividualAdmin('+r.id+')">Devolver con observación</button>'+ 
        '</div></div>';
    }).join('')+'<div id="individualAdminDecisionDetail"></div>';
  }

  async function renderAdminPendingCycle(){
    const c=document.getElementById('admincontent');
    if(!c||typeof sbAuth==='undefined'||!sbAuth)return;
    const heading=findPendingHeading(c);
    if(!heading)return;
    heading.textContent='Aportes individuales pendientes de publicación';
    clearLegacyPendingArea(heading);
    let host=document.getElementById('individualAdminPendingHost');
    if(!host){host=document.createElement('div');host.id='individualAdminPendingHost';heading.insertAdjacentElement('afterend',host)}
    host.innerHTML='<div class="card"><p class="muted">Cargando solicitudes validadas por Coordinación…</p></div>';
    try{
      const rows=await loadPendingRequests();
      renderPendingRows(host,rows);
    }catch(err){
      console.error('No fue posible cargar solicitudes individuales pendientes:',err);
      host.innerHTML='<div class="notice"><b>No fue posible cargar los aportes pendientes de decisión.</b> Recargue la sección.</div>';
    }
  }

  window.verAportePendienteAdmin=function(id){
    const r=pendingIndividualRequests.find(x=>String(x.id)===String(id));
    const host=document.getElementById('individualAdminDecisionDetail');
    if(!r||!host)return;
    const s=requestSnapshot(r),mesa=r.individual_review_requests?.technical_tables?.name||'';
    host.innerHTML='<div class="card" style="margin-top:14px;border:2px solid #dbe7f2">'+
      '<div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap"><div><span class="pill amber">PENDIENTE ADMINISTRACIÓN</span><h2 style="margin:10px 0 4px;color:#123b67">'+esc(s.title)+'</h2><div class="muted"><b>Autor:</b> '+esc(s.author_name)+(s.author_profession?' · '+esc(s.author_profession):'')+(mesa?'<br><b>Mesa:</b> '+esc(mesa):'')+' · <b>Versión:</b> '+esc(r.version)+'</div></div><button class="btn soft" onclick="document.getElementById(\'individualAdminDecisionDetail\').innerHTML=\'\'">Cerrar</button></div>'+ 
      (s.summary?'<h3 style="color:#123b67">Resumen</h3><p style="white-space:pre-wrap">'+esc(s.summary)+'</p>':'')+
      '<hr style="border:0;border-top:1px solid #dfe7ef;margin:18px 0">'+(s.body?'<div style="line-height:1.7">'+s.body+'</div>':'<p class="muted">Sin contenido disponible.</p>')+
      '<hr style="border:0;border-top:1px solid #dfe7ef;margin:18px 0"><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn success" onclick="publicarAporteIndividualAdmin('+r.id+')">Publicar</button><button class="btn danger" onclick="devolverAporteIndividualAdmin('+r.id+')">Devolver con observación</button></div></div>';
    host.scrollIntoView({behavior:'smooth',block:'start'});
  };

  window.devolverAporteIndividualAdmin=async function(id){
    const r=pendingIndividualRequests.find(x=>String(x.id)===String(id));
    if(!r)return;
    const obs=prompt('Indique la observación que recibirá el autor para corregir el aporte:','');
    if(obs===null)return;
    if(!obs.trim()){alert('Debe escribir una observación antes de devolver el aporte.');return}
    if(!confirm('¿Devolver este aporte al autor para corrección?'))return;
    try{
      const now=new Date().toISOString();
      const {error:reqErr}=await sbAuth.from('individual_publication_requests').update({status:'Devuelta',observation:obs.trim(),responded_at:now}).eq('id',id).eq('status','Pendiente');
      if(reqErr)throw reqErr;
      const {error:conErr}=await sbAuth.from('individual_contributions').update({status:'En elaboración',admin_observation:obs.trim(),updated_at:now}).eq('id',r.contribution_id);
      if(conErr)throw conErr;
      alert('Aporte devuelto correctamente. La observación quedó registrada y el autor puede corregirlo.');
      await window.adminPublicaciones();
    }catch(err){
      console.error(err);alert('No fue posible devolver el aporte. No se aplicó una decisión completa.');
    }
  };

  window.publicarAporteIndividualAdmin=async function(id){
    const r=pendingIndividualRequests.find(x=>String(x.id)===String(id));
    if(!r)return;
    const s=requestSnapshot(r);
    if(!confirm('¿Publicar “'+s.title+'” en la Biblioteca pública?'))return;
    try{
      const now=new Date().toISOString();
      const mesaId=r.individual_review_requests?.technical_table_id||null;
      const {data:existing,error:existingErr}=await sbAuth.from('public_library').select('id').eq('source_contribution_id',r.contribution_id).eq('is_public',true).limit(1);
      if(existingErr)throw existingErr;
      if(!existing?.length){
        const {error:libErr}=await sbAuth.from('public_library').insert({
          technical_table_id:mesaId,
          publication_request_id:null,
          title:s.title,
          topic:s.topic||mesaId?String(s.topic||'Aporte individual'):'Aporte individual',
          description:s.summary||'Aporte individual aprobado por Administración.',
          snapshot:{...s,version:r.version,origin:'individual_contribution',individual_publication_request_id:r.id},
          published_at:now,
          is_public:true,
          origin_type:'individual',
          author_id:r.requested_by,
          author_name:s.author_name,
          source_contribution_id:r.contribution_id
        });
        if(libErr)throw libErr;
      }
      const {error:reqErr}=await sbAuth.from('individual_publication_requests').update({status:'Publicada',observation:null,responded_at:now}).eq('id',id).eq('status','Pendiente');
      if(reqErr)throw reqErr;
      const {error:conErr}=await sbAuth.from('individual_contributions').update({status:'Publicado',admin_observation:null,updated_at:now}).eq('id',r.contribution_id);
      if(conErr)throw conErr;
      alert('Aporte publicado correctamente en la Biblioteca.');
      await window.adminPublicaciones();
    }catch(err){
      console.error(err);alert('No fue posible completar la publicación del aporte.');
    }
  };

  window.adminPublicaciones=async function(){
    const result=await previousAdminPublicaciones.apply(this,arguments);
    await renderAdminPendingCycle();
    return result;
  };
})();
