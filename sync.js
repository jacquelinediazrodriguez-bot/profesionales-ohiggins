/* Sincronización segura de la plataforma — V2.
   El modo demostración continúa siendo LOCAL y nunca escribe en las mesas reales. */
(function(){
 'use strict';
 const STATE={ready:false,initializing:false,uid:null,ids:{},snapshots:{},timers:{},busy:{},retry:{},publicReady:false,adminData:null};
 const original={setWork:window.setWork,guardarPerfil:window.guardarPerfil,
  workKey:window.workKey,draftKey:window.draftKey,getIntegrantes:window.getIntegrantes,
  getPubRequests:window.getPubRequests,getSolicitudes:window.getSolicitudes,
  getPublicaciones:window.getPublicaciones,getAprobados:window.getAprobados,
  getRepresentantes:window.getRepresentantes,setRepresentantes:window.setRepresentantes,
  guardarRepresentante:window.guardarRepresentante,editarRepresentante:window.editarRepresentante,
  eliminarRepresentante:window.eliminarRepresentante,
  toggleMesaTecnica:window.toggleMesaTecnica,eliminarMesaTecnica:window.eliminarMesaTecnica,
  marcarEnviada:window.marcarEnviada,
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
 window.setWork=function(m,d){
   if(isReal()){
     const cloudState=STATE.snapshots[m]?.estado||'En elaboración';
     if(['Solicitud de publicación','Publicado','Retirado de publicación'].includes(cloudState)){
       label('Documento bloqueado para edición mientras está '+cloudState+'.',true);
       return;
     }
   }
   original.setWork(m,d);queue(m)
 };
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
     await loadSharedDirectory();
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
   const name=document.getElementById('ctNombre').value.trim(),
     email=document.getElementById('ctCorreo').value.trim(),
     institution=document.getElementById('ctInst').value.trim(),
     subject=document.getElementById('ctAsunto').value.trim(),
     message=document.getElementById('ctMsg').value.trim(),
     website=document.getElementById('ctWebsite')?.value||'',
     label=document.getElementById('ctStatus'),
     button=document.getElementById('ctSubmit');
   if(!name||!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)||!subject||!message){
     label.textContent='Complete nombre, correo válido, asunto y mensaje.';return;
   }
   if(!sbAuth){label.textContent='El servicio de mensajes no está disponible. Inténtelo más tarde.';return}
   button.disabled=true;label.textContent='Enviando mensaje…';
   try{
     const {data,error}=await sbAuth.functions.invoke('submit-contact',{body:{
       nombre:name,correo:email,institucion:institution,asunto:subject,mensaje:message,website
     }});
     if(error)throw error;
     if(!data?.ok)throw Error(data?.error||'No fue posible registrar la consulta.');
     label.textContent=data.email_sent
       ?'Gracias. Su mensaje fue recibido correctamente y Administración fue notificada por correo electrónico.'
       :'Gracias. Su mensaje quedó registrado correctamente. Administración podrá verlo en la plataforma.';
     ['ctNombre','ctCorreo','ctInst','ctAsunto','ctMsg','ctWebsite'].forEach(id=>{const el=document.getElementById(id);if(el)el.value=''});
   }catch(error){
     console.error(error);
     label.textContent='No fue posible enviar el mensaje. Inténtelo nuevamente.';
   }finally{button.disabled=false}
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
     .select('id,technical_table_id,title,topic,description,snapshot,published_at,origin_type,author_id,author_name,source_contribution_id')
     .eq('is_public',true).order('published_at',{ascending:false});
   if(error){console.warn('No se pudo cargar la biblioteca compartida',error);return}
   const pubs=(data||[]).map(x=>({
     id:x.id,cloud:true,
     origen:x.origin_type||'Documento de Mesa',
     autor:x.author_name||'',
     authorId:x.author_id||null,
     sourceContributionId:x.source_contribution_id||null,
     mesa:x.snapshot?.mesa||'',
     titulo:x.title,tema:x.topic,descripcion:x.description||'',
     fechaPublicacion:new Date(x.published_at).toLocaleDateString('es-CL'),
     anoPublicacion:new Date(x.published_at).getFullYear(),
     tipoDocumento:x.snapshot?.document_type||'',
     resumen:x.snapshot?.summary||'',
     cuerpo:x.snapshot?.body||'',
     version:x.snapshot?.version||1,
     ...x.snapshot
   }));
   localStorage.setItem('frentePT_biblioteca_cloud',JSON.stringify(pubs));
   STATE.publicReady=true;
   if(document.getElementById('biblioteca')?.classList.contains('active'))renderBiblioteca();
 };
 window.citarPublicacionEnMesa=function(id){
   if(!isReal())return alert('Ingrese con su cuenta para citar una publicación en un trabajo de Mesa.');
   const p=window.getPublicaciones().find(x=>x.id===id);if(!p)return alert('No se encontró la publicación.');
   const ass=getAssignedMesas();
   if(!ass.length)return alert('No tiene una Mesa asignada donde incorporar la referencia.');
   const disponibles=ass.filter(m=>normalizeEstado(getWork(m).estado)==='En elaboración');
   if(!disponibles.length)return alert('Sus documentos de Mesa no están disponibles para edición en este momento.');
   let mesa=disponibles[0];
   if(disponibles.length>1){
     const elegido=prompt('¿En qué Mesa desea citar esta publicación?\n\n'+disponibles.join('\n'),mesa);
     if(elegido===null)return;
     mesa=disponibles.find(m=>m.toLowerCase()===elegido.trim().toLowerCase());
     if(!mesa)return alert('Escriba uno de los nombres de Mesa mostrados.');
   }
   const d=getWork(mesa);
   if((d.referencias||[]).some(r=>String(r.source_library_id||'')===String(p.id)))
     return alert('Esta publicación ya está registrada en las Referencias de la Mesa '+mesa+'.');
   const autor=p.origen==='Aporte individual'
     ?(p.autor||'Autor individual')
     :('Mesa Técnica de '+(p.mesa||p.tema||''));
   const ano=String(p.anoPublicacion||new Date().getFullYear());
   const medio='Biblioteca de Profesionales y Técnicos de O’Higgins';
   const apa=autor+'. ('+ano+'). '+p.titulo+'. '+medio+'.';
   d.referencias=d.referencias||[];
   d.referencias.push({
     id:Date.now(),tipo:'Publicación de Biblioteca',autor,ano,titulo:p.titulo,
     medio,url:'',apa,source_library_id:p.id,origen:p.origen||'Documento de Mesa'
   });
   setWork(mesa,d);
   alert('Referencia incorporada en la Mesa '+mesa+'. El contenido original de la publicación no fue modificado.');
 };
 window.solicitarPublicacion=async function(){
   if(!isReal())return original.solicitarPublicacion();
   if(!/Coordinador/.test(getRoleForMesa(currentDocMesa)))return alert('Solo la coordinación puede solicitar publicación.');
   const m=currentDocMesa,id=mesaId(m);if(!id)return alert('La Mesa no está disponible en la nube.');
   let d=syncWorkFromUI(true);
   if(snapshotChanged(d))d=saveVersionCore(false);
   await flush(m);
   if(localStorage.getItem(pendingKey(m))==='1')return alert('El documento quedó guardado localmente, pero todavía no se sincroniza. Vuelva a intentar cuando haya conexión.');
   const {error}=await sbAuth.rpc('submit_publication_request',{p_technical_table_id:id});
   if(error){
     console.error(error);
     const msg=String(error.message||'');
     return alert(/already pending/i.test(msg)?'Ya existe una solicitud de publicación pendiente para este documento.':'No se pudo registrar la solicitud de publicación.');
   }
   const {data:row,error:re}=await sbAuth.from('workspace_documents').select('data').eq('technical_table_id',id).single();
   if(!re&&row?.data){
     const remote=copy({...defaultWork(m),...row.data,contenido:migrateContenido(row.data.contenido||{})});
     STATE.snapshots[m]=remote;original.setWork(m,remote);localStorage.setItem(snapshotKey(m),JSON.stringify(remote));
   }
   await refreshSharedAdmin();
   alert('Solicitud enviada. El documento quedó bloqueado mientras Administración revisa la versión enviada.');
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
 window.getAprobados=function(){
   if(!isReal())return original.getAprobados();
   const result=new Map();
   const assign=getAssignedMesas();
   for(const mesa of assign){
     const d=getWork(mesa);
     if(['Aprobado','Publicado'].includes(d.estado)){
       const id=1000000+(mesaId(mesa)||0);
       result.set(mesa+'|'+d.titulo,{id,mesa,titulo:d.titulo,fecha:d.ultima||'',
         version:d.versiones?.at(-1)?.numero||1,contenido:copy(d.contenido||{}),referencias:copy(d.referencias||[]),
         estado:'Aprobado'});
     }
   }
   for(const p of window.getPublicaciones()){
     if(!assign.includes(p.mesa))continue;
     result.set(p.mesa+'|'+p.titulo,{id:2000000+p.id,mesa:p.mesa,titulo:p.titulo,
       fecha:p.fechaPublicacion||'',version:p.version||1,contenido:copy(p.contenido||{}),
       referencias:copy(p.referencias||[]),estado:'Aprobado'});
   }
   return [...result.values()];
 };
 window.actualizarEstadoContacto=async function(id,status){
   if(!isReal()||currentUser.rol!=='Administrador General')return;
   const patch={status,updated_at:new Date().toISOString(),handled_by:STATE.uid};
   if(status==='Respondido')patch.responded_at=new Date().toISOString();
   if(status==='Cerrado')patch.closed_at=new Date().toISOString();
   const {error}=await sbAuth.from('contact_messages').update(patch).eq('id',id);
   if(error){console.error(error);return alert('No se pudo actualizar el mensaje.')}
   await window.adminContactos();
 };
 window.guardarNotaContacto=async function(id){
   if(!isReal()||currentUser.rol!=='Administrador General')return;
   const x=(STATE.contactRows||[]).find(a=>a.id===id);if(!x)return;
   const nota=prompt('Nota interna de Administración:',x.admin_note||'');if(nota===null)return;
   const {error}=await sbAuth.from('contact_messages').update({
     admin_note:nota.trim()||null,handled_by:STATE.uid,updated_at:new Date().toISOString()
   }).eq('id',id);
   if(error){console.error(error);return alert('No se pudo guardar la nota.')}
   await window.adminContactos();
 };
 window.adminContactos=async function(){
   const b=document.getElementById('admincontent');if(!b)return;
   if(!isReal()||currentUser.rol!=='Administrador General'){
     b.innerHTML='<div class="notice">La bandeja de mensajes compartida requiere una cuenta administrativa real.</div>';return;
   }
   const {data,error}=await sbAuth.from('contact_messages')
     .select('id,name,email,institution,subject,message,status,admin_note,handled_by,created_at,updated_at,responded_at,closed_at,email_notified_at')
     .order('created_at',{ascending:false});
   if(error){console.error(error);b.textContent='No se pudo consultar la bandeja de mensajes.';return}
   STATE.contactRows=data||[];
   const estados=['Todos','Nuevo','En revisión','Respondido','Cerrado'];
   const actual=STATE.contactFilter||'Todos';
   const visibles=actual==='Todos'?STATE.contactRows:STATE.contactRows.filter(x=>x.status===actual);
   const counts=Object.fromEntries(estados.slice(1).map(s=>[s,STATE.contactRows.filter(x=>x.status===s).length]));
   b.innerHTML='<div class="kicker">Atención de consultas</div><h1 class="section-title">Mensajes de contacto</h1>'+
     '<div class="notice">Los mensajes enviados desde la sección pública quedan registrados aquí. Administración recibe además una notificación por correo cuando llega un mensaje nuevo.</div>'+
     '<div class="toolbar-row" style="margin:14px 0">'+estados.map(s=>'<button class="btn '+(actual===s?'primary':'soft')+'" onclick="STATE.contactFilter=\''+s+'\';adminContactos()">'+s+(s==='Todos'?'':' ('+(counts[s]||0)+')')+'</button>').join('')+'</div>'+
     (visibles.length?visibles.map(x=>{
       const mailto='mailto:'+encodeURIComponent(x.email)+'?subject='+encodeURIComponent('Re: '+(x.subject||'Consulta – Plataforma Frente PT O’Higgins'));
       return '<div class="card" style="margin:12px 0"><div class="row"><div><span class="pill '+(x.status==='Nuevo'?'amber':x.status==='Cerrado'?'green':'')+'">'+esc(x.status)+'</span> <b>'+esc(x.subject||'Sin asunto')+'</b><br><small>'+esc(new Date(x.created_at).toLocaleString('es-CL'))+(x.email_notified_at?' · Aviso por correo enviado':' · Sin confirmación de aviso por correo')+'</small></div><div><select onchange="actualizarEstadoContacto('+x.id+',this.value)">'+['Nuevo','En revisión','Respondido','Cerrado'].map(s=>'<option '+(x.status===s?'selected':'')+'>'+s+'</option>').join('')+'</select></div></div>'+
       '<p><b>'+esc(x.name)+'</b> · <a href="'+mailto+'">'+esc(x.email)+'</a>'+(x.institution?' · '+esc(x.institution):'')+'</p><p>'+esc(x.message).replace(/\n/g,'<br>')+'</p>'+
       (x.admin_note?'<div class="mini-note"><b>Nota interna:</b> '+esc(x.admin_note)+'</div>':'')+
       '<div class="toolbar-row" style="margin-top:12px"><a class="btn primary" href="'+mailto+'">Responder por correo</a> <button class="btn soft" onclick="guardarNotaContacto('+x.id+')">Nota interna</button> '+(x.status!=='En revisión'&&x.status!=='Cerrado'?'<button class="btn soft" onclick="actualizarEstadoContacto('+x.id+',\'En revisión\')">Marcar en revisión</button>':'')+(x.status!=='Cerrado'?'<button class="btn soft" onclick="actualizarEstadoContacto('+x.id+',\'Cerrado\')">Cerrar</button>':'')+'</div></div>';
     }).join(''):'<div class="card"><p>No hay mensajes en este estado.</p></div>');
 };
 async function loadSharedDirectory(){
   if(!isReal())return;
   const {data,error}=await sbAuth.from('representatives_directory')
      .select('id,data,source_type').order('id',{ascending:true});
   if(error){console.warn('No se pudo consultar el directorio compartido:',error);return}
   const localOfficial=original.getRepresentantes().filter(x=>x.oficial===true);
   STATE.directory=[...localOfficial,...(data||[]).map(x=>({
     ...x.data,id:100000000+x.id,cloudId:x.id,cloud:true,fuente:x.source_type||'Administración'
   }))];
 }
 window.getRepresentantes=function(){
   return isReal()&&STATE.directory?STATE.directory:original.getRepresentantes()
 };
 window.setRepresentantes=function(a){
   if(isReal()){STATE.directory=a;return}
   original.setRepresentantes(a);
 };
 window.guardarRepresentante=async function(){
   if(!isReal())return original.guardarRepresentante();
   const g=id=>document.getElementById(id)?.value.trim()||'';
   const x={nombre:g('repAdmNombre'),cargo:g('repAdmCargo'),tipoInstitucion:g('repAdmTipoInstitucion'),
     institucion:g('repAdmInstitucion'),region:g('repAdmRegion'),territorio:g('repAdmTerritorio'),
     ambito:g('repAdmAmbito'),telefono:g('repAdmTelefono'),correo:g('repAdmCorreo'),url:g('repAdmUrl'),
     condicionDC:g('repAdmCondicionDC'),fuente:'Administración',oficial:false,
     partido:'Democracia Cristiana',verificadoDC:true,representacionDC:'Sí',
     actualizado:new Date().toLocaleDateString('es-CL')};
   if(!x.nombre||!x.cargo||!x.region||!x.institucion||!x.url)
     return alert('Complete nombre, cargo, institución, región y fuente de verificación.');
   const {data,error}=await sbAuth.from('representatives_directory').insert({
     data:x,source_type:'Administración',created_by:STATE.uid}).select('id').single();
   if(error){console.error(error);return alert('No se pudo guardar el registro en el directorio compartido.')}
   STATE.directory.push({...x,id:100000000+data.id,cloudId:data.id,cloud:true});
   adminRepresentantes();
 };
 window.editarRepresentante=async function(id){
   if(!isReal())return original.editarRepresentante(id);
   const x=STATE.directory?.find(r=>r.id===id);if(!x||repEsOficial(x))return;
   if(!x.cloudId)return alert('Esta ficha proviene del prototipo anterior. Vuelva a crearla como registro compartido.');
   const nombre=prompt('Nombre:',x.nombre);if(nombre===null)return;
   const cargo=prompt('Cargo:',x.cargo);if(cargo===null)return;
   const territorio=prompt('Territorio:',x.territorio||'');if(territorio===null)return;
   const edited={...x,nombre:nombre.trim()||x.nombre,cargo:cargo.trim()||x.cargo,
      territorio:territorio.trim(),actualizado:new Date().toLocaleDateString('es-CL')};
   const {id:displayId,cloudId,cloud,...data}=edited;
   const {error}=await sbAuth.from('representatives_directory').update({data}).eq('id',x.cloudId);
   if(error){console.error(error);return alert('No se pudo actualizar el registro compartido.')}
   Object.assign(x,edited);adminRepresentantes();
 };
 window.eliminarRepresentante=async function(id){
   if(!isReal())return original.eliminarRepresentante(id);
   const x=STATE.directory?.find(r=>r.id===id);if(!x||repEsOficial(x)||!x.cloudId)return;
   if(!confirm('¿Eliminar este registro compartido?'))return;
   const {error}=await sbAuth.from('representatives_directory').delete().eq('id',x.cloudId);
   if(error){console.error(error);return alert('No se pudo eliminar el registro compartido.')}
   STATE.directory=STATE.directory.filter(r=>r.id!==id);adminRepresentantes();
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
 window.toggleMesaTecnica=async function(m){
   if(!isReal())return original.toggleMesaTecnica(m);
   const active=getMesaMeta(m).estado==='Inactiva';
   const {error}=await sbAuth.from('technical_tables').update({is_active:active}).eq('id',mesaId(m));
   if(error){console.error(error);return alert('No se pudo modificar la Mesa en la nube.')}
   original.toggleMesaTecnica(m);
 };
 window.eliminarMesaTecnica=async function(m){
   if(!isReal())return original.eliminarMesaTecnica(m);
   if(getIntegrantes().some(x=>x.mesa===m&&x.rol!=='Administrador General'))
     return alert('Primero debe reasignar a los integrantes de esta Mesa.');
   if(!confirm('¿Eliminar esta Mesa Técnica en todos los dispositivos?'))return;
   const {error}=await sbAuth.from('technical_tables').delete().eq('id',mesaId(m));
   if(error){console.error(error);return alert('No se pudo eliminar. Compruebe si existen documentos o registros asociados.')}
   delete STATE.ids[m];mesas=mesas.filter(x=>x!==m);saveMesas();removeMesaMeta(m);adminMesas();
 };
 window.marcarEnviada=async function(id){
   if(!isReal())return original.marcarEnviada(id);
   const {error}=await sbAuth.from('document_requests').update({status:'Enviada',sent_at:new Date().toISOString()}).eq('id',id);
   if(error){console.error(error);return alert('No se pudo actualizar el estado en la nube.')}
   await refreshSharedAdmin();adminSolicitudes();
 };
 window.publicarSolicitud=async function(id){
   if(!isReal())return original.publicarSolicitud(id);
   const x=getPubRequests().find(a=>a.id===id);if(!x)return;
   const tema=prompt('Tema para clasificar en Biblioteca:',x.mesa);if(tema===null)return;
   const description=prompt('Descripción pública:','Documento técnico autorizado por la Mesa.');if(description===null)return;
   const {error}=await sbAuth.rpc('publish_publication_request',{
     p_request_id:id,p_topic:tema,p_description:description
   });
   if(error){console.error(error);return alert('No se pudo publicar. No se realizó ningún cambio parcial.')}
   await refreshSharedAdmin();await window.loadPublicLibrary();await window.adminPublicaciones();
   alert('Documento publicado en Biblioteca.');
 };
 window.rechazarSolicitudPublicacion=async function(id){
   if(!isReal())return original.rechazarSolicitudPublicacion(id);
   const obs=prompt('Indique la observación obligatoria para devolver el documento a la Mesa:');if(obs===null)return;
   if(!obs.trim())return alert('Debe registrar una observación para devolver el documento.');
   const {error}=await sbAuth.rpc('return_publication_request',{p_request_id:id,p_observation:obs.trim()});
   if(error){console.error(error);return alert('No se pudo devolver la solicitud.')}
   await refreshSharedAdmin();await window.adminPublicaciones();
   alert('Solicitud devuelta. El documento volvió a En elaboración y quedó habilitado para correcciones.');
 };
 window.retirarPublicacion=async function(id){
   if(!isReal()||currentUser.rol!=='Administrador General')return;
   const motivo=prompt('Indique el motivo del retiro de publicación:');if(motivo===null)return;
   if(!motivo.trim())return alert('Debe registrar el motivo del retiro.');
   const {error}=await sbAuth.rpc('withdraw_publication',{p_library_id:id,p_reason:motivo.trim()});
   if(error){console.error(error);return alert('No se pudo retirar el documento de la Biblioteca.')}
   await window.loadPublicLibrary();await refreshSharedAdmin();await window.adminPublicaciones();
   alert('Documento retirado de publicación. Se conserva todo su historial.');
 };
 window.reabrirDocumentoRetirado=async function(){
   if(!isReal())return;
   const m=currentDocMesa,id=mesaId(m);if(!id)return;
   const {error}=await sbAuth.rpc('reopen_withdrawn_document',{p_technical_table_id:id});
   if(error){console.error(error);return alert('No se pudo iniciar una nueva versión del documento.')}
   const {data:row,error:re}=await sbAuth.from('workspace_documents').select('data').eq('technical_table_id',id).single();
   if(!re&&row?.data){
     const remote=copy({...defaultWork(m),...row.data,contenido:migrateContenido(row.data.contenido||{})});
     STATE.snapshots[m]=remote;original.setWork(m,remote);localStorage.setItem(snapshotKey(m),JSON.stringify(remote));
   }
   renderEspacio(document.getElementById('privatecontent'));
   alert('Documento habilitado nuevamente en En elaboración. Puede comenzar una nueva versión.');
 };
 window.verSolicitudPublicacion=function(id){
   const x=getPubRequests().find(a=>a.id===id);if(!x)return;
   const s=x.snapshot||{},sections=s.contenido||{};
   const body=STUDY_SECTION_NAMES.map(n=>'<h3>'+esc(studyLabel(n))+'</h3><div>'+(sections[n]||'<p class="muted">Sin contenido.</p>')+'</div>').join('');
   const w=window.open('','_blank');
   if(!w)return alert('El navegador bloqueó la vista. Habilite ventanas emergentes para revisar el documento.');
   w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>'+esc(x.titulo)+'</title><style>body{font-family:Arial,sans-serif;max-width:900px;margin:40px auto;padding:0 24px;line-height:1.6}h1,h2,h3{color:#123b67}.meta{background:#f4f7fb;padding:14px;border-radius:10px}</style></head><body><h1>'+esc(x.titulo)+'</h1><div class="meta"><b>Mesa:</b> '+esc(x.mesa)+' · <b>Versión:</b> '+esc(x.version)+' · <b>Solicitado por:</b> '+esc(x.solicitante||'Coordinación')+'</div>'+body+'</body></html>');
   w.document.close();
 };

 async function cargarMisAportes(){
   if(!isReal())return [];
   const {data,error}=await sbAuth.from('individual_contributions')
     .select('id,title,document_type,topic,summary,body,status,version,versions,admin_observation,created_at,updated_at')
     .eq('author_id',STATE.uid).order('updated_at',{ascending:false});
   if(error){console.error(error);return []}
   STATE.contributions=data||[];return STATE.contributions;
 }
 window.renderAportes=async function(container){
   const c=container||document.getElementById('privatecontent');if(!c)return;
   if(!isReal()){c.innerHTML='<div class="notice">Ingrese con una cuenta real para gestionar sus aportes individuales.</div>';return}
   const rows=await cargarMisAportes();
   c.innerHTML='<div class="kicker">Producción individual</div><h1 class="section-title">Mis aportes</h1>'+
     '<div class="notice"><b>Espacio libre de elaboración.</b> Aquí puede escribir con formato propio, guardar versiones, recuperar una versión anterior, generar Word/PDF y solicitar publicación sin utilizar la estructura metodológica de las Mesas.</div><br>'+
     '<button class="btn primary" onclick="nuevoAporteIndividual()">＋ Crear nuevo aporte</button><div id="aporteEditor" style="margin-top:16px"></div>'+
     '<h2 class="section-sub">Mis documentos</h2>'+
     (rows.length?rows.map(x=>'<div class="row"><div><b>'+esc(x.title||'Sin título')+'</b><br><small>'+esc(x.document_type)+' · '+esc(x.topic)+' · Versión '+x.version+' · '+esc(x.status)+' · '+new Date(x.updated_at).toLocaleString('es-CL')+'</small>'+(x.admin_observation?'<p class="muted"><b>Observación de Administración:</b> '+esc(x.admin_observation)+'</p>':'')+'</div><div><button class="btn soft" onclick="editarAporteIndividual('+x.id+')">Abrir</button> '+(x.status==='Retirado de publicación'?'<button class="btn success" onclick="reabrirAporteIndividual('+x.id+')">Iniciar nueva versión</button>':'')+'</div></div>').join(''):'<div class="card"><p>Aún no ha creado aportes individuales.</p></div>');
 };
 window.nuevoAporteIndividual=async function(){
   if(!isReal())return;
   const {data,error}=await sbAuth.from('individual_contributions').insert({
     author_id:STATE.uid,title:'Nuevo aporte',document_type:'Análisis',topic:'Otros',summary:'',body:''
   }).select('id').single();
   if(error){console.error(error);return alert('No se pudo crear el aporte.')}
   STATE.editingContribution=data.id;
   await cargarMisAportes();await editarAporteIndividual(data.id);
 };
 function aporteActual(id){return (STATE.contributions||[]).find(a=>a.id===id)}
 function aporteEditorData(id){
   const x=aporteActual(id);if(!x)return null;
   const title=document.getElementById('aporteTitulo')?.value.trim()??x.title;
   const document_type=document.getElementById('aporteTipo')?.value||x.document_type;
   const topic=document.getElementById('aporteTema')?.value||x.topic;
   const summary=document.getElementById('aporteResumen')?.value.trim()??(x.summary||'');
   const ed=document.getElementById('aporteBodyEditor');
   const body=ed?safeRichHTML(ed.innerHTML):safeRichHTML(x.body||'');
   return {title,document_type,topic,summary,body};
 }
 function aporteFmt(cmd,value=null){
   const ed=document.getElementById('aporteBodyEditor');if(!ed)return;
   ed.focus();document.execCommand(cmd,false,value);
 }
 window.iniciarEdicionAporte=function(id){
   const x=aporteActual(id);if(!x||x.status!=='En elaboración')return;
   STATE.editingContribution=id;editarAporteIndividual(id);
 };
 window.finalizarEdicionAporte=async function(id){
   const ok=await guardarAporteIndividual(id,false,true);
   if(ok===false)return;
   STATE.editingContribution=null;
   await cargarMisAportes();await editarAporteIndividual(id);
 };
 function aporteHistorialHTML(x){
   const vs=Array.isArray(x.versions)?[...x.versions].reverse():[];
   if(!vs.length)return '<div class="muted">Aún no hay versiones guardadas.</div>';
   return vs.map(v=>'<div class="history-item"><div><b>Versión '+esc(v.numero)+'</b><br><small>'+new Date(v.fecha).toLocaleString('es-CL')+' · '+esc(v.document_type||x.document_type)+' · '+esc(v.topic||x.topic)+'</small></div>'+(x.status==='En elaboración'?'<button class="btn soft" onclick="recuperarVersionAporte('+x.id+','+Number(v.numero)+')">Recuperar</button>':'')+'</div>').join('');
 }
 window.editarAporteIndividual=async function(id){
   let x=aporteActual(id);
   if(!x){await cargarMisAportes();x=aporteActual(id);if(!x)return}
   const box=document.getElementById('aporteEditor');if(!box)return;
   const locked=['Solicitud de publicación','Publicado','Retirado de publicación'].includes(x.status);
   const editing=!locked&&STATE.editingContribution===id;
   const author=currentUser?.nombre||'Profesional';
   const toolbar=editing?'<div class="doc-toolbar" style="margin:10px 0"><button onclick="aporteFmt(\'bold\')"><b>B</b></button><button onclick="aporteFmt(\'italic\')"><i>I</i></button><button onclick="aporteFmt(\'underline\')"><u>U</u></button><button onclick="aporteFmt(\'formatBlock\',\'h2\')">Título</button><button onclick="aporteFmt(\'formatBlock\',\'p\')">Párrafo</button><button onclick="aporteFmt(\'insertUnorderedList\')">• Lista</button><button onclick="aporteFmt(\'insertOrderedList\')">1. Lista</button><button onclick="aporteFmt(\'justifyLeft\')">≡ Izq.</button><button onclick="aporteFmt(\'justifyCenter\')">≡ Centro</button><button onclick="aporteFmt(\'justifyRight\')">≡ Der.</button><button onclick="aporteFmt(\'undo\')">↶</button><button onclick="aporteFmt(\'redo\')">↷</button></div>':'';
   box.innerHTML='<div class="card"><div class="kicker">Aporte individual</div><h2>'+esc(x.title||'Nuevo aporte')+'</h2>'+
     '<div class="mini-note"><b>Autor:</b> '+esc(author)+' · <b>Estado:</b> '+esc(x.status)+' · <b>Versión vigente:</b> '+x.version+'</div><br>'+
     '<div class="form-row"><div><label>Título</label><input id="aporteTitulo" value="'+esc(x.title||'')+'" '+(editing?'':'disabled')+'></div>'+
     '<div><label>Tipo de documento</label><select id="aporteTipo" '+(editing?'':'disabled')+'>'+
       ['Estudio','Informe','Análisis','Artículo','Propuesta','Minuta','Otro'].map(t=>'<option '+(x.document_type===t?'selected':'')+'>'+t+'</option>').join('')+'</select></div>'+
     '<div><label>Temática</label><select id="aporteTema" '+(editing?'':'disabled')+'>'+
       ['Salud','Educación','Economía','Trabajo','Agricultura','Desarrollo Regional','Otros'].map(t=>'<option '+(x.topic===t?'selected':'')+'>'+t+'</option>').join('')+'</select></div></div>'+
     '<label>Resumen breve</label><textarea id="aporteResumen" rows="3" '+(editing?'':'disabled')+'>'+esc(x.summary||'')+'</textarea>'+
     '<label>Contenido</label>'+toolbar+
     '<div id="aporteBodyEditor" '+(editing?'contenteditable="true"':'')+' style="min-height:320px;border:1px solid #ccd4df;border-radius:10px;padding:16px;background:'+(editing?'#fff':'#f8fafc')+';line-height:1.7;overflow:auto">'+safeRichHTML(x.body||'')+'</div>'+
     (x.admin_observation?'<div class="notice" style="margin-top:12px"><b>Observación de Administración:</b> '+esc(x.admin_observation)+'</div>':'')+
     '<div class="toolbar-row" style="margin-top:14px">'+
       (editing?'<button class="btn primary" onclick="finalizarEdicionAporte('+x.id+')">Finalizar edición</button> <button class="btn soft" onclick="guardarAporteIndividual('+x.id+',false)">Guardar borrador</button> <button class="btn success" onclick="guardarAporteIndividual('+x.id+',true)">Guardar versión</button>':'')+
       (!locked&&!editing?'<button class="btn primary" onclick="iniciarEdicionAporte('+x.id+')">Editar</button> <button class="btn success" onclick="solicitarPublicacionAporte('+x.id+')">Solicitar publicación</button>':'')+
       '<button class="btn soft" onclick="vistaPreviaAporte('+x.id+')">Vista del documento</button> <button class="btn soft" onclick="exportarAporteWord('+x.id+')">Exportar Word</button> <button class="btn soft" onclick="exportarAportePDF('+x.id+')">Exportar PDF</button>'+
     '</div>'+
     '<h3 style="margin-top:18px">Historial de versiones</h3>'+aporteHistorialHTML(x)+
     '</div>';
   box.scrollIntoView({behavior:'smooth',block:'start'});
 };
 window.guardarAporteIndividual=async function(id,versionar,quiet=false){
   const x=aporteActual(id);if(!x)return false;
   if(x.status!=='En elaboración')return alert('Este aporte está bloqueado para edición en su estado actual.'),false;
   const d=aporteEditorData(id);if(!d)return false;
   if(!d.title)return alert('Ingrese un título.'),false;
   let version=x.version||1,versions=Array.isArray(x.versions)?[...x.versions]:[];
   if(versionar){
     const n=versions.length?Math.max(...versions.map(v=>Number(v.numero)||0))+1:1;
     version=n;
     versions.push({numero:n,fecha:new Date().toISOString(),...d});
   }
   const {error}=await sbAuth.from('individual_contributions').update({
     ...d,version,versions,updated_at:new Date().toISOString()
   }).eq('id',id);
   if(error){console.error(error);alert('No se pudo guardar el aporte.');return false}
   await cargarMisAportes();
   if(!quiet){
     await editarAporteIndividual(id);
     alert(versionar?'Versión '+version+' guardada.':'Borrador guardado.');
   }
   return true;
 };
 window.recuperarVersionAporte=async function(id,n){
   const x=aporteActual(id);if(!x||x.status!=='En elaboración')return;
   const v=(x.versions||[]).find(a=>Number(a.numero)===Number(n));if(!v)return;
   if(!confirm('¿Recuperar la versión '+n+' como borrador actual? El historial de versiones se conservará.'))return;
   const {error}=await sbAuth.from('individual_contributions').update({
     title:v.title||x.title,document_type:v.document_type||x.document_type,topic:v.topic||x.topic,
     summary:v.summary||'',body:v.body||'',updated_at:new Date().toISOString()
   }).eq('id',id);
   if(error){console.error(error);return alert('No se pudo recuperar la versión.')}
   STATE.editingContribution=null;
   await cargarMisAportes();await editarAporteIndividual(id);
   alert('Versión '+n+' recuperada como borrador. Guarde una nueva versión cuando termine de revisarla.');
 };
 function datosAporteExportacion(id){
   const x=aporteActual(id);if(!x)return null;
   const live=STATE.editingContribution===id?aporteEditorData(id):null;
   const d=live||{title:x.title,document_type:x.document_type,topic:x.topic,summary:x.summary||'',body:safeRichHTML(x.body||'')};
   return {...d,author:currentUser?.nombre||'',version:x.version||1,status:x.status};
 }
 function htmlAporteExportacion(x){
   return '<div style="font-family:Arial,sans-serif;color:#172536;padding:28px;max-width:820px;margin:auto"><div style="border-bottom:2px solid #123b67;padding-bottom:12px;margin-bottom:22px"><div style="font-size:13px;color:#1e5d91;font-weight:bold">Frente de Profesionales y Técnicos · Región de O’Higgins</div><div style="font-size:12px;margin-top:5px">APORTE INDIVIDUAL</div><h1 style="color:#123b67;margin:8px 0">'+esc(x.title)+'</h1><div style="font-size:13px;color:#657487">Autor: '+esc(x.author)+' · '+esc(x.document_type)+' · '+esc(x.topic)+' · Versión '+esc(String(x.version))+' · Estado: '+esc(x.status)+'</div></div>'+(x.summary?'<h2 style="color:#123b67">Resumen</h2><p>'+esc(x.summary)+'</p>':'')+'<div style="line-height:1.7">'+safeRichHTML(x.body||'')+'</div><div style="margin-top:24px;font-size:12px;color:#657487;border-top:1px solid #d7dde5;padding-top:12px">Aporte individual de su autor. No representa necesariamente una posición institucional o de una Mesa Técnica.</div></div>';
 }
 window.vistaPreviaAporte=function(id){
   const x=datosAporteExportacion(id),box=document.getElementById('aporteEditor');if(!x||!box)return;
   const prev=document.createElement('div');prev.className='preview-wrap';prev.style.marginTop='18px';prev.innerHTML=htmlAporteExportacion(x);
   box.querySelectorAll('.aporte-preview-temp').forEach(n=>n.remove());prev.classList.add('aporte-preview-temp');box.appendChild(prev);prev.scrollIntoView({behavior:'smooth'});
 };
 window.exportarAportePDF=async function(id){
   const x=datosAporteExportacion(id);if(!x)return;
   if(typeof html2pdf==='undefined')return alert('No fue posible cargar el generador PDF.');
   const wrap=document.createElement('div');wrap.innerHTML=htmlAporteExportacion(x);document.body.appendChild(wrap);
   const nombre=limpiarNombreArchivo(x.title)+'_APORTE_INDIVIDUAL.pdf';
   try{await html2pdf().set({margin:[10,12,12,12],filename:nombre,image:{type:'jpeg',quality:.98},html2canvas:{scale:2,useCORS:true},jsPDF:{unit:'mm',format:'a4',orientation:'portrait'},pagebreak:{mode:['css','legacy']}}).from(wrap).save()}finally{wrap.remove()}
 };
 window.exportarAporteWord=async function(id){
   const x=datosAporteExportacion(id);if(!x)return;
   if(typeof docx==='undefined')return alert('No fue posible cargar el generador Word.');
   const {Document,Packer,Paragraph,TextRun,HeadingLevel,AlignmentType}=docx,children=[];
   children.push(new Paragraph({children:[new TextRun({text:'Frente de Profesionales y Técnicos · Región de O’Higgins',bold:true,color:'123B67'})],alignment:AlignmentType.CENTER}));
   children.push(new Paragraph({children:[new TextRun({text:'APORTE INDIVIDUAL',bold:true})],alignment:AlignmentType.CENTER}));
   children.push(new Paragraph({text:x.title||'Aporte individual',heading:HeadingLevel.TITLE,alignment:AlignmentType.CENTER}));
   children.push(new Paragraph({children:[new TextRun({text:'Autor: '+x.author+' · '+x.document_type+' · '+x.topic+' · Versión '+x.version+' · Estado: '+x.status,italics:true})],alignment:AlignmentType.CENTER}));
   if(x.summary){children.push(new Paragraph({text:'Resumen',heading:HeadingLevel.HEADING_1}));children.push(new Paragraph(x.summary))}
   children.push(...htmlAParrafosDocx(safeRichHTML(x.body||'')||'<p>Sin contenido.</p>'));
   children.push(new Paragraph({children:[new TextRun({text:'Aporte individual de su autor. No representa necesariamente una posición institucional o de una Mesa Técnica.',italics:true})]}));
   const d=new Document({sections:[{properties:{},children}]});const blob=await Packer.toBlob(d);
   const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=limpiarNombreArchivo(x.title)+'_APORTE_INDIVIDUAL.docx';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000);
 };
 window.solicitarPublicacionAporte=async function(id){
   const x=aporteActual(id);if(!x)return;
   if(x.status!=='En elaboración')return alert('Este aporte no está disponible para una nueva solicitud.');
   if(STATE.editingContribution===id)return alert('Finalice la edición antes de solicitar publicación.');
   if(!String(x.title||'').trim()||!String(x.body||'').replace(/<[^>]*>/g,'').trim())return alert('El aporte debe tener título y contenido antes de enviarlo.');
   if(!(x.versions||[]).length){
     STATE.editingContribution=id;await editarAporteIndividual(id);
     const ok=await guardarAporteIndividual(id,true,true);
     STATE.editingContribution=null;
     if(ok===false)return;
   }
   const {error}=await sbAuth.rpc('submit_individual_contribution',{p_contribution_id:id});
   if(error){console.error(error);return alert(/already pending/i.test(String(error.message||''))?'Ya existe una solicitud pendiente.':'No se pudo enviar la solicitud.')}
   await renderAportes(document.getElementById('privatecontent'));
   alert('Solicitud enviada a Administración. La versión enviada quedó bloqueada mientras se revisa.');
 };
 window.reabrirAporteIndividual=async function(id){
   const {error}=await sbAuth.rpc('reopen_individual_contribution',{p_contribution_id:id});
   if(error){console.error(error);return alert('No se pudo iniciar una nueva versión.')}
   STATE.editingContribution=null;
   await renderAportes(document.getElementById('privatecontent'));
   alert('El aporte volvió a En elaboración para preparar una nueva versión.');
 };
 window.verSolicitudAporteIndividual=function(id,rows){
   const list=rows||STATE.individualRequests||[];
   const x=list.find(a=>a.id===id);if(!x)return;
   const s=x.snapshot||{},w=window.open('','_blank');if(!w)return alert('El navegador bloqueó la vista.');
   w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>'+esc(x.title)+'</title><style>body{font-family:Arial,sans-serif;max-width:900px;margin:40px auto;padding:0 24px;line-height:1.7}.meta{background:#f4f7fb;padding:14px;border-radius:10px}h1,h2,h3{color:#123b67}</style></head><body><h1>'+esc(x.title)+'</h1><div class="meta"><b>Aporte individual</b> · '+esc(s.document_type||'')+' · '+esc(s.topic||'')+' · Versión '+esc(x.version)+'</div>'+(s.summary?'<p><b>Resumen:</b> '+esc(s.summary)+'</p>':'')+'<hr><div>'+safeRichHTML(s.body||'')+'</div></body></html>');
   w.document.close();
 };
 window.publicarAporteIndividual=async function(id){
   const description=prompt('Descripción pública del aporte:','Aporte individual de un profesional de la plataforma.');if(description===null)return;
   const {error}=await sbAuth.rpc('publish_individual_request',{p_request_id:id,p_description:description});
   if(error){console.error(error);return alert('No se pudo publicar el aporte.')}
   await window.loadPublicLibrary();await window.adminPublicaciones();alert('Aporte individual publicado en Biblioteca.');
 };
 window.devolverAporteIndividual=async function(id){
   const obs=prompt('Indique la observación obligatoria para devolver el aporte:');if(obs===null)return;
   if(!obs.trim())return alert('Debe registrar una observación.');
   const {error}=await sbAuth.rpc('return_individual_request',{p_request_id:id,p_observation:obs.trim()});
   if(error){console.error(error);return alert('No se pudo devolver el aporte.')}
   await window.adminPublicaciones();alert('Aporte devuelto a su autor para correcciones.');
 };
 window.adminPublicaciones=async function(){
   const c=document.getElementById('admincontent');if(!c)return;
   if(!isReal()||currentUser.rol!=='Administrador General'){c.innerHTML='<div class="notice">Esta sección requiere Administración General.</div>';return}
   await refreshSharedAdmin();
   const [ir,profiles,libs]=await Promise.all([
     sbAuth.from('individual_publication_requests').select('*').order('requested_at',{ascending:false}),
     sbAuth.from('profiles').select('id,full_name,email'),
     sbAuth.from('public_library').select('id,title,topic,published_at,is_public,withdrawn_at,withdrawal_reason,publication_request_id,technical_table_id,origin_type,author_name,source_contribution_id').order('published_at',{ascending:false})
   ]);
   if(ir.error||profiles.error||libs.error){console.error(ir.error||profiles.error||libs.error);c.textContent='No se pudo consultar el flujo de publicaciones.';return}
   STATE.individualRequests=ir.data||[];
   const people=profiles.data||[];
   const reqs=getPubRequests().filter(x=>x.estado==='Pendiente');
   const individualPending=(ir.data||[]).filter(x=>x.status==='Pendiente');
   c.innerHTML='<div class="kicker">Difusión pública</div><h1 class="section-title">Solicitudes de publicación</h1>'+
     '<div class="notice">La plataforma distingue entre <b>Documentos de Mesa Técnica</b> y <b>Aportes individuales</b>. Administración revisa la versión exacta enviada antes de publicarla o devolverla.</div>'+
     '<h2 class="section-sub">Documentos de Mesa pendientes</h2>'+
     (reqs.length?reqs.map(x=>'<div class="row"><div><span class="pill green">Documento de Mesa</span> <b>'+esc(x.titulo)+'</b><br><small>Mesa '+esc(x.mesa)+' · Versión '+esc(x.version)+' · '+esc(x.solicitante||'Coordinación')+' · '+esc(x.fecha)+'</small></div><div><button class="btn soft" onclick="verSolicitudPublicacion('+x.id+')">Ver documento</button> <button class="btn primary" onclick="publicarSolicitud('+x.id+')">Publicar</button> <button class="btn soft" onclick="rechazarSolicitudPublicacion('+x.id+')">Devolver</button></div></div>').join(''):'<div class="card"><p>No hay documentos de Mesa pendientes.</p></div>')+
     '<h2 class="section-sub">Aportes individuales pendientes</h2>'+
     (individualPending.length?individualPending.map(x=>{const a=people.find(p=>p.id===x.requested_by);return '<div class="row"><div><span class="pill amber">Aporte individual</span> <b>'+esc(x.title)+'</b><br><small>Autor: '+esc(a?.full_name||'Profesional')+' · '+esc(x.snapshot?.document_type||'')+' · '+esc(x.snapshot?.topic||'')+' · Versión '+x.version+' · '+new Date(x.requested_at).toLocaleString('es-CL')+'</small></div><div><button class="btn soft" onclick="verSolicitudAporteIndividual('+x.id+')">Ver aporte</button> <button class="btn primary" onclick="publicarAporteIndividual('+x.id+')">Publicar</button> <button class="btn soft" onclick="devolverAporteIndividual('+x.id+')">Devolver</button></div></div>'}).join(''):'<div class="card"><p>No hay aportes individuales pendientes.</p></div>')+
     '<h2 class="section-sub">Historial de Biblioteca</h2>'+
     ((libs.data||[]).length?(libs.data||[]).map(p=>'<div class="row"><div><span class="pill '+(p.origin_type==='Aporte individual'?'amber':'green')+'">'+esc(p.origin_type||'Documento de Mesa')+'</span> <b>'+esc(p.title)+'</b><br><small>'+esc(p.topic)+' · '+(p.author_name?'Autor: '+esc(p.author_name)+' · ':'')+new Date(p.published_at).toLocaleDateString('es-CL')+(p.withdrawn_at?' · Retirado '+new Date(p.withdrawn_at).toLocaleDateString('es-CL'):'')+(p.withdrawal_reason?' · '+esc(p.withdrawal_reason):'')+'</small></div><div><span class="pill '+(p.is_public?'green':'amber')+'">'+(p.is_public?'PUBLICADO':'RETIRADO DE PUBLICACIÓN')+'</span> '+(p.is_public?'<button class="btn danger" onclick="retirarPublicacion('+p.id+')">Retirar de publicación</button>':'')+'</div></div>').join(''):'<div class="card"><p>Aún no hay documentos en el historial de Biblioteca.</p></div>');
 };
 window.signupProfesional=async function(){
   const el=id=>document.getElementById(id),status=el('signupStatus');
   const name=el('signupName').value.trim(),email=el('signupEmail').value.trim().toLowerCase(),password=el('signupPassword').value,button=el('signupSubmit');
   status.setAttribute('role','status');status.style.color='#a3352a';
   if(!name||!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)||password.length<8){
     status.textContent='Complete nombre, correo válido y una contraseña de al menos 8 caracteres.';return;
   }
   if(['coordinador@demo.cl','admin@demo.cl'].includes(email)){
     status.textContent='Las direcciones de demostración no admiten cuentas reales.';return;
   }
   if(!sbAuth){status.textContent='El servicio de registro no está disponible. Recargue la página y vuelva a intentar.';return;}
   if(button)button.disabled=true;status.style.color='#405064';status.textContent='Creando la cuenta. Espere unos segundos…';
   try{
     const {data,error}=await sbAuth.auth.signUp({email,password,options:{data:{full_name:name},emailRedirectTo:location.origin+location.pathname}});
     if(error)throw error;
     if(!data?.user)throw Error('El servicio no confirmó la creación de la cuenta.');
     status.style.color='#2e7d62';
     status.textContent=data.session?'Cuenta creada. Ya puede ingresar con su correo y contraseña. Administración debe habilitar las funciones correspondientes.':'Cuenta registrada. Revise su correo (también Spam) y confirme el enlace. Después ingrese aquí con su correo y contraseña.';
     el('signupPassword').value='';
   }catch(error){
     console.error('Error de registro:',error);
     const msg=String(error?.message||'');
     status.style.color='#a3352a';
     status.textContent=/already registered|already exists|already been registered/i.test(msg)?'Este correo ya está registrado. Use «¿Olvidó su contraseña?» en el acceso.':/rate limit|too many/i.test(msg)?'Se alcanzó el límite temporal de envíos. Espere unos minutos antes de volver a intentarlo.':/invalid email/i.test(msg)?'El correo electrónico no es válido. Revíselo.':/password/i.test(msg)?'La contraseña no cumple los requisitos del servicio. Use al menos 8 caracteres y pruebe otra.':'No se completó el registro: '+(msg||'revise la conexión y vuelva a intentar.');
   }finally{if(button)button.disabled=false;}
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
 // Renovar el bloqueo durante una sesión larga de edición.
 async function renewMyLocks(){
   if(!isReal()||!document.getElementById('mifrente')?.classList.contains('active'))return;
   const m=currentDocMesa,id=mesaId(m);if(!id)return;
   for(const name of ownedLocks()){
     const {data:ok,error}=await sbAuth.rpc('try_lock_workspace_section',{
       p_technical_table_id:id,p_section_name:name
     });
     if(error||!ok){
       const ed=document.getElementById(sectionEditorId(name));
       if(ed)ed.setAttribute('contenteditable','false');
       localStorage.removeItem(lockKey(m,name));
       alert('Se perdió el permiso de edición de '+name+'. Su borrador local se conserva; vuelva a solicitar acceso antes de continuar.');
     }else{
       localStorage.setItem(lockKey(m,name),JSON.stringify({
         email:currentUser.correo,nombre:currentUser.nombre,ts:Date.now()
       }));
     }
   }
 }
 setInterval(pollSharedChanges,25000);
 setInterval(renewMyLocks,60000);
 window.addEventListener('online',()=>{if(isReal())Object.keys(STATE.ids).forEach(m=>flush(m))});
 window.addEventListener('pagehide',()=>{if(isReal())Object.keys(STATE.ids).forEach(m=>{if(localStorage.getItem(pendingKey(m))==='1')flush(m)})});
 // Hacer que las solicitudes y los documentos públicos tengan el mismo origen en todos los dispositivos.
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>window.loadPublicLibrary());else window.loadPublicLibrary();
})();