/* Acceso estable a Gestion de Biblioteca - 13-10-2026.
   Solo interfaz: las operaciones y permisos siguen en las funciones existentes. */
(function(){
'use strict';
function authorized(){
  try{return typeof window.isAdminGeneral==='function' && window.isAdminGeneral()===true}
  catch(e){return false}
}
async function openManagement(){
  if(!authorized()){alert('Debe ingresar como Administradora General.');return}
  if(typeof window.go==='function')window.go('adminarea');
  if(!document.getElementById('admincontent') && typeof window.renderAdminShell==='function')window.renderAdminShell();
  if(typeof window.adminPublicaciones!=='function'){
    alert('No se encontro la gestion de publicaciones. Actualice la pagina.');return;
  }
  try{
    await window.adminPublicaciones();
    const content=document.getElementById('admincontent');
    const heading=[...(content?.querySelectorAll('h1,h2,h3')||[])].find(el=>/Historial de Biblioteca/i.test(el.textContent||''));
    (heading||content)?.scrollIntoView({block:'start',behavior:'smooth'});
  }catch(e){console.error('Gestion de Biblioteca',e);alert('No se pudo consultar el archivo de Biblioteca.')}
}
window.abrirGestionBibliotecaGeneral=openManagement;
function ensure(){
  const allow=authorized(), page=document.getElementById('biblioteca');
  if(page){
    let b=document.getElementById('bibGestionGeneral');
    if(!b){
      b=document.createElement('button');
      b.id='bibGestionGeneral';b.type='button';b.className='btn primary';
      b.textContent='📚 Gestionar publicaciones y archivo';
      b.onclick=openManagement;
      b.style.cssText='display:block;margin:14px 0;padding:12px 18px;max-width:100%;white-space:normal';
      const h=page.querySelector('h1');
      (h||page.firstElementChild)?.insertAdjacentElement('afterend',b);
    }
    b.style.display=allow?'block':'none';
  }
  const side=document.querySelector('#adminShell .side');
  if(side){
    const buttons=[...side.querySelectorAll('button')];
    let b=document.getElementById('adminGestionBiblioteca')||buttons.find(x=>/Gestión de Biblioteca y archivo/i.test(x.textContent||''));
    if(!b && allow){
      b=document.createElement('button');b.id='adminGestionBiblioteca';
      b.type='button';b.textContent='📚 Gestión de Biblioteca y archivo';
      const near=buttons.find(x=>/Solicitudes y revisión de publicaciones/i.test(x.textContent||''));
      if(near)near.insertAdjacentElement('afterend',b);else side.appendChild(b);
    }
    if(b){b.onclick=openManagement;b.hidden=!allow;}
  }
}
let timer;
new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(ensure,180)})
.observe(document.documentElement,{childList:true,subtree:true});
document.addEventListener('click',()=>setTimeout(ensure,80),true);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensure,{once:true});
else ensure();
})();