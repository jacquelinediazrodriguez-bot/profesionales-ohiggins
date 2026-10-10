/* Consulta de fichas profesionales: solo Administración General. */
(function(){
'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const general=()=>typeof window.isAdminGeneral==='function'&&window.isAdminGeneral();
function client(){try{return typeof sbAuth!=='undefined'?sbAuth:null}catch(_){return null}}
async function renderList(){
 if(!general()||!client())return;
 const host=document.getElementById('admincontent');if(!host)return;
 let block=document.getElementById('adminProfessionalDirectory');
 if(!block){block=document.createElement('div');block.id='adminProfessionalDirectory';block.className='card';block.style.marginTop='18px';host.appendChild(block)}
 block.innerHTML='<h2 class="section-sub">Fichas profesionales · acceso reservado</h2><p class="muted">Solo Administración General puede consultar los datos personales de contacto. Esta información no es pública.</p><p>Consultando profesionales…</p>';
 const {data,error}=await client().from('profiles').select('id,full_name,email,profession,specialty').order('full_name',{ascending:true}).limit(200);
 if(!general()||!block.isConnected)return;
 if(error){block.innerHTML='<h2>Fichas profesionales</h2><p>No fue posible consultar los perfiles.</p>';console.warn(error);return}
 const list=Array.isArray(data)?data:[];
 block.innerHTML='<h2 class="section-sub">Fichas profesionales · acceso reservado</h2><p class="muted">Información personal visible solamente para Administración General y el titular.</p>'+
 (list.length?list.map(p=>'<div class="row" style="padding:10px 0;border-bottom:1px solid var(--line)"><div><b>'+esc(p.full_name||'Sin nombre')+'</b><br><small>'+esc(p.email||'')+'</small><br><small>'+esc([p.profession,p.specialty].filter(Boolean).join(' · '))+'</small></div><button class="btn soft" type="button" data-contact-id="'+esc(p.id)+'">Ver ficha profesional</button></div>').join(''):'<p>No hay profesionales registrados.</p>')+'<div id="adminPrivateContactDetail" style="margin-top:14px"></div>';
 block.querySelectorAll('[data-contact-id]').forEach(btn=>btn.addEventListener('click',()=>openCard(btn.getAttribute('data-contact-id'),list)));
}
async function openCard(id,list){
 if(!general())return;
 const p=list.find(x=>x.id===id);if(!p)return;
 const detail=document.getElementById('adminPrivateContactDetail');if(!detail)return;
 detail.textContent='Consultando ficha de '+(p.full_name||'profesional')+'…';
 const {data,error}=await client().from('professional_private_contacts').select('phone,whatsapp,address,commune,region').eq('user_id',id).maybeSingle();
 if(!general()||!detail.isConnected)return;
 if(error){detail.textContent='No fue posible consultar la ficha de contacto.';console.warn(error);return}
 const d=data||{};
 detail.innerHTML='<div class="notice"><h3>Ficha profesional: '+esc(p.full_name||'')+'</h3><p><b>Correo:</b> '+esc(p.email||'—')+'</p><p><b>Profesión:</b> '+esc(p.profession||'—')+'</p><p><b>Especialidad:</b> '+esc(p.specialty||'—')+'</p><p><b>Teléfono:</b> '+esc(d.phone||'Sin registrar')+'</p><p><b>WhatsApp:</b> '+esc(d.whatsapp||'Sin registrar')+'</p><p><b>Dirección:</b> '+esc(d.address||'No informada')+'</p><p><b>Comuna:</b> '+esc(d.commune||'Sin registrar')+'</p><p><b>Región:</b> '+esc(d.region||'Sin registrar')+'</p><p class="muted">Datos de contacto de uso institucional reservado. Solo lectura.</p></div>';
}
const old=window.adminUsuarios;
if(typeof old==='function')window.adminUsuarios=function(){
 const r=old.apply(this,arguments);
 if(general())Promise.resolve(r).then(()=>renderList()).catch(e=>console.warn('Fichas profesionales',e));
 return r;
};
})();
