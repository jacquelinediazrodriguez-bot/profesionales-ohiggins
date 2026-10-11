(function(){
function setup(){
if(document.getElementById('encuentro2026'))return;
const nav=document.querySelector('#publicNav'), main=document.querySelector('main'); if(!nav||!main)return;
const btn=document.createElement('button');btn.textContent='Encuentro Regional 2026';btn.onclick=()=>{window.go('encuentro2026');setTimeout(()=>{if(typeof window.erLoadAttendanceWhenAdmin==='function')window.erLoadAttendanceWhenAdmin()},100)};nav.insertBefore(btn,nav.children[1]||null);
const el=document.createElement('section');el.id='encuentro2026';el.className='page';
el.innerHTML=`<style>
#encuentro2026{font-size:18px;line-height:1.55}#encuentro2026 .erhero{padding:32px 20px;text-align:center;border-radius:18px;background:linear-gradient(135deg,#e2f2fc,#fff 55%,#f7e9ed);border-top:7px solid #133b67;border-bottom:4px solid #be2946}#encuentro2026 h1{font-size:clamp(29px,5vw,46px);color:#123b67;margin:8px}#encuentro2026 h2{font-size:26px;color:#123b67}#encuentro2026 .erbox{max-width:830px;margin:18px auto;padding:25px;background:white;border:1px solid #d5e1ed;border-radius:15px}#encuentro2026 label{display:block;font-weight:750;margin:14px 0 5px}#encuentro2026 input:not([type=checkbox]){width:100%;padding:15px;font-size:19px;border-radius:8px;border:1px solid #889aaa}#encuentro2026 .erbtn{padding:15px 20px;border:0;background:#123b67;color:#fff;border-radius:10px;font-weight:750;font-size:19px;cursor:pointer}#encuentro2026 .erbtn:disabled{opacity:.5}#encuentro2026 .erbanner{height:180px;background:linear-gradient(180deg,#add6f2,#dceafa);border-radius:14px;display:flex;align-items:end;justify-content:center;color:#123b67;font-weight:700;padding:16px}#encuentro2026 .ersub{color:#637388}#encuentro2026 td{padding:10px;border-bottom:1px solid #dbe4ec}#encuentro2026 table{width:100%;border-collapse:collapse}@media(max-width:600px){#encuentro2026 .erbox{padding:15px}#encuentro2026 td{font-size:16px;padding:7px}}
#encuentro2026 .er-consent-label{color:#801b3b;font-weight:800;line-height:1.5}#encuentro2026 .er-consent-label input[type=checkbox]{accent-color:#801b3b;width:22px;height:22px;vertical-align:middle;margin-right:8px}#encuentro2026 .er-consent-label:focus-within{outline:2px solid #801b3b;outline-offset:3px;border-radius:4px}
</style>
<div class="erhero"><p style="color:#ba2c42;font-weight:800">DEMOCRACIA CRISTIANA · O'HIGGINS</p><h1>Encuentro Regional 2026</h1><b>Frente de Profesionales y Técnicos</b><p>Sábado 24 de octubre · 10:00 horas<br>Calle Guangualí N.º 159, Rengo</p><p>Unidos y comprometidos con nuestra región</p></div>
<div class="erbox"><h2>Bienvenida del Presidente</h2><p>Estimadas y estimados camaradas:</p><p>Hoy nos encontramos para renovar nuestro compromiso con la Región de O'Higgins y con los principios humanistas y socialcristianos que inspiran a la Democracia Cristiana.</p><p>Nuestra región enfrenta importantes desafíos que requieren conocimiento, experiencia, diálogo y propuestas concretas. Tenemos la responsabilidad de poner nuestras capacidades profesionales al servicio de las personas, del desarrollo regional y del bien común.</p><p>Este encuentro marca el inicio de una nueva etapa de trabajo colectivo, donde la experiencia de quienes han construido nuestra historia se encuentre con las ideas y energías de las nuevas generaciones.</p><p><b>Porque nuestro compromiso no es solo reflexionar sobre el futuro, sino contribuir a construirlo.</b></p></div>
<div class="erbox"><h2>Programa del encuentro</h2><table><tbody>
<tr><td>10:00–10:05</td><td>Saludo de apertura y bienvenida</td></tr><tr><td>10:05–10:20</td><td>Palabras de nuestras autoridades</td></tr><tr><td>10:20–10:35</td><td>Estrategia regional del Frente</td></tr><tr><td>10:35–10:55</td><td>Diagnóstico regional</td></tr><tr><td>10:55–11:25</td><td>Metodología y plataforma digital</td></tr><tr><td>11:25–12:00</td><td>Constitución de mesas y acuerdos iniciales</td></tr>
</tbody></table></div>
<div class="erbox"><h2>Registrar mi asistencia</h2><p class="ersub">Complete sus datos para registrar su asistencia. La invitación por correo es opcional.</p>
<form id="erform"><label>Nombre completo<input required name="full_name" minlength="3" maxlength="120" autocomplete="name"></label><label>Correo electrónico<input required type="email" name="email" autocomplete="email"></label><label>Teléfono / WhatsApp<input name="phone" type="tel" maxlength="40"></label><label>Comuna<input name="commune" maxlength="80"></label><label class="er-consent-label"><input type="checkbox" name="consent_invitation"> También deseo recibir por correo una invitación para acceder a la plataforma (opcional).</label><button class="erbtn" type="submit">Registrar asistencia</button><p id="erresult" role="status" aria-live="polite"></p></form>
<p><button type="button" class="erbtn" id="erassisted">Registro asistido (acceso reservado)</button></p><p id="erassistedinfo" class="ersub"></p></div>
<div class="erbox" id="er-admin-attendance" hidden><h2>Registro completo de asistencia</h2><p class="ersub">Consulta reservada al administrador general. La columna «Invitación» muestra el estado del envío, no solo la autorización.</p><button type="button" class="erbtn" id="er-refresh-attendance">Actualizar registro</button><p id="er-attendance-result" role="status" aria-live="polite"></p><div style="overflow-x:auto"><table><thead><tr><th>Fecha</th><th>Nombre completo</th><th>Correo electrónico</th><th>Teléfono / WhatsApp</th><th>Comuna</th><th>Invitación</th><th>Detalle</th></tr></thead><tbody id="er-attendance-body"></tbody></table></div></div>
<div class="erbox"><h2>Conoce nuestra plataforma</h2><p>Mesas de Salud, Educación, Economía, Trabajo y Agricultura.</p><button class="erbtn" type="button" id="eraccess">Ingresar a la plataforma</button></div>`;
main.appendChild(el);
document.getElementById('erform').addEventListener('submit',async ev=>{
 ev.preventDefault();const form=ev.target,fd=new FormData(form),button=form.querySelector('button'),out=document.getElementById('erresult');
 button.disabled=true;out.textContent='Registrando asistencia...';
 try{const payload={full_name:fd.get('full_name'),email:fd.get('email'),phone:fd.get('phone'),commune:fd.get('commune'),consent_invitation:fd.get('consent_invitation')==='on',assisted:form.dataset.assisted==='true'};
 const h={'Content-Type':'application/json','apikey':window.SUPABASE_KEY||'sb_publishable_HZljMDp-yL6cEddxKWECiw_hJe-oaOQ'};
 if(payload.assisted){const s=await (typeof sbAuth!=='undefined'?sbAuth:null)?.auth.getSession();if(!s?.data?.session?.access_token)throw Error('Debe iniciar sesión con su cuenta autorizada');h.Authorization='Bearer '+s.data.session.access_token;}
 const r=await fetch('https://ozfcvaiatkmbehaokskz.supabase.co/functions/v1/encuentro-2026-registro',{method:'POST',headers:h,body:JSON.stringify(payload)}); const j=await r.json(); if(!r.ok)throw Error(j.error||'No fue posible registrar');out.textContent=j.message;form.reset();}catch(e){out.textContent=String(e.message||e)}finally{button.disabled=false}
});
document.getElementById('erassisted').onclick=async()=>{const s=await (typeof sbAuth!=='undefined'?sbAuth:null)?.auth.getSession(); const p=document.getElementById('erassistedinfo');if(!s?.data?.session){p.textContent='Ingrese primero con sus credenciales habituales de administración.';window.goAccess?.();return;}document.getElementById('erform').dataset.assisted='true';p.textContent='Modo asistido: cada registro será validado con su sesión de administración.';document.getElementById('erform').scrollIntoView({behavior:'smooth'});};
document.getElementById('eraccess').onclick=()=>window.goAccess?.();

const attendancePanel=document.getElementById('er-admin-attendance');
const attendanceBody=document.getElementById('er-attendance-body');
const attendanceResult=document.getElementById('er-attendance-result');
const refreshAttendance=document.getElementById('er-refresh-attendance');
const attendanceSession=async()=>{try{return (typeof sbAuth!=='undefined'?sbAuth:null)?.auth.getSession()}catch(e){return null}};
const attendanceCell=(tr,value)=>{const td=document.createElement('td');td.textContent=String(value??'—');tr.appendChild(td)};
const attendanceLabel=(r)=>r.invite_status==='sent'?'Enviada':'No enviada';
const attendanceDetail=(r)=>r.invite_status==='sent'?'Envío registrado':r.invite_status==='not_requested'?'No solicitada':r.invite_status==='existing_account'?'Cuenta existente':r.invite_status==='send_failed'?'Envío fallido':'Pendiente';
async function loadAttendance(){
 refreshAttendance.disabled=true;attendanceResult.textContent='Consultando registro...';
 try{
  const session=await attendanceSession(),token=session?.data?.session?.access_token;
  if(!token)throw Error('Para consultar la asistencia, primero ingrese a la plataforma con su cuenta de administrador general y vuelva a esta sección.');
  const response=await fetch('https://ozfcvaiatkmbehaokskz.supabase.co/functions/v1/encuentro-2026-registro',{method:'POST',headers:{'Content-Type':'application/json','apikey':window.SUPABASE_KEY||'sb_publishable_HZljMDp-yL6cEddxKWECiw_hJe-oaOQ','Authorization':'Bearer '+token},body:JSON.stringify({action:'list_attendance'})});
  const result=await response.json();if(!response.ok)throw Error(result.error||'No fue posible consultar el registro');
  attendancePanel.hidden=false;attendanceBody.replaceChildren();
  for(const r of result.records||[]){const tr=document.createElement('tr');attendanceCell(tr,r.created_at?new Date(r.created_at).toLocaleString('es-CL'):'—');attendanceCell(tr,r.full_name);attendanceCell(tr,r.email);attendanceCell(tr,r.phone);attendanceCell(tr,r.commune);attendanceCell(tr,attendanceLabel(r));attendanceCell(tr,attendanceDetail(r));attendanceBody.appendChild(tr)}
  attendanceResult.textContent='Total de asistencias: '+(result.records||[]).length;
 }catch(e){attendancePanel.hidden=false;attendanceResult.textContent=String(e.message||e)}
 finally{refreshAttendance.disabled=false}
}
refreshAttendance.addEventListener('click',loadAttendance);
window.erLoadAttendanceWhenAdmin=async()=>{
 const s=await attendanceSession();
 if(!s?.data?.session?.access_token){attendancePanel.hidden=true;return}
 attendancePanel.hidden=false;
 await loadAttendance();
};
const adminAttendanceBtn=document.createElement('button');adminAttendanceBtn.className='erbtn';adminAttendanceBtn.type='button';adminAttendanceBtn.textContent='Consultar registro de asistencia (administrador general)';adminAttendanceBtn.style.marginTop='14px';
adminAttendanceBtn.addEventListener('click',async()=>{attendancePanel.hidden=false;attendanceResult.textContent='Consultando asistencia registrada...';await loadAttendance();attendancePanel.scrollIntoView({behavior:'smooth',block:'start'})});
document.getElementById('erassistedinfo').after(adminAttendanceBtn);
if(location.hash==='#encuentro2026'){window.go('encuentro2026');window.erLoadAttendanceWhenAdmin();}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
})();