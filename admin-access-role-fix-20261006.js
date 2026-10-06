/* Corrección robusta de permisos administrativos y navegación móvil — 06-10-2026 */
(function(){
'use strict';

const ROLE_MAP={
  'administrador_general':'administrador_general',
  'administrador general':'administrador_general',
  'administración general':'administrador_general',
  'administracion general':'administrador_general',
  'admin_general':'administrador_general',
  'administrador_plataforma':'administrador_plataforma',
  'administrador de plataforma':'administrador_plataforma',
  'administración de plataforma':'administrador_plataforma',
  'administracion de plataforma':'administrador_plataforma',
  'admin_plataforma':'administrador_plataforma'
};

function clean(v){
  return String(v||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
}

function canonicalRole(user){
  if(!user)return '';
  const rawSystem=String(user.systemRole||'').trim();
  if(rawSystem==='administrador_general'||rawSystem==='administrador_plataforma')return rawSystem;
  const systemKey=clean(rawSystem);
  const labelKey=clean(user.rol||user.role||'');
  return ROLE_MAP[systemKey]||ROLE_MAP[labelKey]||'';
}

function syncAdminRole(){
  try{
    if(typeof currentUser==='undefined'||!currentUser)return '';
    const role=canonicalRole(currentUser);
    if(!role)return '';
    currentUser.systemRole=role;
    currentUser.rol=role==='administrador_general'?'Administrador General':'Administrador de Plataforma';
    try{sessionStorage.setItem('frentePT_user',JSON.stringify(currentUser))}catch(e){}
    return role;
  }catch(e){return ''}
}

window.isAdminGeneral=function(){return syncAdminRole()==='administrador_general'};
window.isAdminPlataforma=function(){return syncAdminRole()==='administrador_plataforma'};
window.isAnyAdmin=function(){const r=syncAdminRole();return r==='administrador_general'||r==='administrador_plataforma'};
window.requireAdmin=function(generalOnly=false){
  const r=syncAdminRole();
  if(!r){
    if(typeof go==='function')go('mesas');
    return false;
  }
  if(generalOnly&&r!=='administrador_general'){
    alert('Esta función está reservada al Administrador General.');
    if(typeof adminHome==='function')adminHome();
    return false;
  }
  return true;
};

/* Sincronizar antes de cualquier navegación o render administrativo. */
const baseGo=window.go;
if(typeof baseGo==='function'){
  window.go=function(){syncAdminRole();return baseGo.apply(this,arguments)};
}
const baseRenderAdminShell=window.renderAdminShell;
if(typeof baseRenderAdminShell==='function'){
  window.renderAdminShell=function(){syncAdminRole();return baseRenderAdminShell.apply(this,arguments)};
}
const baseAdminHome=window.adminHome;
if(typeof baseAdminHome==='function'){
  window.adminHome=function(){syncAdminRole();return baseAdminHome.apply(this,arguments)};
}

/* Si la sesión ya estaba abierta al recargar, corregir el objeto local inmediatamente. */
syncAdminRole();
setTimeout(syncAdminRole,80);
setTimeout(syncAdminRole,350);
document.addEventListener('click',syncAdminRole,true);

/* Menú administrativo usable en iPhone: desplazamiento horizontal visible y controlado. */
function addMobileAdminStyle(){
  if(document.getElementById('adminAccessRoleFixStyle'))return;
  const s=document.createElement('style');
  s.id='adminAccessRoleFixStyle';
  s.textContent=`
    @media(max-width:900px){
      #adminShell .side{display:flex;overflow-x:auto;overflow-y:hidden;flex-wrap:nowrap;gap:4px;-webkit-overflow-scrolling:touch;scroll-snap-type:x proximity;padding:14px 12px;max-width:100%}
      #adminShell .side button{flex:0 0 auto;min-width:max-content;scroll-snap-align:start;white-space:nowrap}
      #adminShell .side::-webkit-scrollbar{height:4px}
    }
  `;
  document.head.appendChild(s);
}
addMobileAdminStyle();

/* Recuperación visual: si quedó visible el aviso de permiso por una evaluación anterior,
   volver a renderizar el área administrativa con el rol ya normalizado. */
function recoverBlockedAdminView(){
  const role=syncAdminRole();
  if(!role)return;
  const adminPage=document.getElementById('adminarea');
  if(!adminPage||!adminPage.classList.contains('active'))return;
  const text=(adminPage.textContent||'').toLowerCase();
  if(text.includes('requiere administración general')||text.includes('requiere administracion general')||text.includes('cuenta administrativa autorizada')){
    try{
      if(typeof renderAdminShell==='function')renderAdminShell();
      if(typeof adminHome==='function')adminHome();
    }catch(e){console.warn('No se pudo reconstruir la vista administrativa',e)}
  }
}
setTimeout(recoverBlockedAdminView,450);
})();
