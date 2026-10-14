/* Identidad visual del profesional autenticado. La identidad proviene de Supabase,
   no de datos de sesión del navegador sin verificar. */
(function(){
'use strict';
const ID='activeProfessionalHeader';
const LABELS={administrador_general:'Administrador General',administrador_plataforma:'Administrador de Plataforma',integrante:'Integrante',coordinador:'Coordinador',secretario_tecnico:'Secretario Técnico'};
let generation=0, lastId='', lastProfile=null, loading=false;
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function localIdentity(){try{return JSON.parse(sessionStorage.getItem('frentePT_user')||'null')}catch(_){return null}}
function supabase(){try{return typeof sbAuth!=='undefined'?sbAuth:null}catch(_){return null}}
function badge(){
 const top=document.querySelector('header .top');if(!top)return null;
 let node=document.getElementById(ID);
 if(!node){node=document.createElement('div');node.id=ID;node.className='active-professional-header';node.setAttribute('aria-live','polite');const nav=document.getElementById('publicNav');nav?top.insertBefore(node,nav):top.appendChild(node)}
 return node;
}
function style(){
 if(document.getElementById('active-professional-header-style'))return;
 const s=document.createElement('style');s.id='active-professional-header-style';
 s.textContent='.top{flex-wrap:wrap}.active-professional-header{display:none;align-items:center;gap:8px;margin-left:auto;padding:8px 12px;border:1px solid var(--line);border-radius:12px;background:#f7fafc;color:var(--ink);font-size:13px;line-height:1.25;white-space:nowrap}.active-professional-header.visible{display:flex}.active-professional-header .aph-label{color:var(--muted);font-weight:700}.active-professional-header .aph-name{color:var(--blue);font-weight:850}.active-professional-header .aph-role{display:inline-block;padding:3px 7px;border-radius:999px;background:#eaf1f7;color:var(--blue);font-size:11px;font-weight:800}@media(max-width:900px){.active-professional-header{order:3;width:100%;margin:2px 0 0;justify-content:center;white-space:normal;text-align:center;flex-wrap:wrap}}';
 document.head.appendChild(s);
}
function draw(name,role){
 const node=badge();if(!node)return;
 if(!name){node.replaceChildren();node.classList.remove('visible');return}
 node.innerHTML='<span class="aph-label">Profesional conectado:</span><span class="aph-name">'+esc(name)+'</span>'+(role?'<span class="aph-role">'+esc(LABELS[role]||role)+'</span>':'');
 node.classList.add('visible');
}
async function refresh(){
 const sb=supabase();if(!sb?.auth)return;
 let session=null;
 try{const result=await sb.auth.getSession();session=result?.data?.session}catch(_){}
 const uid=session?.user?.id;
 if(!uid){lastId='';lastProfile=null;generation++;draw('','');return}
 if(lastId!==uid){lastId=uid;lastProfile=null;generation++}
 const requestGeneration=generation;
 const stored=localIdentity();
 const matching=stored && (stored.supabaseId===uid || stored.id===uid || String(stored.email||stored.correo||'').toLowerCase()===String(session.user.email||'').toLowerCase());
 // Render the last verified profile only; stale browser data is not an authorization source.
 if(lastProfile){draw(lastProfile.full_name||'',lastProfile.role==='administrador_general'?'administrador_general':(lastProfile.is_platform_admin===true?'administrador_plataforma':lastProfile.role||''));return}
 if(loading)return;
 loading=true;
 try{
   const {data,error}=await sb.from('profiles').select('id,full_name,role,is_platform_admin').eq('id',uid).maybeSingle();
   if(requestGeneration!==generation)return;
   if(error)console.warn('No se pudo cargar el perfil del profesional',error);
   if(data){lastProfile=data;draw(data.full_name||stored?.nombre||stored?.full_name||session.user.email||'',data.role==='administrador_general'?'administrador_general':(data.is_platform_admin===true?'administrador_plataforma':data.role||''));}
   else if(matching){draw(stored.nombre||stored.full_name||stored.name||session.user.email||'',stored.rol||stored.role||'');}
   else draw(session.user.email||'Usuario autenticado','');
 }catch(err){if(requestGeneration===generation){console.warn('No se pudo actualizar el profesional conectado',err);draw(matching?(stored.nombre||stored.full_name||session.user.email):session.user.email,matching?(stored.rol||stored.role):'')}}
 finally{loading=false}
}
style();refresh();
document.addEventListener('click',()=>setTimeout(refresh,100),true);
setInterval(refresh,2500);
setTimeout(()=>{try{supabase()?.auth?.onAuthStateChange?.(()=>{lastProfile=null;generation++;setTimeout(refresh,0)})}catch(_){}},500);
})();