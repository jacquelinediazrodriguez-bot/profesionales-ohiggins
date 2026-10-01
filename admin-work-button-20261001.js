/* Botón fijo Administración -> Mi Trabajo — 01-10-2026 */
(function(){
'use strict';
function ensureAdminWorkButton(){
  const side=document.querySelector('#adminShell .side');
  if(!side||side.querySelector('[data-admin-my-work-fixed]'))return;
  const b=document.createElement('button');
  b.type='button';
  b.dataset.adminMyWorkFixed='1';
  b.innerHTML='🧭 Mi Trabajo';
  b.style.fontWeight='800';
  b.onclick=async function(){
    if(typeof window.irAMiTrabajo==='function'){
      await window.irAMiTrabajo();
      return;
    }
    if(typeof go==='function')go('mifrente');
    if(typeof privateTab==='function')privateTab('panel');
  };
  const buttons=[...side.querySelectorAll('button')];
  const home=buttons.find(x=>x.textContent.includes('Inicio'));
  if(home&&home.nextSibling)side.insertBefore(b,home.nextSibling);
  else if(home)side.appendChild(b);
  else side.prepend(b);
}
const observer=new MutationObserver(ensureAdminWorkButton);
observer.observe(document.documentElement,{childList:true,subtree:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensureAdminWorkButton);
else ensureAdminWorkButton();
window.ensureAdminWorkButton=ensureAdminWorkButton;
})();
