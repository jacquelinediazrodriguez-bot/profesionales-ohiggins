/* Volver a publicar + filtros desde Historial de Biblioteca — 07-10-2026 */
(function(){
'use strict';

const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function getCurrentUser(){
  try{return (typeof currentUser!=='undefined')?currentUser:null}catch(e){return null}
}
function getSb(){
  try{return (typeof sbAuth!=='undefined'&&sbAuth)?sbAuth:null}catch(e){return null}
}
function canRepublish(){
  try{
    const u=getCurrentUser();
    return !!u && (u.rol==='Administrador General' || u.systemRole==='administrador_general');
  }catch(e){ return false; }
}

function findHistory(){
  const c=document.getElementById('admincontent');
  if(!c)return null;
  const h=[...c.querySelectorAll('h2,h3')].find(el=>/Historial de Biblioteca/i.test(el.textContent||''));
  if(!h)return null;

  // El historial puede renderizar sus tarjetas dentro de contenedores auxiliares.
  // No dependemos de que cada .row sea hermano directo del título.
  let rows=[...c.querySelectorAll('.row')].filter(row=>{
    const txt=norm(row.textContent||'');
    return txt.includes('motivo del retiro') ||
      txt.includes('retirado de publicacion') ||
      txt.includes('ver pdf oficial');
  });

  // Respaldo para futuras variantes de marcado.
  if(!rows.length){
    const all=[...c.querySelectorAll('div,article')];
    rows=all.filter(row=>{
      const txt=norm(row.textContent||'');
      return txt.includes('motivo del retiro') &&
        (txt.includes('ver pdf oficial')||txt.includes('retirado de publicacion'));
    }).filter(row=>!rows.some(x=>x!==row&&row.contains(x)));
  }
  return {c,h,rows};
}

function pickRowPublication(row,items,used){
  const txt=norm(row.textContent);
  const matches=items
    .filter(p=>!used.has(String(p.id)) && p.title && txt.includes(norm(p.title)))
    .sort((a,b)=>new Date(b.withdrawn_at||b.republished_at||b.published_at||0)-new Date(a.withdrawn_at||a.republished_at||a.published_at||0));
  if(!matches.length)return null;
  const retired=matches.find(p=>p.withdrawn_at || !p.is_public);
  return retired||matches[0];
}

function ensureFilters(h,rows){
  let box=document.getElementById('libraryHistoryFilters');
  if(!box){
    box=document.createElement('div');
    box.id='libraryHistoryFilters';
    box.className='card';
    box.style.margin='12px 0 14px';
    box.innerHTML=
      '<div style="display:grid;grid-template-columns:2fr 1.2fr 1fr 1fr 1.1fr auto;gap:10px;align-items:end">'+
      '<div><label>Buscar documento</label><input id="historySearch" placeholder="Título del documento"></div>'+
      '<div><label>Mesa</label><select id="historyMesa"><option value="">Todas las Mesas</option></select></div>'+
      '<div><label>Desde</label><input id="historyFrom" type="date"></div>'+
      '<div><label>Hasta</label><input id="historyTo" type="date"></div>'+
      '<div><label>Estado</label><select id="historyStatus"><option value="">Todos</option><option value="retirado">Retirado</option><option value="republicado">Republicado</option><option value="publicado">Publicado</option></select></div>'+
      '<div><button id="historyClear" class="btn soft" type="button">Limpiar</button></div>'+
      '</div>'+
      '<div id="historyFilterCount" class="muted" style="margin-top:9px"></div>'+
      '<style>@media(max-width:760px){#libraryHistoryFilters>div:first-child{grid-template-columns:1fr!important}}</style>';
    h.insertAdjacentElement('afterend',box);
  }

  const mesa=document.getElementById('historyMesa');
  if(mesa){
    const current=mesa.value;
    const values=[...new Set(rows.map(r=>r.dataset.mesa).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
    mesa.innerHTML='<option value="">Todas las Mesas</option>'+values.map(m=>'<option value="'+esc(m)+'">'+esc(m)+'</option>').join('');
    if(values.includes(current))mesa.value=current;
  }

  const apply=()=>{
    const q=norm(document.getElementById('historySearch')?.value||'');
    const m=norm(document.getElementById('historyMesa')?.value||'');
    const from=document.getElementById('historyFrom')?.value||'';
    const to=document.getElementById('historyTo')?.value||'';
    const status=norm(document.getElementById('historyStatus')?.value||'');
    let visible=0;
    rows.forEach(r=>{
      const title=norm(r.dataset.title||r.textContent||'');
      const mesaVal=norm(r.dataset.mesa||'');
      const date=(r.dataset.date||'').slice(0,10);
      const state=norm(r.dataset.status||'');
      const ok=(!q||title.includes(q)) &&
        (!m||mesaVal===m) &&
        (!from||!date||date>=from) &&
        (!to||!date||date<=to) &&
        (!status||state===status);
      r.style.display=ok?'':'none';
      if(ok)visible++;
    });
    const out=document.getElementById('historyFilterCount');
    if(out)out.textContent='Mostrando '+visible+' de '+rows.length+' documentos.';
  };

  ['historySearch','historyMesa','historyFrom','historyTo','historyStatus'].forEach(id=>{
    const el=document.getElementById(id);
    if(el&&!el.dataset.bound){
      el.addEventListener(id==='historySearch'?'input':'change',apply);
      el.dataset.bound='1';
    }
  });

  const clear=document.getElementById('historyClear');
  if(clear&&!clear.dataset.bound){
    clear.addEventListener('click',()=>{
      ['historySearch','historyMesa','historyFrom','historyTo','historyStatus'].forEach(id=>{
        const el=document.getElementById(id);if(el)el.value='';
      });
      apply();
    });
    clear.dataset.bound='1';
  }
  apply();
}

let decorating=false;
let lastDecoration=0;
async function decorateRepublish(){
  // Prevent the DOM observer from causing overlapping or recursive database reads.
  if(decorating || Date.now()-lastDecoration<3000)return;
  const block=findHistory();
  const sb=getSb();
  if(!block || !sb || !block.rows.length)return;

  decorating=true;
  lastDecoration=Date.now();
  let data,error;
  try{
    ({data,error}=await sb.from('public_library')
      .select('id,title,is_public,published_at,withdrawn_at,withdrawal_reason,republished_at,republish_count,technical_table_id,technical_tables(name)')
      .order('published_at',{ascending:false}));
  }catch(e){console.warn('No se pudo consultar historial',e);return;}
  finally{decorating=false;}
  if(error){ console.warn('No se pudo preparar Historial de Biblioteca',error); return; }

  const used=new Set();
  block.rows.forEach(row=>{
    const p=pickRowPublication(row,data||[],used);
    if(!p)return;
    used.add(String(p.id));

    row.dataset.title=p.title||'';
    row.dataset.mesa=p.technical_tables?.name||'';
    row.dataset.date=p.withdrawn_at||p.republished_at||p.published_at||'';
    row.dataset.status=p.republished_at&&p.is_public?'republicado':(p.withdrawn_at||!p.is_public?'retirado':'publicado');

    const actions=row.querySelector('.toolbar-row')||row.querySelector('div:last-child')||row.lastElementChild;
    if(actions && canRepublish() && (p.withdrawn_at||!p.is_public) && !actions.querySelector('[data-republish-id]')){
      const btn=document.createElement('button');
      btn.className='btn success';
      btn.type='button';
      btn.textContent='Volver a publicar';
      btn.dataset.republishId=String(p.id);
      btn.onclick=()=>window.volverAPublicar(p.id,p.title||'este documento');
      actions.appendChild(btn);
    }

    if(p.republished_at && !row.querySelector('[data-republished-info]')){
      const left=row.firstElementChild||row;
      const info=document.createElement('p');
      info.className='muted';
      info.dataset.republishedInfo='1';
      const n=Number(p.republish_count||1);
      info.innerHTML='<b>Republicado:</b> '+new Date(p.republished_at).toLocaleString('es-CL')+(n>1?' · '+n+' republicaciones':'');
      left.appendChild(info);
    }
  });

  ensureFilters(block.h,block.rows);
}

window.volverAPublicar=async function(id,title){
  if(!canRepublish())return alert('Solo Administración General puede volver a publicar documentos.');
  const ok=confirm('¿Volver a publicar “'+String(title||'este documento')+'” en la Biblioteca pública?\n\nSe conservarán el PDF oficial, la fecha y el motivo del retiro anterior.');
  if(!ok)return;

  const sb=getSb();
  if(!sb)return alert('No hay conexión disponible con la base de datos.');
  const {error}=await sb.rpc('republish_publication',{p_library_id:Number(id)});
  if(error){
    console.error(error);
    const msg=String(error.message||'');
    if(/newer public version/i.test(msg)){
      return alert('No se puede volver a publicar porque ya existe una versión posterior publicada de este documento.');
    }
    return alert('No se pudo volver a publicar el documento.');
  }

  if(typeof window.loadPublicLibrary==='function')await window.loadPublicLibrary();
  if(typeof refreshSharedAdmin==='function')await refreshSharedAdmin();
  if(typeof window.adminPublicaciones==='function')await window.adminPublicaciones();
  alert('Documento publicado nuevamente. Se conserva el historial del retiro anterior.');
};

const base=window.adminPublicaciones;
if(typeof base==='function'){
  window.adminPublicaciones=async function(){
    const r=await base.apply(this,arguments);
    await decorateRepublish();
    return r;
  };
}

const observer=new MutationObserver(mutations=>{
  // Only genuinely new history rows/headings warrant a refresh.
  // Changes to our own filters and labels must never trigger a remote read.
  const relevant=mutations.some(m=>{
    const target=m.target;
    if(!(target instanceof Element) || !target.closest('#admincontent'))return false;
    if(target.closest('#libraryHistoryFilters'))return false;
    return [...m.addedNodes].some(node=>node.nodeType===1 &&
      (node.matches?.('.row,h2,h3,#admincontent') || node.querySelector?.('.row,h2,h3')) &&
      !node.closest?.('#libraryHistoryFilters'));
  });
  if(!relevant)return;
  clearTimeout(window.__libraryHistoryTimer);
  window.__libraryHistoryTimer=setTimeout(decorateRepublish,650);
});
observer.observe(document.documentElement,{subtree:true,childList:true});
setTimeout(decorateRepublish,300);

})();