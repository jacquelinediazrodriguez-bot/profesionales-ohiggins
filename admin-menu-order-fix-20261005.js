/* Orden y nombres del menú de Administración General + accesos rápidos — 05-10-2026 */
(function(){
'use strict';

function isGeneral(){
  try{return typeof isAdminGeneral==='function'&&isAdminGeneral()}catch(e){return false}
}

function goMyWork(){
  if(typeof window.irAMiTrabajo==='function')return window.irAMiTrabajo();
  if(typeof go==='function')go('mifrente');
  if(typeof privateTab==='function')privateTab('panel');
}

const generalItems=[
  {label:'🏠 Inicio',fn:'adminHome'},
  {label:'🧭 Ir a mi trabajo',call:goMyWork},
  {label:'📨 Invitación integrantes',fn:'adminInvitaciones'},
  {label:'👥 Asignación mesas integrantes',fn:'adminUsuarios'},
  {label:'🧩 Mesas técnicas',fn:'adminMesas'},
  {label:'📄 Documentos de las mesas',fn:'adminDocumentosMesas'},
  {label:'📚 Solicitudes y revisión de publicaciones',fn:'adminPublicaciones'},
  {label:'✉️ Solicitudes de biblioteca',fn:'adminSolicitudes'},
  {label:'🏛️ Directorio',fn:'adminRepresentantes'},
  {label:'🖼️ Galería',fn:'abrirGestionGaleria'},
  {label:'📧 Correo institucional',fn:'adminCorreoInstitucional'},
  {label:'🗣️ Mensaje del Frente',fn:'adminPresidencia',generalOnly:true},
  {label:'🔒 Bloqueo de edición',fn:'adminBloqueos'},
  {label:'📊 Estado de la plataforma',fn:'adminEstado'},
  {label:'🛡️ Seguridad y límites',fn:'adminSeguridadLimites',generalOnly:true},
  {label:'↩ Salir',fn:'logout'}
];

function availableItems(){
  return generalItems.filter(x=>!x.generalOnly||isGeneral());
}

function runItem(item){
  if(item.call)return item.call();
  const f=window[item.fn];
  if(typeof f==='function')return f();
}

function rebuildSide(){
  const side=document.querySelector('#adminShell .side');
  if(!side)return;
  const title=side.querySelector('b')?.textContent|| (isGeneral()?'Administración General':'Administración de Plataforma');
  side.innerHTML='';
  const b=document.createElement('b');b.textContent=title;side.appendChild(b);
  availableItems().forEach(item=>{
    const btn=document.createElement('button');
    btn.type='button';
    btn.textContent=item.label;
    btn.onclick=()=>runItem(item);
    if(item.fn)btn.dataset.adminAction=item.fn;
    side.appendChild(btn);
  });
}

function buildQuickAccess(){
  const c=document.getElementById('admincontent');
  if(!c)return;
  const existingTitle=[...c.querySelectorAll('h2')].find(x=>/Pendientes y accesos rápidos/i.test(x.textContent||''));
  const grid=existingTitle?.nextElementSibling;
  if(!existingTitle||!grid)return;
  existingTitle.textContent='Accesos rápidos';
  grid.innerHTML='';
  availableItems().filter(x=>!['adminHome','logout'].includes(x.fn)&&!x.call).forEach(item=>{
    const card=document.createElement('div');
    card.className='card';card.style.cursor='pointer';card.onclick=()=>runItem(item);
    const h=document.createElement('h3');h.textContent=item.label;
    const p=document.createElement('p');
    const desc={
      adminInvitaciones:'Invitar nuevos integrantes a la plataforma.',
      adminUsuarios:'Asignar integrantes a sus Mesas Técnicas y roles.',
      adminMesas:'Crear, organizar y mantener Mesas Técnicas.',
      adminDocumentosMesas:'Revisar el avance de documentos de todas las Mesas.',
      adminPublicaciones:'Revisar solicitudes de publicación y resolver su envío a Biblioteca.',
      adminSolicitudes:'Gestionar solicitudes de documentos desde la Biblioteca.',
      adminRepresentantes:'Mantener actualizado el Directorio institucional.',
      abrirGestionGaleria:'Gestionar fotografías y publicaciones de la Galería.',
      adminCorreoInstitucional:'Gestionar el correo institucional desde la plataforma.',
      adminPresidencia:'Editar el Mensaje del Frente y su información institucional.',
      adminBloqueos:'Consultar las secciones actualmente bloqueadas en edición.',
      adminEstado:'Revisar el estado operativo de la plataforma.',
      adminSeguridadLimites:'Revisar seguridad, cuotas y límites de la plataforma.'
    };
    p.textContent=desc[item.fn]||'';
    card.append(h,p);grid.appendChild(card);
  });
}

const baseRender=window.renderAdminShell;
if(typeof baseRender==='function'){
  window.renderAdminShell=function(){
    const r=baseRender.apply(this,arguments);
    rebuildSide();
    return r;
  };
}
const baseHome=window.adminHome;
if(typeof baseHome==='function'){
  window.adminHome=function(){
    const r=baseHome.apply(this,arguments);
    rebuildSide();
    buildQuickAccess();
    return r;
  };
}

const obs=new MutationObserver(()=>{
  if(document.querySelector('#adminShell .side'))rebuildSide();
  if(document.getElementById('admincontent'))buildQuickAccess();
});
obs.observe(document.documentElement,{childList:true,subtree:true});

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{rebuildSide();buildQuickAccess()});
else{rebuildSide();buildQuickAccess()}
})();
