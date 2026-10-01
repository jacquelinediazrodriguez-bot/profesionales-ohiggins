/* Corrección de navegación del botón Acceso — 01-10-2026 */
(function(){
'use strict';

/*
  El botón público "Acceso" no debe decidir por el usuario qué espacio abrir.
  Incluso si existe una sesión administrativa activa, primero abre la pantalla
  de acceso. Después de validar credenciales, la plataforma aplica los roles y
  permite pasar entre Administración y Mi Trabajo con los controles de rol.
*/
window.goAccess=function(){
  go('mesas');
  setTimeout(()=>{
    const email=document.getElementById('loginEmail');
    if(email){
      email.focus();
      email.scrollIntoView({behavior:'smooth',block:'center'});
    }
  },120);
};
})();
