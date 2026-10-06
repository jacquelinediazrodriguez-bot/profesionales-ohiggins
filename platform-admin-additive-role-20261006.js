/* Administrador de Plataforma como permiso global adicional — 06-10-2026 */
(function(){
'use strict';

function patchAdminRoleHelp(){
  try{
    const c=document.getElementById('admincontent');
    if(!c)return;

    const notes=[...c.querySelectorAll('.notice,.mini-note')];
    for(const n of notes){
      const t=(n.textContent||'').trim();
      if(t.includes('Los roles globales de administración no reemplazan los roles de Mesa')){
        n.innerHTML='<b>Una persona = una cuenta.</b> El correo y la contraseña son únicos. A esa misma cuenta se le pueden agregar distintas Mesas y un rol diferente en cada una. <b>El permiso global de Administrador de Plataforma puede asignarse a cualquier integrante registrado, tenga o no una Mesa o un rol ya asignado, y no reemplaza, elimina ni modifica sus roles de Mesa.</b>';
      }
      if(t.includes('Solo el Administrador General puede asignar o retirar el rol de Administrador de Plataforma')){
        n.textContent='Solo el Administrador General puede asignar o retirar el permiso de Administrador de Plataforma. Puede otorgarse a cualquier integrante, aunque ya sea Integrante, Secretario/a Técnico/a o Coordinador/a de una Mesa; sus asignaciones se conservan.';
      }
    }

    const sel=document.getElementById('globalRoleValue');
    if(sel){
      const opt=[...sel.options].find(o=>o.value==='integrante');
      if(opt)opt.textContent='Quitar Administrador de Plataforma';
    }
  }catch(e){console.warn('No se pudo actualizar la ayuda de rol global',e)}
}

const originalAdminUsuarios=window.adminUsuarios;
if(typeof originalAdminUsuarios==='function'){
  window.adminUsuarios=async function(){
    const r=await originalAdminUsuarios.apply(this,arguments);
    setTimeout(patchAdminRoleHelp,0);
    return r;
  };
}

const observer=new MutationObserver(()=>patchAdminRoleHelp());
observer.observe(document.documentElement,{childList:true,subtree:true});
setTimeout(patchAdminRoleHelp,300);
})();