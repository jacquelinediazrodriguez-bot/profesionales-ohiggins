/* Guardia de sesión real y permisos — 06-10-2026
   Evita que una identidad almacenada en el navegador conceda acceso privado
   sin una sesión Supabase autenticada vigente. */
(function(){
'use strict';

const USER_KEY='frentePT_user';
const PRIVATE_PAGES=new Set(['adminarea','trabajo','miTrabajo','mitrabajo','workspace']);
const PRIVATE_ACTIONS=[
  'adminHome','renderAdminShell','adminPublicaciones','adminSolicitudes','adminUsuarios','adminMesas',
  'adminDocumentosMesas','adminRepresentantes','abrirGestionGaleria','adminCorreoInstitucional',
  'adminPresidencia','adminBloqueos','adminEstado','adminSeguridadLimites','adminInvitaciones'
];

let cachedUser=null;
try{
  if(typeof currentUser!=='undefined'&&currentUser) cachedUser=JSON.parse(JSON.stringify(currentUser));
}catch(e){}
if(!cachedUser){
  try{cachedUser=JSON.parse(sessionStorage.getItem(USER_KEY)||'null')}catch(e){}
}

window.__frenteAuthVerified=false;
window.__frenteAuthChecking=true;

function clearClientIdentity(){
  try{sessionStorage.removeItem(USER_KEY)}catch(e){}
  try{if(typeof currentUser!=='undefined') currentUser=null}catch(e){}
}

function restoreClientIdentity(user){
  if(!user)return;
  try{if(typeof currentUser!=='undefined') currentUser=user}catch(e){}
  try{sessionStorage.setItem(USER_KEY,JSON.stringify(user))}catch(e){}
}

function sameAuthenticatedUser(sessionUser,appUser){
  if(!sessionUser||!appUser)return false;
  const sid=String(sessionUser.id||'').trim();
  const aid=String(appUser.supabaseId||appUser.id||'').trim();
  if(sid&&aid&&sid===aid)return true;
  const se=String(sessionUser.email||'').trim().toLowerCase();
  const ae=String(appUser.email||appUser.correo||'').trim().toLowerCase();
  return !!(se&&ae&&se===ae);
}

function forcePublicAccess(){
  clearClientIdentity();
  try{
    const badge=document.querySelector('[data-professional-connected],#professionalConnected,#activeProfessionalHeader');
    if(badge)badge.remove();
  }catch(e){}
  try{if(typeof go==='function')go('mesas')}catch(e){
    try{if(typeof go==='function')go('inicio')}catch(_){}
  }
}

async function getSupabaseSession(){
  for(let i=0;i<30;i++){
    try{
      if(typeof sbAuth!=='undefined'&&sbAuth&&sbAuth.auth&&typeof sbAuth.auth.getSession==='function'){
        const out=await sbAuth.auth.getSession();
        return out?.data?.session||null;
      }
    }catch(e){console.warn('No se pudo verificar la sesión Supabase',e);return null}
    await new Promise(r=>setTimeout(r,100));
  }
  return null;
}

async function verifySession(){
  /* No confiar en el usuario cacheado mientras se valida la sesión real. */
  clearClientIdentity();
  const session=await getSupabaseSession();
  const valid=!!(session?.user&&sameAuthenticatedUser(session.user,cachedUser));
  window.__frenteAuthVerified=valid;
  window.__frenteAuthChecking=false;
  if(valid){
    restoreClientIdentity(cachedUser);
    try{if(typeof updateAccessUI==='function')updateAccessUI()}catch(e){}
    return true;
  }
  forcePublicAccess();
  return false;
}

/* Bloquear navegación privada si no existe sesión verificada. */
function wrapGo(){
  const base=window.go;
  if(typeof base!=='function'||base.__sessionGuardWrapped)return;
  const guarded=function(page){
    const p=String(page||'');
    if(PRIVATE_PAGES.has(p)&&window.__frenteAuthVerified!==true){
      forcePublicAccess();
      return false;
    }
    return base.apply(this,arguments);
  };
  guarded.__sessionGuardWrapped=true;
  window.go=guarded;
}

function wrapPrivateActions(){
  PRIVATE_ACTIONS.forEach(name=>{
    const base=window[name];
    if(typeof base!=='function'||base.__sessionGuardWrapped)return;
    const guarded=function(){
      if(window.__frenteAuthVerified!==true){
        forcePublicAccess();
        return false;
      }
      return base.apply(this,arguments);
    };
    guarded.__sessionGuardWrapped=true;
    window[name]=guarded;
  });
}

wrapGo();
wrapPrivateActions();
setInterval(()=>{wrapGo();wrapPrivateActions()},1000);
verifySession();

/* Si Supabase informa cierre de sesión, retirar permisos inmediatamente. */
setTimeout(()=>{
  try{
    if(typeof sbAuth!=='undefined'&&sbAuth?.auth?.onAuthStateChange){
      sbAuth.auth.onAuthStateChange((event,session)=>{
        if(event==='SIGNED_OUT'||!session){
          window.__frenteAuthVerified=false;
          window.__frenteAuthChecking=false;
          forcePublicAccess();
        }
      });
    }
  }catch(e){}
},500);
})();
