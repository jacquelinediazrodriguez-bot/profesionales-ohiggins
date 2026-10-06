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
  const candidates=[rawSystem,user.rol,user.role,user.accountRole,user.globalRole];
  for(const value of candidates){
    const key=clean(value);
    if(ROLE_MAP[key])return ROLE_MAP[key];
  }
  return '';
}

function syncAdminRole(){
  try{
    if(typeof currentUser==='undefined'||!currentUser)return '';
    const role=canonicalRole(currentUser);
    if(!role)return '';
    currentUser.systemRole=role;
    currentUser.rol=role==='administrador_general'?'Administrador General':'Administrador de Plataforma';
    currentUser.role=role;
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

function wrapWithRoleSync(name){
  const base=window[name];
  if(typeof base!=='function'||base.__roleSyncWrapped)return;
  const wrapped=function(){
    syncAdminRole();
    return base.apply(this,arguments);
  };
  wrapped.__roleSyncWrapped=true;
  window[name]=wrapped;
}

/* Normalizar antes de toda navegación y de cada área administrativa que también
   posee validaciones propias en sync.js. */
[
  'go','renderAdminShell','adminHome','adminPublicaciones','adminSolicitudes',
  'adminUsuarios','adminMesas','adminDocumentosMesas','adminRepresentantes',
  'abrirGestionGaleria','adminCorreoInstitucional','adminPresidencia',
  'adminBloqueos','adminEstado','adminSeguridadLimites','adminInvitaciones'
].forEach(wrapWithRoleSync);

/* Si otros scripts redefinen funciones después, volver a envolverlas. */
function refreshWrappers(){
  [
    'go','renderAdminShell','adminHome','adminPublicaciones','adminSolicitudes',
    'adminUsuarios','adminMesas','adminDocumentosMesas','adminRepresentantes',
    'abrirGestionGaleria','adminCorreoInstitucional','adminPresidencia',
    'adminBloqueos','adminEstado','adminSeguridadLimites','adminInvitaciones'
  ].forEach(wrapWithRoleSync);
}

syncAdminRole();
setTimeout(()=>{syncAdminRole();refreshWrappers()},80);
setTimeout(()=>{syncAdminRole();refreshWrappers()},350);
document.addEventListener('click',()=>{syncAdminRole();refreshWrappers()},true);

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

/* Recuperación visual fuerte: si una validación antigua dejó visible el aviso,
   reconstruir Administración y volver a Inicio con el rol ya normalizado. */
function recoverBlockedAdminView(){
  const role=syncAdminRole();
  if(!role)return;
  const adminPage=document.getElementById('adminarea');
  const adminContent=document.getElementById('admincontent');
  const shell=document.getElementById('adminShell');
  const text=((adminPage?.textContent||'')+' '+(adminContent?.textContent||'')+' '+(shell?.textContent||'')).toLowerCase();
  const blocked=text.includes('requiere administración general')||text.includes('requiere administracion general')||text.includes('cuenta administrativa autorizada');
  if(!blocked)return;
  try{
    refreshWrappers();
    if(typeof renderAdminShell==='function')renderAdminShell();
    if(typeof adminHome==='function')adminHome();
  }catch(e){console.warn('No se pudo reconstruir la vista administrativa',e)}
}

setTimeout(recoverBlockedAdminView,450);
setTimeout(recoverBlockedAdminView,1200);

const observer=new MutationObserver(()=>{
  if(observer.__busy)return;
  observer.__busy=true;
  try{recoverBlockedAdminView()}finally{setTimeout(()=>{observer.__busy=false},60)}
});
observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
})();
