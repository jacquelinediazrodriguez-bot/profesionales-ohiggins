/* Solicitudes de incorporación: consulta y Excel para Administración General */
(function(){
"use strict";
function authorized(){return window.__frenteAuthVerified===true&&typeof window.isAdminGeneral==="function"&&window.isAdminGeneral()}
function el(t,text){const e=document.createElement(t);if(text!==undefined)e.textContent=text;return e}
const date=x=>x?new Date(x).toLocaleString("es-CL"):"";
async function excelLibrary(){
 if(window.XLSX?.utils?.aoa_to_sheet&&window.XLSX?.write)return window.XLSX;
 await new Promise((resolve,reject)=>{const s=document.createElement("script");s.src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";s.onload=resolve;s.onerror=()=>reject(Error("No se pudo cargar la biblioteca Excel"));document.head.appendChild(s)});
 if(!window.XLSX?.utils?.aoa_to_sheet)throw Error("Excel no disponible");
 return window.XLSX;
}
window.adminSolicitudesIncorporacion=async function(){
 if(!authorized()){alert("Acceso reservado a Administración General.");return}
 if(typeof window.go==="function")window.go("adminarea");
 if(!document.getElementById("admincontent")&&typeof window.renderAdminShell==="function")window.renderAdminShell();
 const c=document.getElementById("admincontent");if(!c)return;
 c.replaceChildren();
 c.append(el("h2","Solicitudes de incorporación · Encuentro 2026"),el("p","Consulta de solicitudes enviadas desde el formulario de participación a distancia. Las invitaciones, claves y roles siguen administrándose en sus secciones habituales."));
 const bar=el("div");bar.style.cssText="display:flex;flex-wrap:wrap;gap:10px;margin:15px 0";
 const update=el("button","Actualizar registros");update.className="btn";
 const exportBtn=el("button","Descargar Excel");exportBtn.className="btn";exportBtn.disabled=true;
 bar.append(update,exportBtn);c.append(bar);
 const status=el("p");status.setAttribute("role","status");c.append(status);
 const scroll=el("div");scroll.style.cssText="overflow-x:auto;max-width:100%;-webkit-overflow-scrolling:touch";
 const table=el("table");table.style.cssText="border-collapse:collapse;min-width:1250px;width:100%;font-size:14px";
 const thead=el("thead"),heading=el("tr"),tbody=el("tbody");
 const labels=["Fecha de solicitud","Nombre completo","Correo electrónico","Teléfono / WhatsApp","Comuna","Mesa de interés","Comentario","Autorización contacto","Estado de solicitud","Origen"];
 for(const label of labels){const th=el("th",label);th.style.cssText="padding:10px;text-align:left;border-bottom:2px solid #aab6c6;white-space:nowrap";heading.append(th)}
 thead.append(heading);table.append(thead,tbody);scroll.append(table);c.append(scroll);
 let rows=[];
 const values=a=>[date(a.created_at),a.full_name,a.email,a.phone,a.commune,a.mesa,a.notes,a.consent_contact?"Sí":"No",a.status,a.source].map(x=>String(x??""));
 function render(){
  tbody.replaceChildren();
  for(const a of rows){
   const tr=el("tr");
   for(const v of values(a)){const td=el("td",v||"—");td.style.cssText="padding:9px;border-bottom:1px solid #dae0e8;vertical-align:top;max-width:290px;overflow-wrap:anywhere";tr.append(td)}
   tbody.append(tr);
  }
  status.textContent=rows.length?"Total de solicitudes: "+rows.length:"No hay solicitudes registradas.";
 }
 async function load(){
  update.disabled=true;exportBtn.disabled=true;status.textContent="Consultando solicitudes...";
  try{
   if(!authorized())throw Error("Sesión administrativa no autorizada");
   const {data,error}=await sbAuth.functions.invoke("encuentro-2026-solicitudes-admin",{body:{action:"list"}});
   if(error)throw error;
   if(!data?.ok)throw Error(data?.error||"No se pudieron obtener los registros");
   if(!authorized())throw Error("La sesión dejó de estar autorizada");
   rows=Array.isArray(data.records)?data.records:[];render();exportBtn.disabled=false;
  }catch(e){rows=[];tbody.replaceChildren();status.textContent="No se pudieron cargar los registros: "+String(e.message||e)}
  finally{update.disabled=false}
 }
 update.onclick=load;
 exportBtn.onclick=async()=>{
  if(!authorized())return;
  exportBtn.disabled=true;status.textContent="Generando archivo Excel...";
  try{
   const X=await excelLibrary();
   if(!authorized())throw Error("Sesión no autorizada");
   const ws=X.utils.aoa_to_sheet([labels,...rows.map(values)]);
   ws["!cols"]=[{wch:24},{wch:33},{wch:36},{wch:22},{wch:22},{wch:22},{wch:55},{wch:20},{wch:22},{wch:18}];
   if(rows.length)ws["!autofilter"]={ref:"A1:J"+(rows.length+1)};
   const wb=X.utils.book_new();X.utils.book_append_sheet(wb,ws,"Solicitudes incorporación");
   const bytes=X.write(wb,{bookType:"xlsx",type:"array",compression:true});
   const url=URL.createObjectURL(new Blob([bytes],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}));
   const a=el("a");a.href=url;a.download="solicitudes-incorporacion-2026-"+new Date().toISOString().slice(0,10)+".xlsx";
   document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
   status.textContent="Archivo Excel generado · "+rows.length+" solicitudes.";
  }catch(e){status.textContent="Error al exportar Excel: "+String(e.message||e)}
  finally{exportBtn.disabled=false}
 };
 await load();
};
function addLink(){
 if(!authorized())return;
 const side=document.querySelector("#adminShell .side");
 if(side&&!side.querySelector("[data-incorporacion-link]")){
  const b=el("button","📋 Solicitudes Encuentro Regional");b.type="button";b.dataset.incorporacionLink="1";
  b.onclick=()=>window.adminSolicitudesIncorporacion();
  const near=[...side.querySelectorAll("button")].find(x=>/Asistencia Encuentro 2026/.test(x.textContent||""));
  if(near)near.insertAdjacentElement("afterend",b);else side.append(b);
 }
}
const orig=window.renderAdminShell;
if(typeof orig==="function")window.renderAdminShell=function(){const r=orig.apply(this,arguments);addLink();return r};
const home=window.adminHome;
if(typeof home==="function")window.adminHome=function(){const r=home.apply(this,arguments);addLink();return r};
document.addEventListener("click",()=>setTimeout(addLink,100),true);
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",addLink);else addLink();
})();