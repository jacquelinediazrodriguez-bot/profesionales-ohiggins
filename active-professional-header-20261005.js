(function(){
  const STYLE_ID='active-professional-header-style';
  const BADGE_ID='activeProfessionalHeader';

  function ensureStyle(){
    if(document.getElementById(STYLE_ID))return;
    const s=document.createElement('style');
    s.id=STYLE_ID;
    s.textContent=`
      .top{flex-wrap:wrap}
      .active-professional-header{display:none;align-items:center;gap:8px;margin-left:auto;padding:8px 12px;border:1px solid var(--line);border-radius:12px;background:#f7fafc;color:var(--ink);font-size:13px;line-height:1.25;white-space:nowrap}
      .active-professional-header.visible{display:flex}
      .active-professional-header .aph-label{color:var(--muted);font-weight:700}
      .active-professional-header .aph-name{color:var(--blue);font-weight:850}
      .active-professional-header .aph-role{display:inline-block;padding:3px 7px;border-radius:999px;background:#eaf1f7;color:var(--blue);font-size:11px;font-weight:800}
      @media(max-width:900px){.active-professional-header{order:3;width:100%;margin:2px 0 0;justify-content:center;white-space:normal;text-align:center;flex-wrap:wrap}}
      @media(max-width:520px){.active-professional-header{font-size:12px;padding:7px 9px}.active-professional-header .aph-role{font-size:10px}}
    `;
    document.head.appendChild(s);
  }

  function getUser(){
    try{return JSON.parse(sessionStorage.getItem('frentePT_user')||'null')}catch(e){return null}
  }

  function ensureBadge(){
    const top=document.querySelector('header .top');
    if(!top)return null;
    let badge=document.getElementById(BADGE_ID);
    if(!badge){
      badge=document.createElement('div');
      badge.id=BADGE_ID;
      badge.className='active-professional-header';
      badge.setAttribute('aria-live','polite');
      const nav=document.getElementById('publicNav');
      if(nav)top.insertBefore(badge,nav);else top.appendChild(badge);
    }
    return badge;
  }

  function render(){
    ensureStyle();
    const badge=ensureBadge();
    if(!badge)return;
    const user=getUser();
    if(!user||!user.nombre){
      badge.classList.remove('visible');
      badge.innerHTML='';
      return;
    }
    const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    badge.innerHTML='<span class="aph-label">Profesional conectado:</span><span class="aph-name">'+esc(user.nombre)+'</span>'+(user.rol?'<span class="aph-role">'+esc(user.rol)+'</span>':'');
    badge.classList.add('visible');
  }

  render();
  document.addEventListener('click',()=>setTimeout(render,80),true);
  window.addEventListener('storage',render);
  setInterval(render,700);
})();
