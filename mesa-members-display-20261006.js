/* Mesas registradas: mostrar nombres y roles de integrantes — 06-10-2026 */
(function(){
'use strict';

function esc(v){
  if(typeof window.esc==='function') return window.esc(String(v??''));
  return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function decorateMesaCards(){
  const c=document.getElementById('admincontent');
  if(!c || typeof window.getIntegrantes!=='function') return;

  const headings=[...c.querySelectorAll('h2.section-sub')];
  const h=headings.find(x=>(x.textContent||'').trim()==='Mesas registradas');
  if(!h) return;
  const grid=h.nextElementSibling;
  if(!grid) return;

  const integrantes=(window.getIntegrantes()||[]).filter(x=>x && x.rol!=='Administrador General');

  [...grid.querySelectorAll('.card')].forEach(card=>{
    if(card.querySelector('.mesa-members-detail')) return;
    const title=(card.querySelector('h3')?.textContent||'').trim();
    if(!title) return;
    const miembros=integrantes.filter(x=>String(x.mesa||'').trim()===title);

    const box=document.createElement('div');
    box.className='mesa-members-detail';
    box.style.margin='12px 0 14px';
    box.style.padding='10px 12px';
    box.style.border='1px solid var(--line)';
    box.style.borderRadius='10px';
    box.style.background='#f8fbfd';

    box.innerHTML='<b style="display:block;margin-bottom:7px">Integrantes de la Mesa</b>'+
      (miembros.length
        ? '<div style="display:grid;gap:7px">'+miembros.map(x=>
            '<div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;padding-bottom:6px;border-bottom:1px solid var(--line)">'+
              '<span>'+esc(x.nombre||x.correo||'Sin nombre')+'</span>'+
              '<span class="pill" style="white-space:nowrap">'+esc(x.rol||'Integrante de Mesa')+'</span>'+
            '</div>'
          ).join('')+'</div>'
        : '<span class="muted">Sin integrantes asignados.</span>');

    const toolbar=card.querySelector('.toolbar-row');
    if(toolbar) card.insertBefore(box,toolbar);
    else card.appendChild(box);
  });
}

const base=window.adminMesas;
if(typeof base==='function'){
  window.adminMesas=function(){
    const r=base.apply(this,arguments);
    decorateMesaCards();
    return r;
  };
}
})();
