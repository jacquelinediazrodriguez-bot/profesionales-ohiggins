/* Acceso directo a gestión del historial de Biblioteca - 13-10-2026.
   Reutiliza retirarPublicacion() y volverAPublicar(), sin alterar documentos. */
(function(){
'use strict';
function isGeneral(){
  try { return typeof window.isAdminGeneral==='function' && window.isAdminGeneral()===true; }
  catch(e){return false;}
}
function manage(){
  if(!isGeneral())return;
  if(typeof window.go==='function')window.go('adminarea');
  if(typeof window.renderAdminShell==='function' && !document.getElementById('admincontent'))window.renderAdminShell();
  if(typeof window.adminPublicaciones!=='function')return;
  Promise.resolve(window.adminPublicaciones()).then(()=>{
    const host=document.getElementById('admincontent');
    const title=[...(host?.querySelectorAll('h2,h3')||[])].find(el=>/Historial de Biblioteca/i.test(el.textContent||''));
    if(title)title.scrollIntoView({behavior:'smooth',block:'start'});
  }).catch(error=>console.error('No se pudo abrir Historial de Biblioteca',error));
}
window.abrirGestionBibliotecaGeneral=manage;
function ensure(){
  const authorized=isGeneral();
  const page=document.getElementById('biblioteca');
  if(page){
    let btn=document.getElementById('bibGestionGeneral');
    if(authorized&&!btn){
      btn=document.createElement('button');
      btn.id='bibGestionGeneral';btn.type='button';btn.className='btn primary';
      btn.textContent='Gestionar publicaciones y archivo';
      btn.style.margin='12px 0';
      btn.onclick=manage;
      const heading=page.querySelector('h1');
      heading?.insertAdjacentElement('afterend',btn);
    }
    if(btn)btn.hidden=!authorized;
  }
  const side=document.querySelector('#adminShell .side');
  if(side){
    let b=document.getElementById('adminGestionBiblioteca');
    if(authorized&&!b){
      b=document.createElement('button');
      b.id='adminGestionBiblioteca';b.type='button';
      b.textContent='📚 Gestión de Biblioteca y archivo';
      b.onclick=manage;
      const publication=[...side.querySelectorAll('button')].find(x=>/Revisión y publicaciones/.test(x.textContent||''));
      if(publication)publication.insertAdjacentElement('afterend',b);
      else side.appendChild(b);
    }
    if(b)b.hidden=!authorized;
  }
}
let scheduled=false;
new MutationObserver(()=>{
 if(scheduled)return;scheduled=true;
 setTimeout(()=>{scheduled=false;ensure();},120);
}).observe(document.documentElement,{subtree:true,childList:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensure,{once:true});
else ensure();
})();