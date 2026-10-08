/* Guardia de sesión real y permisos — 06-10-2026
   Evita que una identidad almacenada en el navegador conceda acceso privado
   sin una sesión Supabase autenticada vigente. */
(function(){
'use strict';

const USER_KEY='frentePT_user';
const PRIVATE_PAGES=new Set(['adminarea','mifrente','trabajo','miTrabajo','mitrabajo','workspace']);
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

function showPublicHome(){
  clearClientIdentity();
  try{
    const badge=document.querySelector('[data-professional-connected],#professionalConnected,#activeProfessionalHeader');
    if(badge)badge.remove();
  }catch(e){}
  try{if(typeof go==='function')go('inicio')}catch(e){}
}

function showLogin(){
  clearClientIdentity();
  try{
    const badge=document.querySelector('[data-professional-connected],#professionalConnected,#activeProfessionalHeader');
    if(badge)badge.remove();
  }catch(e){}
  try{
    if(typeof go==='function')go('mesas');
    setTimeout(()=>{
      const email=document.getElementById('loginEmail');
      if(email){email.focus();email.scrollIntoView({behavior:'smooth',block:'center'})}
    },120);
  }catch(e){}
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
  /* No borrar la identidad mientras Supabase recupera la sesión: podría
     interrumpir un ingreso nuevo y destruir el perfil recién validado. */
  const session=await getSupabaseSession();
  if(window.__frenteAuthVerified===true){
    window.__frenteAuthChecking=false;
    return true;
  }
  const liveUser=(()=>{try{return typeof currentUser!=='undefined'?currentUser:null}catch(e){return null}})();
  const identity=liveUser||cachedUser;
  const valid=!!(session?.user&&sameAuthenticatedUser(session.user,identity));
  window.__frenteAuthVerified=valid;
  window.__frenteAuthChecking=false;
  if(valid){
    restoreClientIdentity(identity);
    try{if(typeof updateAccessUI==='function')updateAccessUI()}catch(e){}
    return true;
  }
  /* Nunca borrar una identidad creada después de iniciar esta verificación. */
  if(!cachedUser&&liveUser)return false;
  showPublicHome();
  return false;
}

/* Bloquear navegación privada si no existe sesión verificada. */
function wrapGo(){
  const base=window.go;
  if(typeof base!=='function'||base.__sessionGuardWrapped)return;
  const guarded=function(page){
    const p=String(page||'');
    if(PRIVATE_PAGES.has(p)&&window.__frenteAuthVerified!==true){
      showLogin();
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
        showLogin();
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
          showPublicHome();
        }
      });
    }
  }catch(e){}
},500);
})();
