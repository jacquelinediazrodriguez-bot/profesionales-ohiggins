/* Administrador de Plataforma como permiso global adicional — 06-10-2026
   Optimización 06-10-2026: evita consultas en cada clic y observación global del DOM. */
(function(){
'use strict';

let syncingPermission=false;
let lastPermissionSync=0;
const PERMISSION_SYNC_TTL=30000;

async function syncPlatformAdminPermission(force){
  const now=Date.now();
  if(syncingPermission)return;
  if(!force && now-lastPermissionSync<PERMISSION_SYNC_TTL)return;
  try{
    if(typeof currentUser==='undefined'||!currentUser?.supabaseId)return;
    if(typeof sbAuth==='undefined'||!sbAuth)return;
    syncingPermission=true;
    const {data,error}=await sbAuth.from('profiles').select('role,is_platform_admin,is_active').eq('id',currentUser.supabaseId).maybeSingle();
    if(error||!data||data.is_active===false)return;
    lastPermissionSync=Date.now();
    currentUser.accountRole=data.role||'integrante';
    currentUser.isPlatformAdmin=data.is_platform_admin===true;
    currentUser.systemRole=data.role==='administrador_general'?'administrador_general':(data.is_platform_admin===true?'administrador_plataforma':data.role||'integrante');
    if(currentUser.systemRole==='administrador_general')currentUser.rol='Administrador General';
    else if(currentUser.systemRole==='administrador_plataforma')currentUser.rol='Administrador de Plataforma';
    try{sessionStorage.setItem('frentePT_user',JSON.stringify(currentUser))}catch(e){}
  }catch(e){console.warn('No se pudo sincronizar el permiso de Administrador de Plataforma',e)}
  finally{syncingPermission=false}
}

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
    await syncPlatformAdminPermission(true);
    const r=await originalAdminUsuarios.apply(this,arguments);
    setTimeout(patchAdminRoleHelp,0);
    return r;
  };
}

/* Sincronización inicial única. El rol se vuelve a consultar al entrar
   a Administración de usuarios, no en cada interacción de la plataforma. */
setTimeout(async()=>{
  await syncPlatformAdminPermission(true);
  patchAdminRoleHelp();
},300);

})();