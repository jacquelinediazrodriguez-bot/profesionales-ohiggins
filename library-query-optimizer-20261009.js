/* Biblioteca: agrupa solicitudes simultáneas y reduce refrescos repetidos de lectura pública.
   Las operaciones de administración mantienen consulta fresca; ninguna escritura es interceptada. */
(function(){
  'use strict';
  let pending=null;
  let lastPublicAt=0;
  let cachedSession=null;
  function optimize(){
    if(typeof window.loadPublicLibrary!=='function'||window.loadPublicLibrary.__optimized)return;
    const original=window.loadPublicLibrary;
    const wrapped=function(...args){
      const signedIn=typeof currentUser!=='undefined'&&!!currentUser;
      const sessionKey=signedIn?'signed':'public';
      if(pending)return pending;
      if(!signedIn&&cachedSession===sessionKey&&Date.now()-lastPublicAt<12000){
        if(document.getElementById('biblioteca')?.classList.contains('active')&&typeof window.renderBiblioteca==='function')window.renderBiblioteca();
        return Promise.resolve();
      }
      pending=Promise.resolve().then(()=>original.apply(this,args));
      return pending.then(result=>{
        if(!signedIn){cachedSession=sessionKey;lastPublicAt=Date.now();}
        return result;
      }).finally(()=>{pending=null;});
    };
    wrapped.__optimized=true;
    window.loadPublicLibrary=wrapped;
  }
  optimize();
  window.addEventListener('online',()=>{lastPublicAt=0;});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)lastPublicAt=0;});
})();
