/* Auditoría y corrección integral de Aportes individuales — 05-10-2026 */
(function(){
  'use strict';

  const baseAdminPublicaciones = window.adminPublicaciones;
  const baseRenderAportes = window.renderAportes;
  if (typeof baseAdminPublicaciones !== 'function') return;

  const safe = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const fmtDate = value => { try{return new Date(value).toLocaleString('es-CL')}catch(e){return String(value||'')} };

  function openReviewSnapshot(row){
    const s=row?.snapshot||{};
    const w=window.open('','_blank');
    if(!w){alert('El navegador bloqueó la vista. Habilite ventanas emergentes para revisar el aporte.');return}
    w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>'+safe(s.title||'Aporte individual')+'</title><style>body{font-family:Arial,sans-serif;max-width:900px;margin:40px auto;padding:0 24px;line-height:1.7}.meta{background:#f4f7fb;padding:14px;border-radius:10px}h1,h2,h3{color:#123b67}.pill{display:inline-block;padding:4px 8px;border-radius:999px;background:#fff5df;color:#9a6800;font-size:12px;font-weight:bold}</style></head><body><h1>'+safe(s.title||'Aporte individual')+'</h1><div class="meta"><span class="pill">EN REVISIÓN DE MESA</span><br><br><b>Autor:</b> '+safe(s.author_name||'Profesional')+(s.author_profession?' · '+safe(s.author_profession):'')+'<br><b>Mesa revisora:</b> '+safe(row?.technical_tables?.name||'')+' · <b>Versión:</b> '+safe(row?.version||'')+' · <b>Enviado:</b> '+safe(fmtDate(row?.requested_at))+'</div>'+(s.summary?'<h2>Resumen</h2><p>'+safe(s.summary)+'</p>':'')+'<hr><div>'+(s.body||'')+'</div><hr><p><b>Estado del flujo:</b> este aporte todavía está siendo revisado por la Mesa Técnica. Administración puede verlo para seguimiento, pero solo podrá publicarlo o devolverlo después de que la Coordinación valide la revisión y genere la solicitud formal de publicación.</p></body></html>');
    w.document.close();
  }

  async function renderReviewTracking(){
    const c=document.getElementById('admincontent');
    if(!c || typeof sbAuth==='undefined' || !sbAuth) return;

    const publicationHeading=[...c.querySelectorAll('h2')].find(h=>h.textContent.trim()==='Aportes individuales pendientes');
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
        return '<div class="row"><div><span class="pill amber">EN REVISIÓN DE MESA</span> <b>'+safe(s.title||'Aporte individual')+'</b><br><small>Autor: '+safe(s.author_name||'Profesional')+(s.author_profession?' · '+safe(s.author_profession):'')+' · Mesa '+safe(r.technical_tables?.name||'')+' · '+safe(s.document_type||'')+' · '+safe(s.topic||'')+' · Versión '+safe(r.version)+' · '+approvals+' vistos buenos · '+messages+' mensajes · '+safe(fmtDate(r.requested_at))+'</small></div><div><button class="btn soft" type="button" data-review-id="'+safe(r.id)+'">Ver aporte</button><div class="muted" style="font-size:12px;margin-top:6px;max-width:260px">Pendiente de validación de la Coordinación. Aún no corresponde Publicar ni Devolver desde Administración.</div></div></div>';
      }).join(''):'<div class="card"><p>No hay aportes actualmente en revisión de Mesa.</p></div>';

      section.innerHTML='<h2 class="section-sub">Aportes individuales en revisión de Mesa</h2><div class="mini-note" style="margin-bottom:10px"><b>Seguimiento administrativo.</b> Estos aportes ya fueron enviados por sus autores y deben ser revisados por la Mesa Técnica. Administración puede verlos, pero las acciones <b>Publicar</b> y <b>Devolver</b> se habilitan recién cuando la Coordinación valida la revisión.</div>'+html;
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
