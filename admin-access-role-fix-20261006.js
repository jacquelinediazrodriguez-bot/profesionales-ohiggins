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

function clean(v){return String(v||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')}
function canonicalRole(user){
  if(!user)return '';
  const candidates=[user.systemRole,user.rol,user.role,user.accountRole,user.globalRole];
  for(const value of candidates){const key=clean(value);if(ROLE_MAP[key])return ROLE_MAP[key]}
  return '';
}
function syncAdminRole(){
  try{
    if(typeof currentUser==='undefined'||!currentUser)return '';
    const role=canonicalRole(currentUser);if(!role)return '';
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
  if(!r){if(typeof go==='function')go('mesas');return false}
  if(generalOnly&&r!=='administrador_general'){
    alert('Esta función está reservada al Administrador General.');
    if(typeof adminHome==='function')adminHome();
    return false;
  }
  return true;
};

let ensuring=null;
function getSb(){
  try{return (typeof sbAuth!=='undefined'&&sbAuth)?sbAuth:null}catch(e){return null}
}
async function ensureRealSession(){
  syncAdminRole();
  const sb=getSb();
  if(!currentUser?.supabaseId||!sb)return false;
  if(ensuring)return ensuring;
  ensuring=(async()=>{
    try{
      if(typeof window.initSharedWorkspace==='function')return (await window.initSharedWorkspace())!==false;
      return true;
    }catch(e){console.warn('No se pudo inicializar la sesión compartida',e);return false}
    finally{ensuring=null}
  })();
  return ensuring;
}

function wrapAdminAction(name){
  const base=window[name];
  if(typeof base!=='function'||base.__adminReadyWrapped)return;
  const wrapped=async function(){
    syncAdminRole();
    const ok=await ensureRealSession();
    syncAdminRole();
    if(!ok&&typeof isAnyAdmin==='function'&&isAnyAdmin()){
      console.warn('Administración reconocida, pero la sincronización compartida aún no está lista.');
    }
    return base.apply(this,arguments);
  };
  wrapped.__adminReadyWrapped=true;
  window[name]=wrapped;
}

const ADMIN_ACTIONS=[
 'adminPublicaciones','adminSolicitudes','adminUsuarios','adminMesas','adminDocumentosMesas',
 'adminRepresentantes','abrirGestionGaleria','adminCorreoInstitucional','adminPresidencia',
 'adminBloqueos','adminEstado','adminSeguridadLimites','adminInvitaciones'
];
function refreshWrappers(){ADMIN_ACTIONS.forEach(wrapAdminAction)}
refreshWrappers();

function addMobileAdminStyle(){
  if(document.getElementById('adminAccessRoleFixStyle'))return;
  const s=document.createElement('style');s.id='adminAccessRoleFixStyle';
  s.textContent=`@media(max-width:900px){#adminShell .side{display:flex;overflow-x:auto;overflow-y:hidden;flex-wrap:nowrap;gap:4px;-webkit-overflow-scrolling:touch;scroll-snap-type:x proximity;padding:14px 12px;max-width:100%}#adminShell .side button{flex:0 0 auto;min-width:max-content;scroll-snap-align:start;white-space:nowrap}#adminShell .side::-webkit-scrollbar{height:4px}}`;
  document.head.appendChild(s);
}
addMobileAdminStyle();

async function openAdminArea(){
  const role=syncAdminRole();
  if(!role)return false;
  await ensureRealSession();
  syncAdminRole();
  refreshWrappers();
  try{
    if(typeof go==='function')go('adminarea');
    if(typeof renderAdminShell==='function')renderAdminShell();
    if(typeof adminHome==='function')adminHome();
    return true;
  }catch(e){console.warn('No se pudo abrir Administración',e);return false}
}

function restoreAdminView(){
  const role=syncAdminRole();
  if(!role)return;
  const active=document.querySelector('.page.active');
  if(!active||active.id==='inicio')openAdminArea();
}

async function recoverBlockedAdminView(){
  const role=syncAdminRole();if(!role)return;
  const adminContent=document.getElementById('admincontent');
  const shell=document.getElementById('adminShell');
  const text=((adminContent?.textContent||'')+' '+(shell?.textContent||'')).toLowerCase();
  const blocked=text.includes('requiere administración general')||text.includes('requiere administracion general')||text.includes('cuenta administrativa autorizada');
  if(blocked)await openAdminArea();
}

syncAdminRole();
setTimeout(()=>{syncAdminRole();refreshWrappers();restoreAdminView()},180);
setTimeout(()=>{syncAdminRole();refreshWrappers();restoreAdminView();recoverBlockedAdminView()},700);
document.addEventListener('click',()=>{syncAdminRole();refreshWrappers()},true);

let observerTimer=null;
const observer=new MutationObserver((mutations)=>{
  let shouldCheck=false;
  for(const m of mutations){
    for(const n of (m.addedNodes||[])){
      const t=String(n && n.textContent || '').toLowerCase();
      if(t.includes('requiere administración general')||t.includes('requiere administracion general')||t.includes('cuenta administrativa autorizada')){
        shouldCheck=true; break;
      }
    }
    if(shouldCheck)break;
  }
  if(!shouldCheck)return;
  clearTimeout(observerTimer);
  observerTimer=setTimeout(()=>recoverBlockedAdminView(),180);
});
const observedAdmin=document.getElementById('adminShell');
if(observedAdmin)observer.observe(observedAdmin,{childList:true,subtree:true});
})();