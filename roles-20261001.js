/* Roles globales + roles por Mesa — 01-10-2026 */
(function(){
'use strict';
const GLOBAL_ADMIN=['administrador_general','administrador_plataforma'];
const globalLabel=p=>String(p?.role||'')==='administrador_general'?'Administrador General':p?.is_platform_admin===true?'Administrador de Plataforma':'';
const isGlobalAdminProfile=p=>String(p?.role||'')==='administrador_general'||p?.is_platform_admin===true;

async function reloadMembershipCache(){
  try{
    if(typeof initSharedWorkspace==='function')await initSharedWorkspace();
  }catch(e){console.warn('No se pudo actualizar la pertenencia a Mesas',e)}
}

window.irAMiTrabajo=async function(){
  await reloadMembershipCache();
  const mesas=typeof getAssignedMesas==='function'?getAssignedMesas():[];
  if(!mesas.length){
    alert('Su cuenta administrativa todavía no tiene una Mesa de trabajo asignada. Puede asignarse una Mesa y un rol desde Integrantes y Roles.');
    return;
  }
  if(!mesas.includes(window.currentDocMesa))window.currentDocMesa=mesas[0];
  go('mifrente');
  privateTab('panel');
};
window.irAAdministracion=function(){
  if(!currentUser||!GLOBAL_ADMIN.includes(String(currentUser.systemRole||'')))return;
  go('adminarea');renderAdminShell();adminHome();
};

function injectWorkAdminButton(){
  const side=document.querySelector('#mifrente .side');
  if(!side)return;
  const authorized=!!currentUser&&GLOBAL_ADMIN.includes(String(currentUser.systemRole||''));
  if(!authorized){side.querySelectorAll('[data-back-admin]').forEach(b=>b.remove());return;}
  if(side.querySelector('[data-back-admin]'))return;
  const b=document.createElement('button');b.dataset.backAdmin='1';b.innerHTML='⚙️ Volver a Administración';b.onclick=irAAdministracion;
  const logout=[...side.querySelectorAll('button')].find(x=>x.textContent.includes('Salir'));
  if(logout)side.insertBefore(b,logout);else side.appendChild(b);
}

const oldPrivateTab=window.privateTab;
window.privateTab=function(tab){const r=oldPrivateTab(tab);injectWorkAdminButton();return r;};

/* Integra roles administrativos y roles por Mesa en una sola cuenta. */
window.adminUsuarios=async function(){
  if(!requireAdmin())return;
  const c=document.getElementById('admincontent');
  c.innerHTML='<div class="kicker">Administración</div><h1 class="section-title">Integrantes y Roles</h1><p class="muted">Cargando integrantes…</p>';
  try{
    const [{data:profiles,error:pe},{data:members,error:me},{data:tables,error:te}]=await Promise.all([
      sbAuth.from('profiles').select('id,full_name,email,role,is_platform_admin,is_active').order('full_name'),
      sbAuth.from('table_memberships').select('profile_id,technical_table_id,member_role,is_coordinator'),
      sbAuth.from('technical_tables').select('id,name,is_active').order('name')
    ]);
    if(pe||me||te)throw pe||me||te;
    window.__adminProfiles=profiles||[];window.__adminMemberships=members||[];window.__adminTables=tables||[];
    const activeTables=(tables||[]).filter(t=>t.is_active!==false);
    const tableOptions=activeTables.map(t=>'<option value="'+t.id+'">'+esc(t.name)+'</option>').join('');
    const profileOptions=(profiles||[]).map(p=>'<option value="'+p.id+'">'+esc(p.full_name||'Nombre pendiente')+' — '+esc(p.email)+(globalLabel(p)?' · '+globalLabel(p):'')+'</option>').join('');
    const general=currentUser?.systemRole==='administrador_general';
    c.innerHTML='<div class="kicker">Administración</div><h1 class="section-title">Integrantes y Roles</h1>'+
      '<div class="notice"><b>Una persona = una cuenta.</b> El correo y la contraseña son únicos. A esa misma cuenta se le pueden agregar distintas Mesas y un rol diferente en cada una. Los roles globales de administración no reemplazan los roles de Mesa.</div><br>'+
      '<div class="card"><h3>Asignar Mesa y rol</h3><div class="form-row"><div><label>Usuario registrado</label><select id="admProfile"><option value="">Seleccione…</option>'+profileOptions+'</select></div><div><label>Mesa Técnica</label><select id="admMesaId">'+tableOptions+'</select></div><div><label>Rol en esta Mesa</label><select id="admRol"><option>Integrante de Mesa</option><option>Secretario/a Técnico/a</option><option>Coordinador/a de Mesa</option></select></div></div><br><button class="btn primary" onclick="asignarRolAdmin()">Guardar Mesa y rol</button><p id="admInviteStatus" class="muted"></p><div class="mini-note" style="margin-top:12px">Administrador General y Administrador de Plataforma también pueden integrar Mesas. En esos dos casos se permite un máximo de 3 Mesas de trabajo.</div></div>'+
      (general?'<div class="card" style="margin-top:16px"><h3>Rol administrativo global</h3><div class="mini-note">Solo el Administrador General puede asignar o retirar el rol de Administrador de Plataforma.</div><br><div class="form-row"><div><label>Usuario</label><select id="globalRoleProfile"><option value="">Seleccione…</option>'+profileOptions+'</select></div><div><label>Rol global</label><select id="globalRoleValue"><option value="integrante">Sin rol administrativo</option><option value="administrador_plataforma">Administrador de Plataforma</option></select></div></div><br><button class="btn primary" onclick="guardarRolGlobal()">Guardar rol global</button><p id="globalRoleStatus" class="muted"></p></div>':'')+
      '<h2 class="section-sub">Usuarios registrados</h2><div id="admListado"></div>';
    renderIntegrantesCompleto();
  }catch(e){console.error(e);c.innerHTML+='<div class="notice">No fue posible cargar el listado completo.</div>'}
};

window.renderIntegrantesCompleto=function(){
  const b=document.getElementById('admListado');if(!b)return;
  const ps=window.__adminProfiles||[],ms=window.__adminMemberships||[],ts=window.__adminTables||[];
  b.innerHTML=ps.length?ps.map(p=>{
    const own=ms.filter(m=>String(m.profile_id)===String(p.id));
    const g=globalLabel(p);
    const assigns=own.length?own.map(m=>{const t=ts.find(x=>String(x.id)===String(m.technical_table_id));const role=m.is_coordinator?'Coordinador/a de Mesa':(m.member_role||'Integrante de Mesa');return '<div class="row"><div><b>'+esc(t?.name||'Mesa')+'</b></div><div><span class="pill">'+esc(role)+'</span> <button class="btn danger" onclick="quitarAsignacionAdmin(\''+p.id+'\','+Number(m.technical_table_id)+',\''+String(p.full_name||'Integrante').replace(/'/g,"\\'")+'\',\''+String(t?.name||'Mesa').replace(/'/g,"\\'")+'\')">Quitar de esta Mesa</button></div></div>'}).join(''):'<div class="mini-note">Sin Mesa ni rol asignado todavía.</div>';
    return '<div class="card" style="margin-bottom:10px"><b>'+esc(p.full_name||'Nombre pendiente')+'</b><br><small>'+esc(p.email||'')+'</small> '+(g?'<span class="pill">'+esc(g)+'</span> ':'')+'<span class="pill '+(p.is_active?'green':'amber')+'">'+(p.is_active?'Activo':'Inactivo')+'</span><div class="muted" style="margin-top:7px">Mesas asignadas: '+own.length+(isGlobalAdminProfile(p)?' de 3 máximo':'')+'</div><div style="margin-top:10px">'+assigns+'</div></div>';
  }).join(''):'<div class="notice">Sin perfiles registrados.</div>';
};

window.asignarRolAdmin=async function(){
  const profileId=document.getElementById('admProfile')?.value,tableId=Number(document.getElementById('admMesaId')?.value),role=document.getElementById('admRol')?.value,status=document.getElementById('admInviteStatus');
  if(!profileId||!tableId){if(status)status.textContent='Seleccione usuario, Mesa y rol.';return}
  const p=(window.__adminProfiles||[]).find(x=>String(x.id)===String(profileId));
  const own=(window.__adminMemberships||[]).filter(x=>String(x.profile_id)===String(profileId));
  const already=own.some(x=>Number(x.technical_table_id)===tableId);
  if(isGlobalAdminProfile(p)&&!already&&own.length>=3){if(status)status.textContent='Este usuario administrativo ya integra el máximo de 3 Mesas.';return}
  if(status)status.textContent='Guardando…';
  try{
    const {data,error}=await sbAuth.functions.invoke('admin-user',{body:{action:'assign_membership',profile_id:profileId,technical_table_id:tableId,member_role:role}});
    if(error||!data?.ok)throw error||new Error(data?.error||'No fue posible guardar la asignación.');
    if(status)status.textContent='Asignación guardada correctamente ✓';
    await adminUsuarios();
    if(String(profileId)===String(currentUser?.supabaseId))await reloadMembershipCache();
  }catch(e){console.error(e);if(status)status.textContent=e?.message||'No fue posible guardar la asignación.'}
};

window.guardarRolGlobal=async function(){
  const sel=document.getElementById('globalRoleProfile'),role=document.getElementById('globalRoleValue')?.value,status=document.getElementById('globalRoleStatus');
  if(currentUser?.systemRole!=='administrador_general'){if(status)status.textContent='Solo el Administrador General puede realizar este cambio.';return}
  const p=(window.__adminProfiles||[]).find(x=>String(x.id)===String(sel?.value||''));
  if(!p||!role){if(status)status.textContent='Seleccione usuario y rol.';return}
  if(p.role==='administrador_general'){if(status)status.textContent='El rol de Administrador General no se modifica desde esta opción.';return}
  if(status)status.textContent='Guardando…';
  try{
    const {data,error}=await sbAuth.functions.invoke('admin-set-account-role',{body:{email:p.email,role}});
    if(error||!data?.ok)throw error||new Error(data?.error||'No fue posible actualizar el rol global.');
    if(status)status.textContent='Rol global actualizado correctamente ✓';await adminUsuarios();
  }catch(e){console.error(e);if(status)status.textContent=e?.message||'No fue posible actualizar el rol global.'}
};

const oldRenderAdminShell2=window.renderAdminShell;
window.renderAdminShell=function(){
  oldRenderAdminShell2();
  const side=document.querySelector('#adminShell .side');if(!side)return;
  if(!side.querySelector('[data-my-work]')){
    const b=document.createElement('button');b.dataset.myWork='1';b.innerHTML='🧭 Ir a Mi Trabajo';b.onclick=irAMiTrabajo;
    const logout=[...side.querySelectorAll('button')].find(x=>x.textContent.includes('Salir'));
    if(logout)side.insertBefore(b,logout);else side.appendChild(b);
  }
};

// Observe only sidebar replacement, not every DOM change on the entire site.
const sidebarHost=document.getElementById('adminShell');
if(sidebarHost){
  let pending=false;
  const observer=new MutationObserver((records)=>{
    if(pending)return;
    if(!records.some(m=>[...m.addedNodes].some(n=>n.nodeType===1 && (n.matches?.('.side')||n.querySelector?.('.side')))))return;
    pending=true;
    queueMicrotask(()=>{pending=false;injectWorkAdminButton()});
  });
  observer.observe(sidebarHost,{childList:true,subtree:true});
}
})();