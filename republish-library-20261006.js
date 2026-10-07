/* Volver a publicar desde Historial de Biblioteca — 06-10-2026 */
(function(){
'use strict';

function canAdmin(){
  try{
    return typeof isReal==='function' && isReal() &&
      ['Administrador General','Administrador de Plataforma'].includes(currentUser?.rol);
  }catch(e){ return false; }
}

async function decorateRepublish(){
  const c=document.getElementById('admincontent');
  if(!c || !canAdmin() || !window.sbAuth) return;

  const {data,error}=await sbAuth.from('public_library')
    .select('id,title,is_public,published_at,withdrawn_at,withdrawal_reason,republished_at,republish_count')
    .order('published_at',{ascending:false});
  if(error){ console.warn('No se pudo preparar Volver a publicar',error); return; }

  const children=[...c.children];
  const h=children.find(el=>el.tagName==='H2' && /Historial de Biblioteca/i.test(el.textContent||''));
  if(!h)return;

  const rows=[];
  let node=h.nextElementSibling;
  while(node){
    if(node.tagName==='H2')break;
    if(node.classList?.contains('row'))rows.push(node);
    node=node.nextElementSibling;
  }

  (data||[]).forEach((p,i)=>{
    const row=rows[i];
    if(!row)return;
    const actions=row.querySelector('.toolbar-row');
    if(!actions)return;

    if(!p.is_public && !actions.querySelector('[data-republish-id]')){
      const btn=document.createElement('button');
      btn.className='btn success';
      btn.type='button';
      btn.textContent='Volver a publicar';
      btn.dataset.republishId=String(p.id);
      btn.onclick=()=>window.volverAPublicar(p.id,p.title||'este documento');
      actions.appendChild(btn);
    }

    if(p.republished_at && !row.querySelector('[data-republished-info]')){
      const left=row.firstElementChild;
      if(left){
        const info=document.createElement('p');
        info.className='muted';
        info.dataset.republishedInfo='1';
        const n=Number(p.republish_count||1);
        info.innerHTML='<b>Republicado:</b> '+new Date(p.republished_at).toLocaleString('es-CL')+
          (n>1?' · '+n+' republicaciones':'');
        left.appendChild(info);
      }
    }
  });
}

window.volverAPublicar=async function(id,title){
  if(!canAdmin())return;
  const ok=confirm('¿Volver a publicar “'+String(title||'este documento')+'” en la Biblioteca pública?\n\nSe conservarán el PDF oficial, la fecha y el motivo del retiro anterior.');
  if(!ok)return;

  const {error}=await sbAuth.rpc('republish_publication',{p_library_id:Number(id)});
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

})();
