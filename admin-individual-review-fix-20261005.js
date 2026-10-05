/* Auditoría y corrección integral de Aportes individuales — 05-10-2026 */
(function(){
  'use strict';

  const baseAdminPublicaciones = window.adminPublicaciones;
  const baseRenderAportes = window.renderAportes;
  if (typeof baseAdminPublicaciones !== 'function') return;

  const safe = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[ch]));
  const fmtDate = value => { try{return new Date(value).toLocaleString('es-CL')}catch(e){return String(value||'')} };

  async function resolveContribution(row){
    const snapshot={...(row?.snapshot||{})};
    if(typeof sbAuth==='undefined'||!sbAuth||!row?.contribution_id)return snapshot;
    try{
      const {data,error}=await sbAuth.from('individual_contributions')
        .select('id,title,document_type,topic,summary,body,status,version,created_at,updated_at,profiles:author_id(full_name,profession)')
        .eq('id',row.contribution_id)
        .maybeSingle();
      if(error||!data)return snapshot;
      return {
        ...data,
        ...snapshot,
        title:snapshot.title||data.title||'Aporte individual',
        document_type:snapshot.document_type||data.document_type||'',
        topic:snapshot.topic||data.topic||'',
        summary:snapshot.summary||data.summary||'',
        body:snapshot.body||data.body||'',
        author_name:snapshot.author_name||data.profiles?.full_name||'Profesional',
        author_profession:snapshot.author_profession||data.profiles?.profession||''
      };
    }catch(e){
      console.warn('No fue posible completar el aporte desde su registro principal:',e);
      return snapshot;
    }
  }

  async function openReviewSnapshot(row){
    const host=document.getElementById('individualReviewDetail');
    if(!host||!row)return;
    host.innerHTML='<div class="card"><p class="muted">Abriendo aporte…</p></div>';
    host.scrollIntoView({behavior:'smooth',block:'start'});
    const s=await resolveContribution(row);
    const body=String(s.body||'').trim();
    const summary=String(s.summary||'').trim();
    host.innerHTML='<div class="card" style="margin-top:14px;border:2px solid #dbe7f2">'+
      '<div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap">'+
      '<div><span class="pill amber">EN REVISIÓN DE MESA</span><h2 style="margin:10px 0 4px;color:#123b67">'+safe(s.title||'Aporte individual')+'</h2>'+ 
      '<div class="muted"><b>Autor:</b> '+safe(s.author_name||'Profesional')+(s.author_profession?' · '+safe(s.author_profession):'')+'<br><b>Mesa revisora:</b> '+safe(row?.technical_tables?.name||'')+' · <b>Versión:</b> '+safe(row?.version||s.version||'')+' · <b>Enviado:</b> '+safe(fmtDate(row?.requested_at))+'</div></div>'+ 
      '<button class="btn soft" type="button" onclick="document.getElementById(\'individualReviewDetail\').innerHTML=\'\'">Cerrar</button></div>'+ 
      (summary?'<h3 style="color:#123b67;margin-bottom:6px">Resumen</h3><p style="white-space:pre-wrap">'+safe(summary)+'</p>':'')+
      '<hr style="border:0;border-top:1px solid #dfe7ef;margin:18px 0">'+
      (body?'<div style="line-height:1.7">'+body+'</div>':'<div class="notice"><b>Este aporte no tiene contenido visible en la copia de revisión.</b> Se consultó también el registro principal del aporte.</div>')+
      '<hr style="border:0;border-top:1px solid #dfe7ef;margin:18px 0">'+
      '<div class="mini-note"><b>Estado del flujo:</b> este aporte está siendo revisado por la Mesa Técnica. Administración puede verlo para seguimiento; Publicar o Devolver se habilita después de la validación de Coordinación.</div></div>';
  }

  async function renderReviewTracking(){
    const c=document.getElementById('admincontent');
    if(!c || typeof sbAuth==='undefined' || !sbAuth) return;

    const publicationHeading=[...c.querySelectorAll('h2')].find(h=>h.textContent.trim()==='Aportes individuales pendientes'||h.textContent.trim()==='Aportes individuales pendientes de publicación');
    if(!publicationHeading) return;
    publicationHeading.textContent='Aportes individuales pendientes de publicación';

    c.querySelector('#individualReviewTracking')?.remove();
    const section=document.createElement('div');
    section.id='individualReviewTracking';
    section.innerHTML='<h2 class="section-sub">Aportes individuales en revisión de Mesa</h2><div class="card"><p class="muted">Cargando aportes en revisión…</p></div>';
    publicationHeading.before(section);

    try{
      const [{data:rows,error},{data:feedback,error:feedbackError}]=await Promise.all([
        sbAuth.from('individual_review_requests')
          .select('id,contribution_id,technical_table_id,requested_by,version,snapshot,status,requested_at,closed_at,coordinator_observation,technical_tables(name)')
          .eq('status','En revisión')
          .order('requested_at',{ascending:false}),
        sbAuth.from('individual_review_feedback')
          .select('review_request_id,feedback_type')
      ]);
      if(error)throw error;
      if(feedbackError)console.warn('No se pudo contar toda la actividad de revisión:',feedbackError);

      const list=rows||[];
      const html=list.length?list.map(r=>{
        const s=r.snapshot||{};
        const fb=(feedback||[]).filter(x=>String(x.review_request_id)===String(r.id));
        const approvals=fb.filter(x=>x.feedback_type==='Visto bueno').length;
        const messages=fb.filter(x=>x.feedback_type==='Mensaje').length;
        return '<div class="row"><div><span class="pill amber">EN REVISIÓN DE MESA</span> <b>'+safe(s.title||'Aporte individual')+'</b><br><small>Autor: '+safe(s.author_name||'Profesional')+(s.author_profession?' · '+safe(s.author_profession):'')+' · Mesa '+safe(r.technical_tables?.name||'')+' · '+safe(s.document_type||'')+' · '+safe(s.topic||'')+' · Versión '+safe(r.version)+' · '+approvals+' vistos buenos · '+messages+' mensajes · '+safe(fmtDate(r.requested_at))+'</small></div><div><button class="btn soft" type="button" data-review-id="'+safe(r.id)+'">Ver aporte completo</button><div class="muted" style="font-size:12px;margin-top:6px;max-width:260px">Pendiente de validación de la Coordinación.</div></div></div>';
      }).join(''):'<div class="card"><p>No hay aportes actualmente en revisión de Mesa.</p></div>';

      section.innerHTML='<h2 class="section-sub">Aportes individuales en revisión de Mesa</h2><div class="mini-note" style="margin-bottom:10px"><b>Seguimiento administrativo.</b> Aquí se muestran todos los aportes enviados a revisión, no solo el más reciente.</div>'+html+'<div id="individualReviewDetail"></div>';
      section.querySelectorAll('[data-review-id]').forEach(btn=>{
        const id=btn.getAttribute('data-review-id');
        btn.addEventListener('click',()=>openReviewSnapshot(list.find(x=>String(x.id)===String(id))));
      });
    }catch(err){
      console.error('Error al cargar seguimiento de aportes individuales:',err);
      section.innerHTML='<h2 class="section-sub">Aportes individuales en revisión de Mesa</h2><div class="notice"><b>No fue posible consultar los aportes en revisión.</b> Recargue esta sección. Si el problema persiste, revise la sesión de Supabase.</div>';
    }
  }

  window.adminPublicaciones=async function(){
    const result=await baseAdminPublicaciones.apply(this,arguments);
    await renderReviewTracking();
    return result;
  };

  if(typeof baseRenderAportes==='function'){
    window.renderAportes=async function(){
      const result=await baseRenderAportes.apply(this,arguments);
      const c=arguments[0]||document.getElementById('privatecontent');
      if(c){
        const title=[...c.querySelectorAll('h1')].find(x=>x.textContent.trim()==='Mis aportes');
        if(title&&!c.querySelector('#individualFlowNote')){
          const note=document.createElement('div');
          note.id='individualFlowNote';note.className='mini-note';note.style.margin='10px 0 14px';
          note.innerHTML='<b>Flujo del aporte individual:</b> En elaboración → En revisión de Mesa → Validación de Coordinación → Solicitud de publicación → Administración → Publicado o Devuelto. Mientras diga <b>En revisión de Mesa</b>, el aporte está correctamente enviado y permanece bloqueado para evitar cambios sobre la versión que está siendo revisada.';
          title.insertAdjacentElement('afterend',note);
        }
      }
      return result;
    };
  }
})();
