(function(){
function setup(){
if(document.getElementById('encuentro2026'))return;
const nav=document.querySelector('#publicNav'), main=document.querySelector('main'); if(!nav||!main)return;
const btn=document.createElement('button');btn.textContent='Encuentro Regional 2026';btn.onclick=()=>window.go('encuentro2026');nav.insertBefore(btn,nav.children[1]||null);
const el=document.createElement('section');el.id='encuentro2026';el.className='page';
el.innerHTML=`<style>
#encuentro2026{font-size:18px;line-height:1.55}#encuentro2026 .erhero{max-width:980px;margin:16px auto 24px;overflow:hidden;text-align:center;border-radius:18px;background:#fff;box-shadow:0 8px 28px rgba(15,36,75,.10);border:1px solid #e2e7ee}
#encuentro2026 .erhero-photo{height:clamp(170px,28vw,290px);background:#d9e5e4 url('https://upload.wikimedia.org/wikipedia/commons/7/75/Vi%C3%B1aSantaCruz.jpg') center 55%/cover no-repeat}
#encuentro2026 .erhero-wave{height:23px;background:linear-gradient(173deg,transparent 0 24%,#163c70 26% 47%,#fff 49% 55%,#a52245 57% 77%,#fff 79%)}
#encuentro2026 .erhero-content{padding:18px 20px 24px;color:#152c52}
#encuentro2026 .erhero-kicker{color:#9e2142;font-size:clamp(13px,2.8vw,18px);font-weight:800;letter-spacing:.07em;margin:2px 0 10px}
#encuentro2026 .erhero h1{font-size:clamp(32px,6vw,55px);line-height:1.08;color:#102f60;margin:4px auto 0;font-weight:850;letter-spacing:-.035em}
#encuentro2026 .erhero-year{font-size:clamp(39px,8vw,70px);line-height:1.1;color:#a52245;font-weight:850;margin-bottom:6px}
#encuentro2026 .erhero-sub{font-size:clamp(17px,3.3vw,25px);color:#102f60;font-weight:800}
#encuentro2026 .erhero-details{margin:24px auto 20px;max-width:600px;font-size:clamp(16px,2.8vw,21px);line-height:1.55}
#encuentro2026 .erhero-details p{margin:5px 0}
#encuentro2026 .erhero-details span{color:#a52245;margin-right:8px}
#encuentro2026 .erhero-slogan{border-top:2px solid #e0e6ef;margin:16px auto 4px;padding-top:18px;max-width:580px;font-family:'Brush Script MT','Segoe Script','Apple Chancery',cursive;font-style:italic;font-size:clamp(26px,5vw,42px);line-height:1.35;font-weight:500;color:#14396c}
#encuentro2026 .erhero-slogan em{display:block;color:#a52245;font-weight:500}
#encuentro2026 .erhero-footer{height:13px;background:linear-gradient(174deg,#a52245 0 34%,#fff 35% 46%,#153d71 47% 100%)}
#encuentro2026 .erhero-credit{font-size:11px;color:#617087;text-align:right;margin:0 16px 8px}
#encuentro2026 .erhero-credit a{color:inherit}
@media(max-width:600px){#encuentro2026 .erhero{margin:10px auto 20px;border-radius:15px}#encuentro2026 .erhero-content{padding:15px 12px 18px}#encuentro2026 .erhero-photo{height:190px}#encuentro2026 .erhero-slogan{font-size:clamp(25px,7vw,36px)}}#encuentro2026 h1{font-size:clamp(29px,5vw,46px);color:#123b67;margin:8px}#encuentro2026 h2{font-size:26px;color:#123b67}#encuentro2026 .erbox{max-width:830px;margin:18px auto;padding:25px;background:white;border:1px solid #d5e1ed;border-radius:15px}#encuentro2026 label{display:block;font-weight:750;margin:14px 0 5px}#encuentro2026 input:not([type=checkbox]){width:100%;padding:15px;font-size:19px;border-radius:8px;border:1px solid #889aaa}#encuentro2026 .erbtn{padding:15px 20px;border:0;background:#123b67;color:#fff;border-radius:10px;font-weight:750;font-size:19px;cursor:pointer}#encuentro2026 .erbtn:disabled{opacity:.5}#encuentro2026 .erbanner{height:180px;background:linear-gradient(180deg,#add6f2,#dceafa);border-radius:14px;display:flex;align-items:end;justify-content:center;color:#123b67;font-weight:700;padding:16px}#encuentro2026 .ersub{color:#637388}#encuentro2026 td{padding:10px;border-bottom:1px solid #dbe4ec}#encuentro2026 table{width:100%;border-collapse:collapse}#er-admin-attendance .er-table-scroll{width:100%;max-width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch}#er-admin-attendance table{width:max-content;min-width:900px}#er-admin-attendance th,#er-admin-attendance td{padding:10px 12px;min-width:105px;white-space:nowrap;text-align:left}#er-admin-attendance th:nth-child(2),#er-admin-attendance td:nth-child(2){min-width:175px}#er-admin-attendance th:nth-child(3),#er-admin-attendance td:nth-child(3){min-width:210px}@media(max-width:600px){#encuentro2026 .erbox{padding:15px}#encuentro2026 td{font-size:16px;padding:7px}}
#encuentro2026 .er-consent-label{color:#801b3b;font-weight:800;line-height:1.5}#encuentro2026 .er-consent-label input[type=checkbox]{accent-color:#801b3b;width:22px;height:22px;vertical-align:middle;margin-right:8px}#encuentro2026 .er-consent-label:focus-within{outline:2px solid #801b3b;outline-offset:3px;border-radius:4px}
</style>
<div class="erhero erhero-approved" id="er-approved-poster" style="display:none"><img src="./encuentro-regional-2026-oficial.png" alt="Afiche oficial Encuentro Regional 2026. Democracia Cristiana O’Higgins, sábado 24 de octubre, 10:00 horas, calle Guangualí 159, Rengo. Unidos y comprometidos con nuestra región." style="display:block;width:100%;height:auto" loading="eager" decoding="async" onload="this.parentElement.style.display='block';document.getElementById('er-poster-fallback').style.display='none'" onerror="this.parentElement.style.display='none';document.getElementById('er-poster-fallback').style.display='block'"></div><div id="er-poster-fallback" class="erhero"><div class="erhero-photo" role="img" aria-label="Panorámica del Valle de Colchagua, Región de O'Higgins"></div><div class="erhero-wave" aria-hidden="true"></div><div class="erhero-content"><p class="erhero-kicker">DEMOCRACIA CRISTIANA · O’HIGGINS</p><h1>Encuentro Regional</h1><div class="erhero-year">2026</div><div class="erhero-sub">Frente de Profesionales y Técnicos</div><div class="erhero-details"><p><span aria-hidden="true">▦</span>Sábado 24 de octubre · 10:00 horas</p><p><span aria-hidden="true">●</span>Calle Guangualí N.º 159, Rengo</p></div><div class="erhero-slogan">Unidos y comprometidos<em>con nuestra región</em></div></div><div class="erhero-footer"></div><p class="erhero-credit">Fotografía: José Porras, <a href="https://commons.wikimedia.org/wiki/File:Vi%C3%B1aSantaCruz.jpg" target="_blank" rel="noopener noreferrer">CC BY 3.0</a> (recortada)</p></div>
<div class="erbox"><h2>Bienvenida del Presidente</h2><p>Estimadas y estimados camaradas:</p><p>Hoy nos encontramos para renovar nuestro compromiso con la Región de O'Higgins y con los principios humanistas y socialcristianos que inspiran a la Democracia Cristiana.</p><p>Nuestra región enfrenta importantes desafíos que requieren conocimiento, experiencia, diálogo y propuestas concretas. Tenemos la responsabilidad de poner nuestras capacidades profesionales al servicio de las personas, del desarrollo regional y del bien común.</p><p>Este encuentro marca el inicio de una nueva etapa de trabajo colectivo, donde la experiencia de quienes han construido nuestra historia se encuentre con las ideas y energías de las nuevas generaciones.</p><p><b>Porque nuestro compromiso no es solo reflexionar sobre el futuro, sino contribuir a construirlo.</b></p></div>
<div class="erbox"><h2>Programa del encuentro</h2><table><tbody>
<tr><td>10:00–10:05</td><td>Saludo de apertura y bienvenida</td></tr><tr><td>10:05–10:20</td><td>Palabras de nuestras autoridades</td></tr><tr><td>10:20–10:35</td><td>Estrategia regional del Frente</td></tr><tr><td>10:35–10:55</td><td>Diagnóstico regional</td></tr><tr><td>10:55–11:25</td><td>Metodología y plataforma digital</td></tr><tr><td>11:25–12:00</td><td>Constitución de mesas y acuerdos iniciales</td></tr>
</tbody></table></div>
<div class="erbox"><h2>Registrar mi asistencia</h2><p class="ersub">Complete sus datos para registrar su asistencia. La invitación por correo es opcional.</p>
<form id="erform"><label>Nombre completo<input required name="full_name" minlength="3" maxlength="120" autocomplete="name"></label><label>Correo electrónico<input required type="email" name="email" autocomplete="email"></label><label>Teléfono / WhatsApp<input name="phone" type="tel" maxlength="40"></label><label>Comuna<input name="commune" maxlength="80"></label><label class="er-consent-label"><input type="checkbox" name="consent_invitation"> También deseo recibir por correo una invitación para acceder a la plataforma (opcional).</label><button class="erbtn" type="submit">Registrar asistencia</button><p id="erresult" role="status" aria-live="polite"></p></form>
</div>\n<div class="erbox"><h2>Participación a distancia</h2><p>¿No podrá acompañarnos presencialmente en Rengo? Conozca el saludo de bienvenida, el programa y solicite integrarse a una mesa técnica desde su comuna.</p><a class="erbtn" style="display:inline-block;text-decoration:none" href="./participa-encuentro-2026.html">Participar desde mi comuna</a><p class="ersub">Las solicitudes se registran por separado de la asistencia presencial.</p></div>\n<div class="erbox"><h2>Conoce nuestra plataforma</h2><p>Mesas de Salud, Educación, Economía, Trabajo y Agricultura.</p><button class="erbtn" type="button" id="eraccess">Ingresar a la plataforma</button></div>`;
main.appendChild(el);
// Entrada pública directa del QR al programa del Encuentro 2026.
// El enlace habitual de la plataforma conserva su página de inicio.
const params=new URLSearchParams(window.location.search);
if(params.get('encuentro')==='2026'||window.location.hash==='#encuentro2026'){
  window.go('encuentro2026');
}
document.getElementById('erform').addEventListener('submit',async ev=>{
 ev.preventDefault();const form=ev.target,fd=new FormData(form),button=form.querySelector('button'),out=document.getElementById('erresult');
 button.disabled=true;out.textContent='Registrando asistencia...';
 try{const payload={full_name:fd.get('full_name'),email:fd.get('email'),phone:fd.get('phone'),commune:fd.get('commune'),consent_invitation:fd.get('consent_invitation')==='on',assisted:false};
 const h={'Content-Type':'application/json','apikey':window.SUPABASE_KEY||'sb_publishable_HZljMDp-yL6cEddxKWECiw_hJe-oaOQ'};
 if(payload.assisted){const s=await (typeof sbAuth!=='undefined'?sbAuth:null)?.auth.getSession();if(!s?.data?.session?.access_token)throw Error('Debe iniciar sesión con su cuenta autorizada');h.Authorization='Bearer '+s.data.session.access_token;}
 const r=await fetch('https://ozfcvaiatkmbehaokskz.supabase.co/functions/v1/encuentro-2026-registro',{method:'POST',headers:h,body:JSON.stringify(payload)}); const j=await r.json(); if(!r.ok)throw Error(j.error||'No fue posible registrar');out.textContent=j.message;form.reset();}catch(e){out.textContent=String(e.message||e)}finally{button.disabled=false}
});
document.getElementById('eraccess').onclick=()=>window.goAccess?.();


}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
})();