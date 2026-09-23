/* Sincronización segura de la plataforma — V2.
   El modo demostración continúa siendo LOCAL y nunca escribe en las mesas reales. */
(function(){
 'use strict';
 const STATE={ready:false,initializing:false,uid:null,ids:{},snapshots:{},timers:{},busy:{},retry:{},publicReady:false,adminData:null};
 const original={setWork:window.setWork,guardarPerfil:window.guardarPerfil,
  workKey:window.workKey,draftKey:window.draftKey,getIntegrantes:window.getIntegrantes,
  getPubRequests:window.getPubRequests,getSolicitudes:window.getSolicitudes,
  getPublicaciones:window.getPublicaciones,
  registrarContacto:window.registrarContacto,guardarSolicitud:window.guardarSolicitud,
  guardarIntegrante:window.guardarIntegrante,guardarMesaTecnica:window.guardarMesaTecnica,
  solicitarPublicacion:window.solicitarPublicacion,publicarSolicitud:window.publicarSolicitud,
  rechazarSolicitudPublicacion:window.rechazarSolicitudPublicacion};
 const copy=x=>JSON.parse(JSON.stringify(x));
 const isReal=()=>STATE.ready&&currentUser?.supabaseId===STATE.uid&&!!sbAuth;
 const label=(message,error=false)=>{
   const x=document.getElementById('autosaveStatus');
   if(x&&isReal()){x.textContent=message;x.style.color=error?'#a3352a':'#2e7d62'}
   const y=document.getElementById('cloudSyncStatus');
   if(y){y.textContent=message;y.style.color=error?'#a3352a':'#2e7d62'}
 };
 const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 const mesaId=m=>STATE.ids[m]||null;
 // Separar los borradores de las cuentas reales de los prototipos públicos.
 window.workKey=function(m){return currentUser?.supabaseId?'frentePT_real_work_'+currentUser.supabaseId+'_'+m:original.workKey(m)};
 window.draftKey=function(m){return currentUser?.supabaseId?'frentePT_real_draft_'+currentUser.supabaseId+'_'+m:original.draftKey(m)};
 window.getIntegrantes=function(){if(currentUser?.supabaseId){if(STATE.adminData?.integrantes)return STATE.adminData.integrantes;try{return JSON.parse(sessionStorage.getItem('frentePT_real_roles')||'[]')}catch(e){return []}}return original.getIntegrantes()};
 window.getPubRequests=function(){return currentUser?.supabaseId?(STATE.adminData?.requests||[]):original.getPubRequests()};
 window.getSolicitudes=function(){return currentUser?.supabaseId?(STATE.adminData?.solicitudes||[]):original.getSolicitudes()};
 window.getPublicaciones=function(){if(STATE.publicReady&&(!currentUser||currentUser?.supabaseId)){try{return JSON.parse(localStorage.getItem('frentePT_biblioteca_cloud')||'[]')}catch(e){return []}}return original.getPublicaciones()};
 const snapshotKey=m=>'frentePT_lastCloud_'+STATE.uid+'_'+m;
 const pendingKey=m=>'frentePT_syncPending_'+STATE.uid+'_'+m;
 function diff(before,now){
   const patch={},a=before||{},b=now||{};
   const ac=a.contenido||{},bc=b.contenido||{},sectionPatch={};
   Object.keys(bc).forEach(k=>{if(!same(ac[k],bc[k]))sectionPatch[k]=bc[k]});
   if(Object.keys(sectionPatch).length)patch.contenido=sectionPatch;
   ['titulo','estado','referencias','tareas','comentarios','versiones','ultima'].forEach(k=>{
     if(!same(a[k],b[k])&&b[k]!==undefined)patch[k]=b[k]
   });
   return patch;
 }
 function queue(m){
   if(!isReal()||!mesaId(m))return;
   try{localStorage.setItem(pendingKey(m),'1')}catch(e){}
   clearTimeout(STATE.timers[m]);label('Pendiente de sincronización…');
   STATE.timers[m]=setTimeout(()=>flush(m),950);
 }
 async function flush(m){
   if(!isReal()||!mesaId(m)||STATE.busy[m])return;
   STATE.busy[m]=true;
   try{
     const saved=STATE.snapshots[m]||defaultWork(m),local=getWork(m);
     let patch=diff(saved,local);
     if(!Object.keys(patch).length){
       localStorage.removeItem(pendingKey(m));label('Guardado en la nube ✓');return;
     }
     label('Guardando en la nube…');
     const {data,error}=await sbAuth.rpc('save_workspace_patch',{p_technical_table_id:mesaId(m),p_patch:patch});
     if(error)throw error;
     if(!data||!data.data)throw Error('El servidor no confirmó el guardado');
     STATE.snapshots[m]=copy({...defaultWork(m),...data.data,contenido:migrateContenido(data.data.contenido||{})});
     localStorage.setItem(snapshotKey(m),JSON.stringify(STATE.snapshots[m]));
     if(!Object.keys(diff(STATE.snapshots[m],getWork(m))).length){
       localStorage.removeItem(pendingKey(m));label('Guardado y verificado en la nube ✓');
     }else{
       localStorage.setItem(pendingKey(m),'1');label('Guardando otros cambios…');
     }
   }catch(err){
     console.error('La sincronización no se completó:',err);
     label('⚠ Guardado solo en este navegador. Se reintentará la sincronización.',true);
     try{localStorage.setItem(pendingKey(m),'1')}catch(e){}
   }finally{
     STATE.busy[m]=false;
     if(isReal()&&localStorage.getItem(pendingKey(m))==='1'){
       clearTimeout(STATE.timers[m]);STATE.timers[m]=setTimeout(()=>flush(m),6000);
     }
   }
 }
 // Sigue guardando de inmediato en el navegador; el servidor se actualiza en segundo plano.
 window.setWork=function(m,d){original.setWork(m,d);queue(m)};
 function backupLocal(m,raw){
   if(!raw)return;
   const key='frentePT_backup_'+m+'_'+Date.now();
   try{localStorage.setItem(key,raw)}catch(err){console.error('No fue posible crear la copia:',err)}
 }
 async function pullWorkspaces(){
   const ids=Object.values(STATE.ids);
   if(!ids.length)return;
   const {data,error}=await sbAuth.from('workspace_documents')
      .select('technical_table_id,data,title,revision').in('technical_table_id',ids);
   if(error)throw error;
   for(const [m,id] of Object.entries(STATE.ids)){
     const row=(data||[]).find(x=>String(x.technical_table_id)===String(id));
     const remote=copy({...defaultWork(m),...(row?.data||{}),contenido:migrateContenido(row?.data?.contenido||{})});
     const localRaw=localStorage.getItem(workKey(m));
     const demoRaw=localStorage.getItem(original.workKey(m));
     if(demoRaw&&!localStorage.getItem('frentePT_legacy_imported_'+STATE.uid+'_'+m)){
       backupLocal(m,demoRaw);
       localStorage.setItem('frentePT_legacy_imported_'+STATE.uid+'_'+m,'1');
     }
     const local=localRaw?getWork(m):null;
     const oldCloudRaw=localStorage.getItem(snapshotKey(m));
     let oldCloud;
     try{oldCloud=oldCloudRaw?JSON.parse(oldCloudRaw):null}catch(err){oldCloud=null}
     STATE.snapshots[m]=remote;
     if(oldCloud&&local&&localStorage.getItem(pendingKey(m))==='1'){
       // Retener el borrador que no llegó al servidor; no sobrescribir el documento compartido.
       const changes=diff(oldCloud,local);
       backupLocal(m,localRaw);
       original.setWork(m,remote);
       if(Object.keys(changes).length){
         const merged={...remote,...(changes||{}),contenido:{...(remote.contenido||{}),...(changes.contenido||{})}};
         original.setWork(m,merged);
         localStorage.setItem(pendingKey(m),'1');
         queue(m);
       }
     }else if(local&&Object.keys(diff(remote,local)).length){
       // Los antiguos borradores locales nunca se suben sin permiso.
       backupLocal(m,localRaw);
       original.setWork(m,remote);
       const banner=document.getElementById('cloudImportNotice');
       if(banner){
         banner.style.display='block';
         banner.textContent='Se conservó una copia de su borrador anterior de '+m+'. Para importarla sin sobrescribir trabajo compartido, abra la opción «Importar copia local».';
       }
     }else original.setWork(m,remote);
     localStorage.setItem(snapshotKey(m),JSON.stringify(remote));
   }
 }
 function showCloudControls(){
   if(!document.getElementById('cloudSyncPanel')){
     const b=document.createElement('div');b.id='cloudSyncPanel';b.className='mini-note';b.style.margin='12px 0';
     b.innerHTML='<b>Trabajo compartido</b><p id="cloudSyncStatus">Conectado a la base de datos.</p><button class="btn soft" type="button" onclick="importarCopiaLocal()">Importar una copia local anterior</button><p id="cloudImportNotice" style="display:none"></p>';
     document.getElementById('privatecontent')?.prepend(b);
   }
 }
 window.importarCopiaLocal=async function(){
   if(!isReal())return alert('Ingrese primero con una cuenta real.');
   const m=currentDocMesa;const keys=Object.keys(localStorage).filter(k=>k.startsWith('frentePT_backup_'+m+'_')).sort().reverse();
   if(!keys.length)return alert('No se encontró una copia local anterior para esta Mesa.');
   let raw;try{raw=JSON.parse(localStorage.getItem(keys[0]))}catch(e){return alert('La copia local no se pudo leer.')}
   if(!confirm('¿Importar la copia local anterior en esta Mesa? Se mezclarán las secciones de su copia con el documento compartido. Revise las secciones antes de guardar una versión.'))return;
   const remote=STATE.snapshots[m]||defaultWork(m);
   const sections={...(remote.contenido||{})};
   for(const [k,v] of Object.entries(raw.contenido||{})){if(v&&v.trim())sections[k]=v}
   const merged={...remote,contenido:sections};
   original.setWork(m,merged);queue(m);
   if(typeof renderEspacio==='function')renderEspacio(document.getElementById('privatecontent'));
   showCloudControls();label('Importación pendiente: guardando secciones en la nube…');
 };
 window.initSharedWorkspace=async function(){
   if(!sbAuth||!currentUser?.supabaseId)return false;
   STATE.initializing=true;STATE.ready=false;STATE.uid=currentUser.supabaseId;STATE.ids={};STATE.adminData=null;
   try{
     const {data:memberships,error:merr}=await sbAuth.from('table_memberships')
       .select('technical_table_id,technical_tables(name)').eq('profile_id',STATE.uid);
     if(merr)throw merr;
     (memberships||[]).forEach(x=>{if(x.technical_tables?.name)STATE.ids[x.technical_tables.name]=x.technical_table_id});
     const {data:tables,error:terr}=await sbAuth.from('technical_tables').select('id,name,description,is_active');
     if(terr)throw terr;
     if(['Administrador General'].includes(currentUser.rol)){
       (tables||[]).forEach(x=>STATE.ids[x.name]=x.id);
       mesas=(tables||[]).map(x=>x.name);
       saveMesas();
       (tables||[]).forEach(x=>setMesaMeta(x.name,{descripcion:x.description||'',estado:x.is_active?'Activa':'Inactiva'}));
     }
     await pullWorkspaces();
     const {data:self,error:selfErr}=await sbAuth.from('profiles')
       .select('full_name,profession,specialty,professional_experience,interests').eq('id',STATE.uid).maybeSingle();
     if(!selfErr&&self){
       localStorage.setItem('frentePT_perfil_'+currentUser.correo,JSON.stringify({
         nombre:self.full_name||'',profesion:self.profession||'',especialidad:self.specialty||'',
         experiencia:self.professional_experience||'',intereses:self.interests||''
       }));
     }
     STATE.ready=true;
     // Cualquier guardado pendiente sobrevive al cierre de la pestaña.
     for(const m of Object.keys(STATE.ids)){if(localStorage.getItem(pendingKey(m))==='1')queue(m)}
     await refreshSharedAdmin();
     return true;
   }catch(err){
     console.error('No fue posible conectar el espacio compartido:',err);
     label('⚠ Sin conexión al espacio compartido. No edite documentos hasta reintentar.',true);
     STATE.ready=false;return false;
   }finally{STATE.initializing=false}
 };
 window.showCloudControls=showCloudControls;
 const oldRender=window.renderEspacio;
 window.renderEspacio=function(c){const out=oldRender(c);if(isReal()){showCloudControls();label('Conectado. Los cambios se sincronizan automáticamente.')}return out};
 window.guardarPerfil=async function(){
   if(!isReal())return original.guardarPerfil();
   const x={full_name:document.getElementById('pfNombre').value.trim(),profession:document.getElementById('pfProf').value.trim(),
     specialty:document.getElementById('pfEsp').value.trim(),professional_experience:document.getElementById('pfExp').value.trim(),
     interests:document.getElementById('pfInteres').value.trim()};
   const message=document.getElementById('pfStatus');message.textContent='Guardando en la nube…';
   const {error}=await sbAuth.from('profiles').update(x).eq('id',STATE.uid);
   if(error){console.error(error);message.textContent='No fue posible guardar el perfil en la nube.';return}
   original.guardarPerfil();message.textContent='Perfil guardado en la nube ✓';
 };
 window.registrarContacto=async function(){
   const name=document.getElementById('ctNombre').value.trim(),email=document.getElementById('ctCorreo').value.trim(),
      institution=document.getElementById('ctInst').value.trim(),message=document.getElementById('ctMsg').value.trim(),
      label=document.getElementById('ctStatus');
   if(!name||!email.includes('@')||!message)return label.textContent='Complete nombre, correo y mensaje.';
   if(!sbAuth)return label.textContent='El servicio de mensajes no está disponible. Inténtelo más tarde.';
   label.textContent='Enviando…';
   const {error}=await sbAuth.from('contact_messages').insert({name,email,institution,message});
   if(error){console.error(error);label.textContent='El mensaje no se pudo registrar. Intente de nuevo.';return}
   label.textContent='Consulta recibida y registrada correctamente.';
   ['ctNombre','ctCorreo','ctInst','ctMsg'].forEach(id=>document.getElementById(id).value='');
 };
 window.guardarSolicitud=async function(){
   const p=getPublicaciones().find(x=>x.id===requestingPubId),name=document.getElementById('reqNombre').value.trim(),
     email=document.getElementById('reqCorreo').value.trim();
   if(!p||!name||!email.includes('@'))return alert('Complete nombre y correo válidos.');
   if(!sbAuth||!p.cloud)return alert('Este documento todavía no está publicado en la biblioteca compartida.');
   const {error}=await sbAuth.from('document_requests').insert({
     library_id:p.id,title:p.titulo,name,email,institution:document.getElementById('reqInst').value.trim(),
     reason:document.getElementById('reqMotivo').value.trim()});
   if(error){console.error(error);return alert('No se pudo registrar la solicitud. Inténtelo nuevamente.')}
   ['reqNombre','reqCorreo','reqInst','reqMotivo'].forEach(id=>document.getElementById(id).value='');
   cerrarSolicitud();alert('Su solicitud quedó registrada.');
 };
 window.loadPublicLibrary=async function(){
   if(!sbAuth)return;
   const {data,error}=await sbAuth.from('public_library')
     .select('id,technical_table_id,title,topic,description,snapshot,published_at').eq('is_public',true).order('published_at',{ascending:false});
   if(error){console.warn('No se pudo cargar la biblioteca compartida',error);return}
   const pubs=(data||[]).map(x=>({id:x.id,cloud:true,mesa:x.snapshot?.mesa||'',
       titulo:x.title,tema:x.topic,descripcion:x.description||'',fechaPublicacion:new Date(x.published_at).toLocaleDateString('es-CL'),
       ...x.snapshot}));
   // No mostrar publicaciones de prueba guardadas localmente como si fueran públicas.
   localStorage.setItem('frentePT_biblioteca_cloud',JSON.stringify(pubs));
   STATE.publicReady=true;
   if(document.getElementById('biblioteca')?.classList.contains('active'))renderBiblioteca();
 };
 window.solicitarPublicacion=async function(){
   if(!isReal())return original.solicitarPublicacion();
   if(!/Coordinador/.test(getRoleForMesa(currentDocMesa)))return alert('Solo la coordinación puede solicitar publicación.');
   const m=currentDocMesa,id=mesaId(m);if(!id)return alert('La Mesa no está disponible en la nube.');
   // Guardar la versión y la solicitud en el servidor antes de informar éxito.
   let d=syncWorkFromUI(true);d=saveVersionCore(false);d=getWork(m);
   await flush(m);
   if(localStorage.getItem(pendingKey(m))==='1')return alert('El documento quedó guardado localmente, pero todavía no se sincroniza. Vuelva a intentar cuando haya conexión.');
   const {data:row,error:we}=await sbAuth.from('workspace_documents').select('id').eq('technical_table_id',id).single();
   if(we)return alert('No se pudo confirmar el documento compartido.');
   const {error}=await sbAuth.from('publication_requests').insert({
     technical_table_id:id,workspace_id:row.id,requested_by:STATE.uid,title:d.titulo,
     version:d.versiones.at(-1)?.numero||1,snapshot:d,status:'Pendiente'});
   if(error){console.error(error);return alert('No se pudo registrar la solicitud en la nube. El documento sí quedó guardado.')}
   d.estado='Solicitud de publicación';setWork(m,d);await flush(m);
   alert('Solicitud enviada y registrada en la nube.');
   renderEspacio(document.getElementById('privatecontent'));
 };
 async function refreshSharedAdmin(){
   if(!isReal()||currentUser.rol!=='Administrador General')return;
   const results=await Promise.all([
     sbAuth.from('profiles').select('id,full_name,email,role,is_active'),
     sbAuth.from('table_memberships').select('profile_id,technical_table_id,member_role,is_coordinator'),
     sbAuth.from('publication_requests').select('*').order('requested_at',{ascending:false}),
     sbAuth.from('document_requests').select('*').order('created_at',{ascending:false}),
     sbAuth.from('contact_messages').select('*').order('created_at',{ascending:false})
   ]);
   if(results.some(x=>x.error)){console.warn('No se pudo actualizar todo el panel de Administración');return}
   const [profiles,members,requests,documents,contacts]=results.map(x=>x.data||[]);
   const arr=[];
   for(const p of profiles){
     if(['administrador_general','administrador_plataforma'].includes(p.role))arr.push({nombre:p.full_name,correo:p.email,rol:'Administrador General',mesa:'Administración',estado:p.is_active?'Activo':'Inactivo'});
     for(const x of members.filter(a=>a.profile_id===p.id)){
       const name=Object.keys(STATE.ids).find(m=>String(STATE.ids[m])===String(x.technical_table_id));
       if(name)arr.push({nombre:p.full_name,correo:p.email,rol:x.is_coordinator?'Coordinador/a de Mesa':x.member_role,
         mesa:name,estado:p.is_active?'Activo':'Inactivo'});
     }
   }
   STATE.adminData={integrantes:arr,requests:requests.map(x=>({id:x.id,mesa:Object.keys(STATE.ids).find(m=>String(STATE.ids[m])===String(x.technical_table_id))||'',
     titulo:x.title,fecha:new Date(x.requested_at).toLocaleString('es-CL'),version:x.version,contenido:x.snapshot?.contenido||{},
     referencias:x.snapshot?.referencias||[],solicitante:profiles.find(p=>p.id===x.requested_by)?.full_name||'Coordinación',
     correo:profiles.find(p=>p.id===x.requested_by)?.email||'',estado:x.status,cloud:true,snapshot:x.snapshot})),
   solicitudes:documents.map(x=>({id:x.id,titulo:x.title,nombre:x.name,correo:x.email,institucion:x.institution,
     fecha:new Date(x.created_at).toLocaleString('es-CL'),estado:x.status,cloud:true}))};
   STATE.contacts=contacts;
 }
 window.adminContactos=async function(){
   if(!isReal()||currentUser.rol!=='Administrador General'){
     document.getElementById('admincontent').innerHTML='<div class="notice">La bandeja de mensajes compartida requiere una cuenta administrativa real.</div>';
     return;
   }
   const {data,error}=await sbAuth.from('contact_messages').select('id,name,email,institution,message,status,created_at').order('created_at',{ascending:false});
   const b=document.getElementById('admincontent');
   if(error){console.error(error);b.textContent='No se pudo consultar la bandeja de mensajes.';return}
   b.innerHTML='<h1 class="section-title">Mensajes recibidos</h1>'+(data.length?data.map(x=>'<div class="card" style="margin:12px 0"><b>'+esc(x.name)+'</b> · '+esc(x.email)+'<br><small>'+esc(new Date(x.created_at).toLocaleString('es-CL'))+'</small><p>'+esc(x.message)+'</p><small>'+esc(x.institution||'')+' · '+esc(x.status)+'</small></div>').join(''):'<p class="notice">Todavía no se han registrado mensajes.</p>');
 };
 window.guardarIntegrante=async function(){
   if(!isReal())return original.guardarIntegrante();
   const name=document.getElementById('admNombre').value.trim(),email=document.getElementById('admCorreo').value.trim().toLowerCase(),
     m=document.getElementById('admMesa').value,rol=document.getElementById('admRol').value,
     status=document.getElementById('admInviteStatus');
   if(!name||!email.includes('@')||!mesaId(m))return status.textContent='Complete nombre, correo y Mesa.';
   const {data:p,error:pe}=await sbAuth.from('profiles').select('id').eq('email',email).maybeSingle();
   if(pe){console.error(pe);return status.textContent='No se pudo consultar la cuenta.'}
   if(!p)return status.textContent='El profesional debe registrarse y confirmar su correo antes de recibir una Mesa.';
   const {error}=await sbAuth.from('table_memberships').upsert({
      profile_id:p.id,technical_table_id:mesaId(m),member_role:rol,is_coordinator:/Coordinador/.test(rol)
   },{onConflict:'profile_id,technical_table_id'});
   if(error){console.error(error);return status.textContent='No se pudo guardar la asignación en la nube.'}
   await refreshSharedAdmin();status.textContent='Asignación registrada en la nube ✓';renderIntegrantes();
 };
 window.guardarMesaTecnica=async function(){
   if(!isReal())return original.guardarMesaTecnica();
   const m=document.getElementById('mesaNombre').value.trim(),orig=document.getElementById('mesaOriginal').value.trim(),
      desc=document.getElementById('mesaDescripcion').value.trim(),enabled=document.getElementById('mesaEstado').value==='Activa';
   if(!m)return alert('Escriba el nombre de la Mesa.');
   const req=orig?sbAuth.from('technical_tables').update({name:m,description:desc,is_active:enabled}).eq('id',mesaId(orig))
     :sbAuth.from('technical_tables').insert({name:m,description:desc,is_active:enabled});
   const {data,error}=await req.select('id,name').single();
   if(error){console.error(error);return alert('No se pudo guardar la Mesa en la nube.')}
   original.guardarMesaTecnica();
   if(orig)delete STATE.ids[orig];STATE.ids[m]=data.id;
 };
 window.publicarSolicitud=async function(id){
   if(!isReal())return original.publicarSolicitud(id);
   const x=getPubRequests().find(a=>a.id===id);if(!x)return;
   const tema=prompt('Tema para clasificar en Biblioteca:',x.mesa);if(tema===null)return;
   const description=prompt('Descripción pública:','Documento técnico autorizado por la Mesa.');if(description===null)return;
   const {error}=await sbAuth.from('public_library').insert({
     technical_table_id:mesaId(x.mesa),publication_request_id:id,title:x.titulo,topic:tema,
     description,snapshot:{mesa:x.mesa,titulo:x.titulo,contenido:x.snapshot?.contenido||x.contenido||{},
       referencias:x.snapshot?.referencias||x.referencias||[],version:x.version},is_public:true});
   if(error){console.error(error);return alert('No se pudo publicar el documento en la biblioteca compartida.')}
   const {error:e2}=await sbAuth.from('publication_requests').update({status:'Publicada',responded_at:new Date().toISOString()}).eq('id',id);
   if(e2){console.error(e2);return alert('El documento se publicó, pero la solicitud necesita revisión administrativa.')}
   await refreshSharedAdmin();await window.loadPublicLibrary();adminPublicaciones();alert('Documento publicado en Biblioteca.');
 };
 window.rechazarSolicitudPublicacion=async function(id){
   if(!isReal())return original.rechazarSolicitudPublicacion(id);
   const obs=prompt('Indique la observación para devolver el documento:');if(obs===null)return;
   const {error}=await sbAuth.from('publication_requests').update({status:'Devuelta',observation:obs,responded_at:new Date().toISOString()}).eq('id',id);
   if(error){console.error(error);return alert('No se pudo devolver la solicitud.')}
   await refreshSharedAdmin();adminPublicaciones();
 };
 window.signupProfesional=async function(){
   if(!sbAuth)return alert('Registro no disponible por el momento.');
   const name=document.getElementById('signupName').value.trim(),email=document.getElementById('signupEmail').value.trim().toLowerCase(),
      password=document.getElementById('signupPassword').value,status=document.getElementById('signupStatus');
   if(!name||!email.includes('@')||password.length<8){status.textContent='Complete nombre, correo y una contraseña de al menos 8 caracteres.';return}
   status.textContent='Registrando…';
   const {error}=await sbAuth.auth.signUp({email,password,options:{data:{full_name:name},emailRedirectTo:location.origin+location.pathname}});
   if(error){console.error(error);status.textContent='No fue posible completar el registro. Revise sus datos e intente nuevamente.';return}
   status.textContent='Revise su correo para confirmar la cuenta. Administración debe asignarle una Mesa antes de que pueda ingresar.';
 };
 // Bloqueo compartido: dos profesionales no pueden editar simultáneamente la misma sección.
 const baseAcquire=window.acquireLock,baseRelease=window.releaseMyLocks,baseReleaseSection=window.releaseSectionLock,
   baseLogout=window.logout;
 let acquiring=null;
 const ownedLocks=()=>STUDY_SECTION_NAMES.filter(name=>{
   const x=getLock(currentDocMesa,name);return x&&x.email===currentUser?.correo
 });
 async function sendRelease(m,name){
   if(!mesaId(m)||!STATE.uid)return;
   try{const {error}=await sbAuth.rpc('release_workspace_section',{
     p_technical_table_id:mesaId(m),p_section_name:name
   });if(error)console.warn('No se liberó el bloqueo remoto:',error)}catch(e){console.warn(e)}
 }
 async function flushThenRelease(m,names){
   if(!names.length)return;
   if(isReal()){
     clearTimeout(STATE.timers[m]);await flush(m);
     for(let i=0;i<8&&STATE.busy[m];i++)await new Promise(ok=>setTimeout(ok,300));
   }
   for(const name of names)await sendRelease(m,name);
 }
 window.releaseMyLocks=function(){
   if(!isReal())return baseRelease();
   const m=currentDocMesa,names=ownedLocks().filter(n=>n!==acquiring);
   baseRelease(); // libera el bloqueo visual local, conservando el bloqueo recién adquirido.
   if(names.length)void flushThenRelease(m,names);
 };
 window.acquireLock=async function(name){
   if(!isReal())return baseAcquire(name);
   if(!mesaId(currentDocMesa))return alert('Esta Mesa no está disponible en la nube.');
   const m=currentDocMesa;
   const old=getLock(m,name);
   if(old&&old.email!==currentUser.correo)return alert(old.nombre+' está editando esta sección.');
   const {data:ok,error}=await sbAuth.rpc('try_lock_workspace_section',{
     p_technical_table_id:mesaId(m),p_section_name:name});
   if(error){console.error(error);return alert('No se pudo obtener permiso de edición. Compruebe la conexión.')}
   if(!ok)return alert('Otro integrante está editando esta sección. Intente nuevamente más tarde.');
   acquiring=name;
   try{baseAcquire(name)}finally{acquiring=null}
 };
 window.releaseSectionLock=function(name){
   if(!isReal())return baseReleaseSection(name);
   const m=currentDocMesa;
   baseReleaseSection(name); // Guarda los cambios localmente y prepara su sincronización.
   void flushThenRelease(m,[name]);
 };
 async function refreshSharedLocks(){
   if(!isReal()||!document.getElementById('mifrente')?.classList.contains('active'))return;
   const m=currentDocMesa,id=mesaId(m);if(!id)return;
   const {data,error}=await sbAuth.from('workspace_locks').select('section_name,profile_id,locked_at')
     .eq('technical_table_id',id);
   if(error)return console.warn('No se pudo consultar el estado de los bloqueos:',error);
   const now=Date.now();
   for(const name of STUDY_SECTION_NAMES){
     const row=(data||[]).find(x=>x.section_name===name&&now-new Date(x.locked_at).getTime()<300000);
     const current=getLock(m,name);
     if(row&&row.profile_id!==STATE.uid){
       localStorage.setItem(lockKey(m,name),JSON.stringify({
         email:'cloud:'+row.profile_id,nombre:'Otro integrante',ts:new Date(row.locked_at).getTime()
       }));
     }else if(current?.email?.startsWith('cloud:'))localStorage.removeItem(lockKey(m,name));
   }
 }
 window.logout=async function(){
   if(!isReal())return baseLogout();
   const m=currentDocMesa,locks=ownedLocks();
   if(document.getElementById('wsTitulo'))syncWorkFromUI(true);
   clearTimeout(STATE.timers[m]);await flush(m);
   await flushThenRelease(m,locks);
   STATE.ready=false;STATE.ids={};STATE.snapshots={};STATE.adminData=null;
   sessionStorage.removeItem('frentePT_real_roles');
   return baseLogout();
 };
 // Actualizar otras secciones desde la nube sin sobrescribir lo que se está escribiendo.
 async function pollSharedChanges(){
   if(!isReal()||!Object.keys(STATE.ids).length)return;
   const {data,error}=await sbAuth.from('workspace_documents').select('technical_table_id,data,revision')
      .in('technical_table_id',Object.values(STATE.ids));
   if(error)return;
   for(const [m,id] of Object.entries(STATE.ids)){
     if(STATE.busy[m]||localStorage.getItem(pendingKey(m))==='1')continue;
     const remoteRow=(data||[]).find(x=>String(x.technical_table_id)===String(id));
     if(!remoteRow?.data)continue;
     const remote={...defaultWork(m),...remoteRow.data,contenido:migrateContenido(remoteRow.data.contenido||{})};
     if(same(remote,STATE.snapshots[m]))continue;
     const local=getWork(m),unsaved=diff(STATE.snapshots[m]||defaultWork(m),local);
     const merged={...remote,...(unsaved||{}),contenido:{...(remote.contenido||{}),...(unsaved.contenido||{})}};
     STATE.snapshots[m]=copy(remote);
     localStorage.setItem(snapshotKey(m),JSON.stringify(remote));
     original.setWork(m,merged);
     if(Object.keys(unsaved).length)queue(m);
     if(m===currentDocMesa&&document.getElementById('wsTitulo'))
       label('Hay cambios de otros integrantes. Abra de nuevo Mi Trabajo para verlos.');
   }
   await refreshSharedLocks();
 }
 setInterval(pollSharedChanges,25000);
 window.addEventListener('online',()=>{if(isReal())Object.keys(STATE.ids).forEach(m=>flush(m))});
 window.addEventListener('pagehide',()=>{if(isReal())Object.keys(STATE.ids).forEach(m=>{if(localStorage.getItem(pendingKey(m))==='1')flush(m)})});
 // Hacer que las solicitudes y los documentos públicos tengan el mismo origen en todos los dispositivos.
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>window.loadPublicLibrary());else window.loadPublicLibrary();
})();