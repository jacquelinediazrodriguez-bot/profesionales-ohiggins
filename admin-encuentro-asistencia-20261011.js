/* Consulta de asistencia 2026 desde Administración General exclusivamente. */
(function(){
'use strict';
window.adminEncuentroAsistencia=async function(){
 const c=document.getElementById('admincontent');
 if(!c)return;
 if(window.__frenteAuthVerified!==true || typeof window.isAdminGeneral!=='function' || !window.isAdminGeneral()){
   c.textContent='Acceso reservado al administrador general. Inicie sesión con su cuenta autorizada.';return;
 }
 c.innerHTML='';
 const title=document.createElement('h2');title.textContent='Lista de asistencia · Encuentro Regional 2026';
 const desc=document.createElement('p');desc.textContent='Registro de asistentes e invitaciones enviadas o no enviadas.';
 const button=document.createElement('button');button.type='button';button.textContent='Actualizar lista';button.className='btn';
 const exportButton=document.createElement('button');exportButton.type='button';exportButton.textContent='Descargar planilla Excel';exportButton.className='btn';exportButton.disabled=true;
 exportButton.style.marginLeft='10px';
 const status=document.createElement('p');status.setAttribute('role','status');
 let latestRecords=[];
 const excelCell=value=>{
   const raw=String(value??'').replace(/\r\n?/g,' ').replace(/\n/g,' ');
   const safe=/^[\s]*[=+@-]/.test(raw)?"'"+raw:raw;
   return '"'+safe.replace(/"/g,'""')+'"';
 };
 exportButton.onclick=()=>{
   if(window.__frenteAuthVerified!==true || !window.isAdminGeneral?.())return;
   const headers=['Fecha','Nombre completo','Correo','Teléfono / WhatsApp','Comuna','Invitación','Detalle'];
   const rows=latestRecords.map(a=>{
     const detail=a.invite_status==='sent'?'Envío registrado':a.invite_status==='not_requested'?'No solicitada':a.invite_status==='existing_account'?'Cuenta existente':a.invite_status==='send_failed'?'Envío fallido':'Pendiente';
     return [a.created_at?new Date(a.created_at).toLocaleString('es-CL'):'',a.full_name,a.email,a.phone,a.commune,a.invite_status==='sent'?'Enviada':'No enviada',detail];
   });
   const csv='\uFEFFsep=;\r\n'+[headers,...rows].map(row=>row.map(excelCell).join(';')).join('\r\n');
   const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));
   const a=document.createElement('a');a.href=url;a.download='asistencia-encuentro-regional-2026-'+new Date().toISOString().slice(0,10)+'.csv';
   document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);
 };
 const viewport=document.createElement('div');viewport.style.cssText='width:100%;max-width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch';
 const table=document.createElement('table');table.style.cssText='border-collapse:collapse;min-width:880px;width:100%';
 const thead=document.createElement('thead');const head=document.createElement('tr');
 for(const name of ['Fecha','Nombre completo','Correo','Teléfono / WhatsApp','Comuna','Invitación','Detalle']){const th=document.createElement('th');th.textContent=name;th.style.cssText='padding:10px;text-align:left;border-bottom:1px solid #ccc';head.appendChild(th)}
 thead.appendChild(head);const tbody=document.createElement('tbody');table.append(thead,tbody);viewport.append(table);
 c.append(title,desc,button,exportButton,status,viewport);
 const refresh=async()=>{
  button.disabled=true;exportButton.disabled=true;status.textContent='Consultando asistencias...';
  try{
   if(window.__frenteAuthVerified!==true||!window.isAdminGeneral?.())throw Error('La sesión del administrador general no está verificada.');
   const session=await (typeof sbAuth!=='undefined'?sbAuth:null)?.auth.getSession();
   const token=session?.data?.session?.access_token;
   if(!token)throw Error('Debe iniciar sesión nuevamente.');
   const r=await fetch('https://ozfcvaiatkmbehaokskz.supabase.co/functions/v1/encuentro-2026-registro',{method:'POST',headers:{'Content-Type':'application/json',apikey:window.SUPABASE_KEY||'sb_publishable_HZljMDp-yL6cEddxKWECiw_hJe-oaOQ',Authorization:'Bearer '+token},body:JSON.stringify({action:'list_attendance'})});
   const data=await r.json();if(!r.ok)throw Error(data.error||'No fue posible consultar las asistencias');
   latestRecords=Array.isArray(data.records)?data.records:[];
   tbody.replaceChildren();
   for(const a of data.records||[]){
    const tr=document.createElement('tr');
    const detail=a.invite_status==='sent'?'Envío registrado':a.invite_status==='not_requested'?'No solicitada':a.invite_status==='existing_account'?'Cuenta existente':a.invite_status==='send_failed'?'Envío fallido':'Pendiente';
    for(const v of [a.created_at?new Date(a.created_at).toLocaleString('es-CL'):'—',a.full_name,a.email,a.phone,a.commune,a.invite_status==='sent'?'Enviada':'No enviada',detail]){
     const td=document.createElement('td');td.textContent=String(v??'—');td.style.cssText='padding:10px;border-bottom:1px solid #ddd;white-space:nowrap';tr.appendChild(td);
    }tbody.appendChild(tr);
   }
   status.textContent='Total de asistencias: '+latestRecords.length;
   exportButton.disabled=false;
  }catch(e){latestRecords=[];exportButton.disabled=true;status.textContent='No se pudo cargar la lista: '+String(e.message||e)}
  finally{button.disabled=false}
 };
 button.onclick=refresh;await refresh();
};
})();