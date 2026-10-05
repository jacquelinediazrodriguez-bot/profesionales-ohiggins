/* Corrección 05-10-2026: Administración debe mostrar aportes individuales cuyo estado real es "En revisión". */
(function(){
  'use strict';

  const originalAdminPublicaciones = window.adminPublicaciones;
  if (typeof originalAdminPublicaciones !== 'function') return;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

  async function completarAportesEnRevision(){
    try{
      if (!window.sbAuth) return;
      const c = document.getElementById('admincontent') || document.getElementById('privatecontent');
      if (!c) return;

      const heading = [...c.querySelectorAll('h2')].find(h => h.textContent.trim() === 'Aportes individuales pendientes');
      if (!heading) return;

      const {data, error} = await window.sbAuth
        .from('individual_review_requests')
        .select('id,contribution_id,requested_by,version,snapshot,status,requested_at')
        .in('status', ['Pendiente','En revisión'])
        .order('requested_at', {ascending:false});

      if (error){
        console.error('No se pudieron cargar los aportes individuales pendientes:', error);
        return;
      }

      const rows = data || [];
      let node = heading.nextElementSibling;
      while (node && node.tagName !== 'H2'){
        const next = node.nextElementSibling;
        node.remove();
        node = next;
      }

      if (!rows.length){
        const empty = document.createElement('div');
        empty.className = 'card';
        empty.innerHTML = '<p>No hay aportes individuales pendientes.</p>';
        heading.insertAdjacentElement('afterend', empty);
        return;
      }

      const frag = document.createDocumentFragment();
      rows.forEach(x => {
        const snap = x.snapshot || {};
        const row = document.createElement('div');
        row.className = 'row';
        row.innerHTML = '<div><span class="pill amber">Aporte individual</span> <b>'+esc(snap.title || 'Aporte individual')+'</b><br>'+
          '<small>Autor: '+esc(snap.author_name || 'Profesional')+
          (snap.author_profession ? ' · '+esc(snap.author_profession) : '')+
          (snap.document_type ? ' · '+esc(snap.document_type) : '')+
          (snap.topic ? ' · '+esc(snap.topic) : '')+
          ' · Versión '+esc(x.version)+
          ' · '+esc((snap.reviewers || []).length)+' vistos buenos'+
          ' · '+esc(new Date(x.requested_at).toLocaleString('es-CL'))+'</small></div>'+
          '<div><button class="btn soft" type="button" data-action="view">Ver aporte</button> '+
          '<button class="btn primary" type="button" data-action="publish">Publicar</button> '+
          '<button class="btn soft" type="button" data-action="return">Devolver</button></div>';

        row.querySelector('[data-action="view"]')?.addEventListener('click', () => window.verSolicitudAporteIndividual?.(x.id));
        row.querySelector('[data-action="publish"]')?.addEventListener('click', () => window.publicarAporteIndividual?.(x.id));
        row.querySelector('[data-action="return"]')?.addEventListener('click', () => window.devolverAporteIndividual?.(x.id));
        frag.appendChild(row);
      });
      heading.after(frag);
    }catch(err){
      console.error('Corrección de aportes individuales pendientes:', err);
    }
  }

  window.adminPublicaciones = async function(){
    const result = await originalAdminPublicaciones.apply(this, arguments);
    await completarAportesEnRevision();
    return result;
  };
})();
