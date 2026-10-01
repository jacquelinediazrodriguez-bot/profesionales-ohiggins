/* Correcciones funcionales 01-10-2026 */
(function(){
'use strict';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const adminRoles=['Administrador General','Administrador de Plataforma'];
const isAdmin=()=>!!currentUser&&adminRoles.includes(currentUser.rol);

/* 1. Restaurar correctamente la sesión real al recargar. Evita que una sesión
   administrativa válida quede en estado local y muestre “Se requiere una cuenta administrativa”. */
async function restoreCloudSession(){
  if(!sbAuth||!currentUser?.supabaseId)return;
  try{
    const {data}=await sbAuth.auth.getSession();
    if(!data?.session){currentUser=null;sessionStorage.removeItem('frentePT_user');return}
    if(typeof initSharedWorkspace==='function'){
      const ok=await initSharedWorkspace();
      if(!ok)return;
      if(isAdmin()&&document.getElementById('adminarea')?.classList.contains('active')){
        renderAdminShell();adminHome();
      }
    }
  }catch(e){console.error('No se pudo restaurar la sesión compartida',e)}
}

/* 2. El botón Acceso siempre lleva primero a identificación cuando no hay una
   sesión autenticada real. No se considera suficiente un objeto local antiguo. */
const oldGoAccess=window.goAccess;
window.goAccess=async function(){
  if(sbAuth){
    try{
      const {data}=await sbAuth.auth.getSession();
      if(!data?.session){currentUser=null;sessionStorage.removeItem('frentePT_user');go('mesas');setTimeout(()=>document.getElementById('loginEmail')?.focus(),100);return}
    }catch(e){}
  }
  return oldGoAccess();
};

/* 3. Administración: listado completo de perfiles, incluso quienes todavía no
   tienen Mesa. Permite asignar varios roles, uno por Mesa, sin prohibir que el
   mismo tipo de rol exista en otra Mesa. */
window.adminUsuarios=async function(){
  if(!requireAdmin())return;
  const c=document.getElementById('admincontent');
  c.innerHTML='<div class="kicker">Administración</div><h1 class="section-title">Integrantes y Roles</h1><p class="muted">Cargando integrantes…</p>';
  try{
    const [{data:profiles,error:pe},{data:members,error:me},{data:tables,error:te}]=await Promise.all([
      sbAuth.from('profiles').select('id,full_name,email,role,is_active').order('full_name'),
      sbAuth.from('table_memberships').select('profile_id,technical_table_id,member_role,is_coordinator'),
      sbAuth.from('technical_tables').select('id,name,is_active').order('name')
    ]);
    if(pe||me||te)throw pe||me||te;
    window.__adminProfiles=profiles||[];window.__adminMemberships=members||[];window.__adminTables=tables||[];
    const options=(tables||[]).filter(t=>t.is_active!==false).map(t=>'<option value="'+t.id+'">'+esc(t.name)+'</option>').join('');
    c.innerHTML='<div class="kicker">Administración</div><h1 class="section-title">Integrantes y Roles</h1>'+
      '<div class="notice"><b>Asignación flexible:</b> una persona puede pertenecer a varias Mesas y tener un rol diferente en cada una. El listado incluye también perfiles registrados que aún no tienen Mesa.</div><br>'+
      '<div class="card"><div class="form-row"><div><label>Integrante registrado</label><select id="admProfile"><option value="">Seleccione…</option>'+(profiles||[]).filter(p=>!['administrador_general','administrador_plataforma'].includes(p.role)).map(p=>'<option value="'+p.id+'">'+esc(p.full_name||'Nombre pendiente')+' — '+esc(p.email)+'</option>').join('')+'</select></div><div><label>Mesa Técnica</label><select id="admMesaId">'+options+'</select></div><div><label>Rol en esta Mesa</label><select id="admRol"><option>Integrante de Mesa</option><option>Secretario/a Técnico/a</option><option>Coordinador/a de Mesa</option></select></div></div><br><button class="btn primary" onclick="asignarRolAdmin()">Guardar Mesa y rol</button><p id="admInviteStatus" class="muted"></p></div>'+
      '<h2 class="section-sub">Integrantes registrados</h2><div id="admListado"></div>';
    renderIntegrantesCompleto();
  }catch(e){console.error(e);c.innerHTML+='<div class="notice">No fue posible cargar el listado completo.</div>'}
};
window.renderIntegrantesCompleto=function(){
  const b=document.getElementById('admListado');if(!b)return;
  const ps=window.__adminProfiles||[],ms=window.__adminMemberships||[],ts=window.__adminTables||[];
  const rows=ps.filter(p=>!['administrador_general','administrador_plataforma'].includes(p.role));
  b.innerHTML=rows.length?rows.map(p=>{
    const own=ms.filter(m=>String(m.profile_id)===String(p.id));
    const assigns=own.length?own.map(m=>{const t=ts.find(x=>String(x.id)===String(m.technical_table_id));const role=m.is_coordinator?'Coordinador/a de Mesa':(m.member_role||'Integrante de Mesa');return '<div class="row"><div><b>'+esc(t?.name||'Mesa')+'</b></div><div><span class="pill">'+esc(role)+'</span> <button class="btn danger" onclick="quitarAsignacionAdmin(\''+p.id+'\','+Number(m.technical_table_id)+',\''+String(p.full_name||'Integrante').replace(/'/g,"\\'")+'\',\''+String(t?.name||'Mesa').replace(/'/g,"\\'")+'\')">Quitar de esta Mesa</button></div></div>'}).join(''):'<div class="mini-note">Sin Mesa ni rol asignado todavía.</div>';
    return '<div class="card" style="margin-bottom:10px"><b>'+esc(p.full_name||'Nombre pendiente')+'</b><br><small>'+esc(p.email||'')+'</small> <span class="pill '+(p.is_active?'green':'amber')+'">'+(p.is_active?'Activo':'Inactivo')+'</span><div style="margin-top:10px">'+assigns+'</div></div>';
  }).join(''):'<div class="notice">Sin perfiles registrados.</div>';
};
window.asignarRolAdmin=async function(){
  const profileId=document.getElementById('admProfile')?.value,tableId=Number(document.getElementById('admMesaId')?.value),role=document.getElementById('admRol')?.value,status=document.getElementById('admInviteStatus');
  if(!profileId||!tableId)return status.textContent='Seleccione integrante, Mesa y rol.';
  status.textContent='Guardando…';
  try{
    const {data,error}=await sbAuth.functions.invoke('admin-user',{body:{action:'assign_membership',profile_id:profileId,technical_table_id:tableId,member_role:role}});
    if(error||!data?.ok)throw error||new Error(data?.error||'No fue posible guardar la asignación.');
    status.textContent='Asignación guardada correctamente ✓';await adminUsuarios();
  }catch(e){console.error(e);status.textContent=e?.message||'No fue posible guardar la asignación.'}
};
window.quitarAsignacionAdmin=async function(profileId,tableId,nombre,mesa){
  if(!confirm('¿Quitar a '+nombre+' de la Mesa '+mesa+'?\n\nSe conservarán su cuenta, perfil, otras Mesas y antecedentes históricos.'))return;
  try{
    const {data,error}=await sbAuth.functions.invoke('admin-user',{body:{action:'remove_membership',profile_id:profileId,technical_table_id:Number(tableId)}});
    if(error||!data?.ok)throw error||new Error(data?.error||'No fue posible quitar la asignación.');
    await adminUsuarios();
  }catch(e){console.error(e);alert(e?.message||'No fue posible quitar al integrante de esta Mesa.')}
};

/* 4. Administración General: cuadro transversal de documentos por Mesa. */
window.adminDocumentosMesas=async function(){
  if(!requireAdmin())return;
  const c=document.getElementById('admincontent');c.innerHTML='<div class="kicker">Administración</div><h1 class="section-title">Documentos de las Mesas</h1><p class="muted">Cargando documentos…</p>';
  try{
    const [{data:docs,error:de},{data:tables,error:te}]=await Promise.all([
      sbAuth.from('workspace_documents').select('technical_table_id,title,state,revision,data'),
      sbAuth.from('technical_tables').select('id,name').order('name')
    ]);if(de||te)throw de||te;
    const tableName=id=>(tables||[]).find(t=>String(t.id)===String(id))?.name||'Mesa';
    c.innerHTML='<div class="kicker">Supervisión transversal</div><h1 class="section-title">Documentos de las Mesas</h1><div class="notice">Vista de Administración para revisar el avance de todas las Mesas sin ingresar una por una.</div><br>'+
      '<div class="source-table-wrap"><table class="source-table"><thead><tr><th>Mesa</th><th>Documento</th><th>Estado</th><th>Versión</th><th>Última modificación</th></tr></thead><tbody>'+
      ((docs||[]).length?(docs||[]).map(d=>'<tr><td><b>'+esc(tableName(d.technical_table_id))+'</b></td><td>'+esc(d.title||d.data?.titulo||'Documento de trabajo')+'</td><td><span class="pill">'+esc(d.state||d.data?.estado||'En elaboración')+'</span></td><td>'+esc(String(d.revision||d.data?.versiones?.at?.(-1)?.numero||'—'))+'</td><td>'+esc(d.data?.ultima||'—')+'</td></tr>').join(''):'<tr><td colspan="5">No hay documentos registrados.</td></tr>')+'</tbody></table></div>';
  }catch(e){console.error(e);c.innerHTML+='<div class="notice">No fue posible consultar los documentos.</div>'}
};
const oldRenderAdminShell=window.renderAdminShell;
window.renderAdminShell=function(){oldRenderAdminShell();const side=document.querySelector('#adminShell .side');if(side&&!side.querySelector('[data-docs-mesas]')){const btn=document.createElement('button');btn.dataset.docsMesas='1';btn.innerHTML='📄 Documentos de las Mesas';btn.onclick=adminDocumentosMesas;const anchor=[...side.querySelectorAll('button')].find(x=>x.textContent.includes('Revisión y publicaciones'));if(anchor)side.insertBefore(btn,anchor);else side.appendChild(btn)}};

/* 5. Invitación: nombre obligatorio y visible al activar la cuenta. */
const oldDirect=window.adminInvitacionDirecta;
window.adminInvitacionDirecta=async function(){
  const name=prompt('Nombre completo de la persona:');if(name===null)return;if(!name.trim())return alert('Ingrese el nombre completo.');
  const email=prompt('Correo electrónico:');if(email===null)return;
  const clean=String(email).normalize('NFKC').replace(/[\s\u200B-\u200D\uFEFF]+/g,'').toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean))return alert('Ingrese un correo electrónico válido.');
  try{
    const {data,error}=await sbAuth.functions.invoke('member-invitation',{body:{action:'direct_invite',email:clean,full_name:name.trim()}});
    if(error)throw error;if(!data?.ok)throw new Error(data?.error||'No fue posible enviar la invitación.');
    alert(data.status==='Registro completado'?'Este correo ya tiene el registro completado.':'Invitación enviada correctamente a '+name.trim()+'.');
    await adminInvitaciones();
  }catch(e){console.error(e);alert(e?.message||'No fue posible enviar la invitación.')}
};
const oldInvitationModal=window.invitationModal;
function addNameAndEyes(){
  const modal=document.getElementById('invitationPasswordModal');if(modal&&!document.getElementById('invFullName')){
    const form=modal.querySelector('.form'),first=form?.querySelector('label');if(first){const l=document.createElement('label');l.innerHTML='Nombre completo<input id="invFullName" autocomplete="name" placeholder="Nombre y apellidos">';form.insertBefore(l,first)}
  }
  [['invNewPass','invNewPassEye'],['invNewPass2','invNewPass2Eye'],['newRecoveryPass','recEye1'],['newRecoveryPass2','recEye2']].forEach(([id,bid])=>{const input=document.getElementById(id);if(!input||document.getElementById(bid))return;const b=document.createElement('button');b.type='button';b.id=bid;b.className='btn soft';b.style.marginTop='6px';b.textContent='👁 Mostrar contraseña';b.onclick=()=>{const show=input.type==='password';input.type=show?'text':'password';b.textContent=show?'🙈 Ocultar contraseña':'👁 Mostrar contraseña'};input.insertAdjacentElement('afterend',b)});
}
const oldShowInvite=window.mostrarClaveInvitacion;
window.mostrarClaveInvitacion=async function(){const r=await oldShowInvite();addNameAndEyes();try{const {data:{user}}=await sbAuth.auth.getUser();if(user){const {data:p}=await sbAuth.from('profiles').select('full_name').eq('id',user.id).maybeSingle();const n=document.getElementById('invFullName');if(n&&!n.value)n.value=p?.full_name||user.user_metadata?.full_name||''}}catch(e){}return r};
const oldSaveInvite=window.guardarClaveInvitacion;
window.guardarClaveInvitacion=async function(){
  const name=document.getElementById('invFullName')?.value.trim()||'';if(!name)return document.getElementById('invSetPassStatus').textContent='Ingrese su nombre completo antes de activar la cuenta.';
  try{const {data:{user}}=await sbAuth.auth.getUser();if(user){await sbAuth.auth.updateUser({data:{full_name:name}});await sbAuth.from('profiles').update({full_name:name,updated_at:new Date().toISOString()}).eq('id',user.id)}}catch(e){console.warn('El nombre se completará al ingresar',e)}
  return oldSaveInvite();
};

/* 6. Mostrar/ocultar contraseña también en acceso y recuperación. */
function addLoginEye(){[['loginPass','loginEye'],['newRecoveryPass','recEye1'],['newRecoveryPass2','recEye2']].forEach(([id,bid])=>{const input=document.getElementById(id);if(!input||document.getElementById(bid))return;const b=document.createElement('button');b.type='button';b.id=bid;b.className='btn soft';b.style.marginTop='6px';b.textContent='👁 Mostrar contraseña';b.onclick=()=>{const show=input.type==='password';input.type=show?'text':'password';b.textContent=show?'🙈 Ocultar contraseña':'👁 Mostrar contraseña'};input.insertAdjacentElement('afterend',b)})}

/* 7. Directorio: acciones explícitas para registros complementarios y botón de
   actualización/recarga de la fuente compartida. */
const oldAdminRepresentantes=window.adminRepresentantes;
window.adminRepresentantes=async function(){
  oldAdminRepresentantes();const c=document.getElementById('admincontent');if(!c)return;
  const h=c.querySelector('h1');if(h&&!document.getElementById('dirRefreshBtn')){const bar=document.createElement('div');bar.className='toolbar-row';bar.style.margin='10px 0 16px';bar.innerHTML='<button id="dirRefreshBtn" class="btn soft">↻ Actualizar información del directorio</button><span id="dirRefreshStatus" class="muted"></span>';h.insertAdjacentElement('afterend',bar);bar.querySelector('button').onclick=async()=>{const s=document.getElementById('dirRefreshStatus');s.textContent='Actualizando…';try{if(typeof loadSharedDirectory==='function')await loadSharedDirectory();s.textContent='Directorio actualizado desde la información disponible en la plataforma.';oldAdminRepresentantes()}catch(e){s.textContent='No fue posible actualizar el directorio.'}}}
};

/* Ejecutar mejoras visuales y restauración. */
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{addLoginEye();setTimeout(restoreCloudSession,250)});else{addLoginEye();setTimeout(restoreCloudSession,250)}
const obs=new MutationObserver(()=>{addLoginEye();addNameAndEyes()});obs.observe(document.documentElement,{childList:true,subtree:true});
})();