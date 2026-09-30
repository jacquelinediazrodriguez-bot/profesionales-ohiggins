/* Sincronización segura de la plataforma — V2.
   El modo demostración continúa siendo LOCAL y nunca escribe en las mesas reales. */
(function(){
 'use strict';
 const STATE={ready:false,initializing:false,uid:null,ids:{},snapshots:{},timers:{},busy:{},retry:{},publicReady:false,adminData:null};
 let libraryRequestSubmitting=false;
 const original={setWork:window.setWork,guardarPerfil:window.guardarPerfil,
  workKey:window.workKey,draftKey:window.draftKey,getIntegrantes:window.getIntegrantes,
  getPubRequests:window.getPubRequests,getSolicitudes:window.getSolicitudes,
  getPublicaciones:window.getPublicaciones,getAprobados:window.getAprobados,
  getRepresentantes:window.getRepresentantes,setRepresentantes:window.setRepresentantes,
  guardarRepresentante:window.guardarRepresentante,editarRepresentante:window.editarRepresentante,
  eliminarRepresentante:window.eliminarRepresentante,
  toggleMesaTecnica:window.toggleMesaTecnica,eliminarMesaTecnica:window.eliminarMesaTecnica,
  marcarEnviada:window.marcarEnviada,
  registrarContacto:window.registrarContacto,guardarSolicitud:window.guardarSolicitud,adminSolicitudes:window.adminSolicitudes,
  renderAprobados:window.renderAprobados,
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
 window.getPublicaciones=function(){
   if(STATE.publicReady){
     if(Array.isArray(STATE.publications))return STATE.publications;
     try{
       const cloud=JSON.parse(localStorage.getItem('frentePT_biblioteca_cloud')||'[]');
       if(Array.isArray(cloud))return cloud;
     }catch(e){}
   }
   return original.getPublicaciones();
 };
 const snapshotKey=m=>'frentePT_lastCloud_'+STATE.uid+'_'+m;
 const pendingKey=m=>'frentePT_syncPending_'+STATE.uid+'_'+m;
 const COLLECTION_KEYS=['referencias','tareas','comentarios','revisiones'];
 function diff(before,now){
   const patch={},a=before||{},b=now||{};
   const ac=a.contenido||{},bc=b.contenido||{},sectionPatch={};
   Object.keys(bc).forEach(k=>{if(!same(ac[k],bc[k]))sectionPatch[k]=bc[k]});
   if(Object.keys(sectionPatch).length)patch.contenido=sectionPatch;
   ['titulo','referencias','tareas','comentarios','revisiones','ultima'].forEach(k=>{
     if(!same(a[k],b[k])&&b[k]!==undefined)patch[k]=b[k]
   });
   return patch;
 }
 function collectionItemKey(collection,item){
   if(collection==='revisiones')return String(item?.correo||item?.id||'').toLowerCase();
   return String(item?.id??'');
 }
 function changedFields(oldItem,newItem){
   const out={};
   Object.keys(newItem||{}).forEach(k=>{if(!same(oldItem?.[k],newItem?.[k]))out[k]=newItem[k]});
   if(newItem?.id!==undefined)out.id=newItem.id;
   return out;
 }
 function buildCollectionOps(before,now){
   const ops=[],a=before||{},b=now||{};
   for(const collection of COLLECTION_KEYS){
     const oldArr=Array.isArray(a[collection])?a[collection]:[];
     const newArr=Array.isArray(b[collection])?b[collection]:[];
     const oldMap=new Map(oldArr.map(x=>[collectionItemKey(collection,x),x]).filter(([k])=>k));
     const newMap=new Map(newArr.map(x=>[collectionItemKey(collection,x),x]).filter(([k])=>k));
     for(const [key,item] of newMap){
       const oldItem=oldMap.get(key);
       if(!oldItem){
         ops.push({collection,action:'upsert',item:copy(item),item_id:String(item.id??key)});
       }else if(!same(oldItem,item)){
         const delta=collection==='revisiones'?copy(item):changedFields(oldItem,item);
         ops.push({collection,action:'upsert',item:delta,item_id:String(item.id??key)});
       }
     }
     if(collection!=='revisiones'){
       for(const [key,item] of oldMap){
         if(!newMap.has(key))ops.push({collection,action:'delete',item:null,item_id:String(item.id??key)});
       }
     }
   }
   return ops;
 }
 function mergeCollectionChanges(base,local,remote,collection){
   const baseArr=Array.isArray(base?.[collection])?base[collection]:[];
   const localArr=Array.isArray(local?.[collection])?local[collection]:[];
   const remoteArr=Array.isArray(remote?.[collection])?copy(remote[collection]):[];
   const baseMap=new Map(baseArr.map(x=>[collectionItemKey(collection,x),x]).filter(([k])=>k));
   const localMap=new Map(localArr.map(x=>[collectionItemKey(collection,x),x]).filter(([k])=>k));
   const remoteMap=new Map(remoteArr.map(x=>[collectionItemKey(collection,x),x]).filter(([k])=>k));
   for(const [key,item] of localMap){
     const old=baseMap.get(key);
     if(!old||!same(old,item))remoteMap.set(key,copy(item));
   }
   if(collection!=='revisiones'){
     for(const [key] of baseMap){if(!localMap.has(key))remoteMap.delete(key)}
   }
   return [...remoteMap.values()];
 }
 function queue(m){
   if(!isReal()||!mesaId(m)||STATE.submittingPublication)return;
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
     const collectionOps=buildCollectionOps(saved,local);
     COLLECTION_KEYS.forEach(k=>delete patch[k]);
     if(!Object.keys(patch).length&&!collectionOps.length){
       localStorage.removeItem(pendingKey(m));label('Guardado en la nube ✓');return;
     }
     label('Guardando en la nube…');
     let confirmed=copy(saved);
     if(Object.keys(patch).length){
       const {data,error}=await sbAuth.rpc('save_workspace_patch',{p_technical_table_id:mesaId(m),p_patch:patch});
       if(error)throw error;
       if(!data||!data.data)throw Error('El servidor no confirmó el guardado');
       confirmed=copy(data.data);
     }
     for(const op of collectionOps){
       const {data,error}=await sbAuth.rpc('mutate_workspace_collection',{
         p_technical_table_id:mesaId(m),
         p_collection:op.collection,
         p_action:op.action,
         p_item:op.item,
         p_item_id:op.item_id
       });
       if(error)throw error;
       if(!data||!data.data)throw Error('El servidor no confirmó la actualización compartida');
       confirmed=copy(data.data);
     }
     STATE.snapshots[m]=copy({...defaultWork(m),...confirmed,contenido:migrateContenido(confirmed.contenido||{})});
     const localAfter=getWork(m);
     const reconciled={...localAfter};
     COLLECTION_KEYS.forEach(k=>{reconciled[k]=copy(STATE.snapshots[m][k]||[])});
     original.setWork(m,reconciled);
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
 async function waitForWorkspaceSync(m,timeoutMs=20000){
   const started=Date.now();
   const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
   while(Date.now()-started<timeoutMs){
     while(STATE.busy[m]&&Date.now()-started<timeoutMs)await sleep(120);
     await flush(m);
     while(STATE.busy[m]&&Date.now()-started<timeoutMs)await sleep(120);
     if(localStorage.getItem(pendingKey(m))!=='1')return true;
     await sleep(300);
   }
   return localStorage.getItem(pendingKey(m))!=='1';
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
         const safeChanges={...changes};
         COLLECTION_KEYS.forEach(k=>delete safeChanges[k]);
         const merged={...remote,...safeChanges,contenido:{...(remote.contenido||{}),...(safeChanges.contenido||{})}};
         COLLECTION_KEYS.forEach(k=>{merged[k]=mergeCollectionChanges(oldCloud,local,remote,k)});
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
     if(['Administrador General','Administrador de Plataforma'].includes(currentUser.rol)){
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
   if(libraryRequestSubmitting)return;
   const ids=[...new Set((Array.isArray(requestingPubIds)&&requestingPubIds.length?requestingPubIds:[requestingPubId])
     .filter(x=>x!==null&&x!==undefined).map(String))];
   const seenPubs=new Set();
   const pubs=getPublicaciones().filter(p=>{
     const key=String(p.id);
     if(!ids.includes(key)||seenPubs.has(key))return false;
     seenPubs.add(key);return true;
   });
   const name=document.getElementById('reqNombre').value.trim(),
     email=document.getElementById('reqCorreo').value.trim(),
     institution=document.getElementById('reqInst').value.trim(),
     reason=document.getElementById('reqMotivo').value.trim();
   if(!pubs.length||!name||!email.includes('@'))return alert('Complete nombre y correo válidos.');
   if(!sbAuth)return alert('El registro de solicitudes no está disponible en este momento.');

   const submitBtn=document.querySelector('#requestModal button.btn.primary');
   libraryRequestSubmitting=true;
   if(submitBtn){submitBtn.disabled=true;submitBtn.textContent='Enviando solicitud…';}
   try{
     const rows=pubs.map(p=>({
       library_id:p.cloud?p.id:null,title:p.titulo,name,email,institution,reason
     }));
     const {error}=await sbAuth.from('document_requests').insert(rows);
     if(error)throw error;

     let emailSent=false;
     try{
       const listado=pubs.map((p,i)=>(i+1)+'. '+p.titulo).join('\n');
       const {data:mailData,error:mailError}=await sbAuth.functions.invoke('send-platform-email',{body:{
         type:'document_request',nombre:name,correo:email,institucion:institution,
         documento:listado,motivo:reason,website:''
       }});
       emailSent=!mailError&&!!mailData?.ok;
       if(mailError)console.warn('La solicitud quedó registrada, pero falló el aviso por correo.',mailError);
     }catch(e){console.warn('La solicitud quedó registrada, pero no fue posible enviar el aviso por correo.',e)}

     ['reqNombre','reqCorreo','reqInst','reqMotivo'].forEach(id=>document.getElementById(id).value='');
     if(window.selectedLibraryIds&&typeof selectedLibraryIds.delete==='function')pubs.forEach(p=>selectedLibraryIds.delete(String(p.id)));
     cerrarSolicitud();
     if(typeof renderBiblioteca==='function')renderBiblioteca();
     alert(emailSent
       ?'Su solicitud fue enviada correctamente a Administración. Los documentos seleccionados quedaron registrados y Administración recibió un aviso por correo electrónico.'
       :'Su solicitud fue enviada correctamente a Administración. Los documentos seleccionados quedaron registrados para su gestión.');
   }catch(error){
     console.error(error);
     alert('No se pudo registrar la solicitud. Inténtelo nuevamente.');
   }finally{
     libraryRequestSubmitting=false;
     if(submitBtn){submitBtn.disabled=false;submitBtn.textContent='Enviar solicitud';}
   }
 };
 window.loadPublicLibrary=async function(){
   if(!sbAuth)return;
   const {data,error}=await sbAuth.from('public_library')
     .select('id,technical_table_id,title,topic,description,snapshot,published_at,origin_type,author_id,author_name,source_contribution_id,final_pdf_path,final_pdf_name,final_pdf_size_bytes,final_pdf_created_at')
     .eq('is_public',true).order('published_at',{ascending:false});
   if(error){console.warn('No se pudo cargar la biblioteca compartida',error);return}
   const pubs=(data||[]).map(x=>({
     id:x.id,cloud:true,
     origen:x.origin_type||'Documento de Mesa',
     autor:x.author_name||'',
     autorProfesion:x.snapshot?.author_profession||'',
     authorId:x.author_id||null,
     sourceContributionId:x.source_contribution_id||null,
     finalPdfPath:x.final_pdf_path||'',
     finalPdfName:x.final_pdf_name||'',
     finalPdfSize:Number(x.final_pdf_size_bytes||0),
     finalPdfCreatedAt:x.final_pdf_created_at||null,
     mesa:x.snapshot?.mesa||'',
     titulo:x.title,tema:x.topic,descripcion:x.description||'',
     fechaPublicacion:new Date(x.published_at).toLocaleDateString('es-CL'),
     publishedAt:x.published_at,
     anoPublicacion:new Date(x.published_at).getFullYear(),
     tipoDocumento:x.snapshot?.document_type||'',
     resumen:x.snapshot?.summary||'',
     cuerpo:x.snapshot?.body||'',
     version:x.snapshot?.version||1,
     ...x.snapshot
   }));
   if(isReal()&&['Administrador General','Administrador de Plataforma'].includes(currentUser.rol)){
     for(const p of pubs.filter(x=>!x.finalPdfPath)){
       try{await guardarPdfFinalLegacy(p)}catch(e){console.warn('No se pudo crear el PDF oficial de una publicación anterior.',e)}
     }
   }
   STATE.publications=pubs;
   STATE.publicReady=true;
   try{localStorage.setItem('frentePT_biblioteca_cloud',JSON.stringify(pubs));}catch(e){console.warn('No se pudo guardar la copia local de Biblioteca',e)}
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
 window.guardarVersion=async function(){
   if(!isReal())return original.guardarVersion();
   if(!puedeTrabajarMesa(currentDocMesa))return alert('No tiene permiso para guardar versiones en esta Mesa.');
   const m=currentDocMesa,id=mesaId(m);if(!id)return alert('La Mesa no está disponible en la nube.');
   try{
     if(document.getElementById('wsTitulo'))syncWorkFromUI(true);
     clearTimeout(STATE.timers[m]);await flush(m);
     for(let i=0;i<10&&STATE.busy[m];i++)await new Promise(ok=>setTimeout(ok,180));
     const {data,error}=await sbAuth.rpc('save_workspace_version',{p_technical_table_id:id});
     if(error)throw error;
     const remote=copy({...defaultWork(m),...(data?.data||{}),contenido:migrateContenido(data?.data?.contenido||{})});
     STATE.snapshots[m]=remote;original.setWork(m,remote);
     localStorage.setItem(snapshotKey(m),JSON.stringify(remote));localStorage.removeItem(pendingKey(m));
     await refreshSharedLocks();renderEspacio(document.getElementById('privatecontent'));
     alert('Versión '+String(data?.version||'')+' guardada sobre el documento compartido más reciente.');
   }catch(e){
     console.error(e);
     const msg=String(e?.message||'');
     if(/Another member is editing/i.test(msg)){
       alert('No se puede guardar una versión mientras otro integrante esté editando una sección. Espere a que finalice su edición y vuelva a intentarlo.');
     }else{
       alert('No se pudo guardar la versión. Revise la conexión e inténtelo nuevamente.');
     }
   }
 };
 window.restaurarVersion=async function(n){
   if(!isReal())return original.restaurarVersion(n);
   if(!puedeGestionarMesa(currentDocMesa))return alert('Solo Coordinación, Secretaría Técnica o Administración pueden restaurar una versión completa.');
   const m=currentDocMesa,id=mesaId(m);if(!id)return alert('La Mesa no está disponible en la nube.');
   if(!confirm('¿Restaurar la versión '+n+' sobre el documento compartido actual? Se reemplazarán título, secciones y referencias por esa versión. El historial se conservará.'))return;
   try{
     const {data,error}=await sbAuth.rpc('restore_workspace_version',{p_technical_table_id:id,p_version:Number(n)});
     if(error)throw error;
     const remote=copy({...defaultWork(m),...(data?.data||{}),contenido:migrateContenido(data?.data?.contenido||{})});
     STATE.snapshots[m]=remote;original.setWork(m,remote);
     localStorage.setItem(snapshotKey(m),JSON.stringify(remote));localStorage.removeItem(pendingKey(m));
     releaseMyLocks();renderEspacio(document.getElementById('privatecontent'));
     alert('Versión '+n+' restaurada sobre el documento compartido. El historial anterior se mantiene disponible.');
   }catch(e){
     console.error(e);
     const msg=String(e?.message||'');
     alert(/Only Coordination|permission/i.test(msg)?'Solo Coordinación, Secretaría Técnica o Administración pueden restaurar versiones.':'No se pudo restaurar la versión. Inténtelo nuevamente.');
   }
 };
 window.solicitarPublicacion=async function(){
   if(!isReal())return original.solicitarPublicacion();
   if(STATE.submittingPublication)return;
   if(!/Coordinador/.test(getRoleForMesa(currentDocMesa)))return alert('Solo la coordinación puede solicitar publicación.');
   const m=currentDocMesa,id=mesaId(m);if(!id)return alert('La Mesa no está disponible en la nube.');
   const btn=document.getElementById('btnSolicitarPublicacion');
   if(btn){btn.disabled=true;btn.textContent='Enviando…';}
   STATE.submittingPublication=true;
   try{
     clearTimeout(STATE.timers[m]);
     let d=syncWorkFromUI(true);

     // Antes de enviar a Administración, confirmar que absolutamente todos
     // los cambios pendientes (secciones y colecciones compartidas) quedaron
     // persistidos en Supabase.
     const synced=await waitForWorkspaceSync(m,20000);
     if(!synced)throw new Error('No se logró confirmar la sincronización completa antes del envío.');

     d=getWork(m);
     if(snapshotChanged(d)){
       d=await saveVersionCore(false);
       if(!d)throw new Error('No se pudo consolidar la versión antes del envío.');
     }

     // Volver a confirmar sincronización después de crear la versión final.
     const versionSynced=await waitForWorkspaceSync(m,20000);
     if(!versionSynced)throw new Error('No se logró confirmar la versión final antes del envío.');

     const {error}=await sbAuth.rpc('submit_publication_request',{p_technical_table_id:id});
     if(error)throw error;
     const {data:row,error:re}=await sbAuth.from('workspace_documents').select('data,state').eq('technical_table_id',id).single();
     if(re)throw re;
     if(row?.data){
       const remote=copy({...defaultWork(m),...row.data,estado:row.state||row.data.estado||'Solicitud de publicación',contenido:migrateContenido(row.data.contenido||{})});
       STATE.snapshots[m]=remote;
       original.setWork(m,remote);
       localStorage.setItem(snapshotKey(m),JSON.stringify(remote));
     }
     await refreshSharedAdmin();
     if(btn){btn.textContent='✓ Documento enviado';btn.classList.remove('success');btn.classList.add('soft');}
     alert('Documento enviado.');
     setTimeout(()=>renderEspacio(document.getElementById('privatecontent')),400);
   }catch(error){
     console.error(error);
     const msg=String(error?.message||'');
     if(/already pending/i.test(msg)){
       if(btn){btn.textContent='✓ Documento enviado';btn.classList.remove('success');btn.classList.add('soft');btn.disabled=true;}
       alert('Documento enviado.');
     }else if(/Another member is editing/i.test(msg)){
       if(btn){btn.textContent='Solicitar publicación al Administrador';btn.disabled=false;}
       alert('No se puede enviar mientras otro integrante esté editando una sección. Espere a que finalice su edición y vuelva a intentarlo.');
     }else{
       if(btn){btn.textContent='Solicitar publicación al Administrador';btn.disabled=false;}
       alert('No se pudo enviar el documento. Inténtelo nuevamente.');
     }
   }finally{
     STATE.submittingPublication=false;
   }
 };
 async function refreshSharedAdmin(){
   if(!isReal()||!['Administrador General','Administrador de Plataforma'].includes(currentUser.rol))return;
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
     if(['administrador_general','administrador_plataforma'].includes(p.role))arr.push({profileId:p.id,nombre:p.full_name,correo:p.email,rol:p.role==='administrador_general'?'Administrador General':'Administrador de Plataforma',mesa:'Administración',estado:p.is_active?'Activo':'Inactivo'});
     for(const x of members.filter(a=>a.profile_id===p.id)){
       const name=Object.keys(STATE.ids).find(m=>String(STATE.ids[m])===String(x.technical_table_id));
       if(name)arr.push({profileId:p.id,technicalTableId:x.technical_table_id,nombre:p.full_name,correo:p.email,rol:x.is_coordinator?'Coordinador/a de Mesa':x.member_role,
         mesa:name,estado:p.is_active?'Activo':'Inactivo'});
     }
   }
   STATE.adminData={integrantes:arr,requests:requests.map(x=>({id:x.id,mesa:Object.keys(STATE.ids).find(m=>String(STATE.ids[m])===String(x.technical_table_id))||'',
     titulo:x.title,fecha:new Date(x.requested_at).toLocaleString('es-CL'),version:x.version,contenido:x.snapshot?.contenido||{},
     referencias:x.snapshot?.referencias||[],solicitante:profiles.find(p=>p.id===x.requested_by)?.full_name||'Coordinación',
     correo:profiles.find(p=>p.id===x.requested_by)?.email||'',estado:x.status,cloud:true,snapshot:x.snapshot})),
   solicitudes:documents.map(x=>({id:x.id,libraryId:x.library_id,titulo:x.title,nombre:x.name,correo:x.email,institucion:x.institution,
     motivo:x.reason||'',fecha:new Date(x.created_at).toLocaleString('es-CL'),createdAt:x.created_at,estado:x.status,cloud:true,
     sentAt:x.sent_at||null,adminMessage:x.admin_message||'',deliveryEmailId:x.delivery_email_id||null,copyEmail:x.copy_email||'',sentBy:x.sent_by||null}))};
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
         version:d.versiones?.at(-1)?.numero||1,contenido:copy(d.contenido||{}),referencias:copy(d.referencias||[]),revisiones:copy(d.revisiones||[]),
         estado:'Aprobado'});
     }
   }
   for(const p of window.getPublicaciones()){
     if(!assign.includes(p.mesa))continue;
     result.set(p.mesa+'|'+p.titulo,{id:2000000+p.id,mesa:p.mesa,titulo:p.titulo,
       fecha:p.fechaPublicacion||'',version:p.version||1,contenido:copy(p.contenido||{}),
       referencias:copy(p.referencias||[]),revisiones:copy(p.revisiones||[]),estado:'Aprobado'});
   }
   return [...result.values()];
 };
 window.renderAprobados=async function(c){
   if(!isReal())return original.renderAprobados?original.renderAprobados(c):undefined;
   if(typeof window.loadPublicLibrary==='function')await window.loadPublicLibrary();
   const ass=getAssignedMesas();
   const docs=getPublicaciones().filter(p=>ass.includes(p.mesa));
   c.innerHTML='<div class="kicker">Archivo interno oficial</div><h1 class="section-title">Documentos Publicados</h1>'+
     '<div class="notice"><b>Documento publicado.</b> Esta versión fue aprobada y convertida en documento final. El archivo oficial es el PDF guardado en Biblioteca.</div><br>'+
     (docs.length?'<div class="list">'+docs.map(p=>'<div class="row"><div><b>'+esc(p.titulo)+'</b><br><small>Mesa '+esc(p.mesa)+' · '+esc(p.fechaPublicacion||'')+' · Versión '+esc(String(p.version||1))+'</small></div><div><span class="pill green">DOCUMENTO FINAL</span> <button class="btn primary" onclick="verDocumentoFinalPDF('+Number(p.id)+',false)">Ver documento final en PDF</button> <button class="btn soft" onclick="verDocumentoFinalPDF('+Number(p.id)+',true)">Descargar PDF</button></div></div>').join('')+'</div>':'<div class="card"><p>No hay documentos finales publicados para sus Mesas.</p></div>');
 };
 window.actualizarEstadoContacto=async function(id,status){
   if(!isReal()||!['Administrador General','Administrador de Plataforma'].includes(currentUser.rol))return;
   const patch={status,updated_at:new Date().toISOString(),handled_by:STATE.uid};
   if(status==='Respondido')patch.responded_at=new Date().toISOString();
   if(status==='Cerrado')patch.closed_at=new Date().toISOString();
   const {error}=await sbAuth.from('contact_messages').update(patch).eq('id',id);
   if(error){console.error(error);return alert('No se pudo actualizar el mensaje.')}
   await window.adminContactos();
 };
 window.guardarNotaContacto=async function(id){
   if(!isReal()||!['Administrador General','Administrador de Plataforma'].includes(currentUser.rol))return;
   const x=(STATE.contactRows||[]).find(a=>a.id===id);if(!x)return;
   const nota=prompt('Nota interna de Administración:',x.admin_note||'');if(nota===null)return;
   const {error}=await sbAuth.from('contact_messages').update({
     admin_note:nota.trim()||null,handled_by:STATE.uid,updated_at:new Date().toISOString()
   }).eq('id',id);
   if(error){console.error(error);return alert('No se pudo guardar la nota.')}
   await window.adminContactos();
 };
 window.enviarRespuestaContacto=async function(id){
   if(!isReal()||!['Administrador General','Administrador de Plataforma'].includes(currentUser.rol))return;
   const x=(STATE.contactRows||[]).find(a=>a.id===id);if(!x)return;
   const textEl=document.getElementById('contact-reply-text-'+id);
   const statusEl=document.getElementById('contact-reply-status-'+id);
   const button=document.getElementById('contact-send-'+id);
   const respuesta=(textEl?.value||'').trim();
   if(!respuesta){
     if(statusEl)statusEl.textContent='Escriba una respuesta antes de enviar.';
     if(textEl)textEl.focus();
     return;
   }
   if(button){button.disabled=true;button.textContent='Enviando…';}
   if(statusEl)statusEl.textContent='Enviando correo desde contacto@profesionalesohiggins.cl…';
   try{
     const {data,error}=await sbAuth.functions.invoke('reply-contact',{body:{id,respuesta}});
     if(error)throw error;
     if(!data?.ok)throw Error(data?.error||'No fue posible enviar la respuesta.');
     if(statusEl)statusEl.textContent='Correo enviado correctamente. El mensaje quedó marcado como Respondido.';
     if(textEl)textEl.value='';
     setTimeout(()=>window.adminContactos(),900);
   }catch(error){
     console.error('No fue posible enviar la respuesta de contacto:',error);
     if(statusEl)statusEl.textContent='No fue posible enviar el correo. Revise la conexión e inténtelo nuevamente.';
     if(button){button.disabled=false;button.textContent='Enviar correo desde la plataforma';}
   }
 };
 window.adminContactos=async function(){
   const b=document.getElementById('admincontent');if(!b)return;
   if(!isReal()||!['Administrador General','Administrador de Plataforma'].includes(currentUser.rol)){
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
       return '<div class="card" style="margin:12px 0"><div class="row"><div><span class="pill '+(x.status==='Nuevo'?'amber':x.status==='Cerrado'?'green':'')+'">'+esc(x.status)+'</span> <b>'+esc(x.subject||'Sin asunto')+'</b><br><small>'+esc(new Date(x.created_at).toLocaleString('es-CL'))+(x.email_notified_at?' · Aviso por correo enviado':' · Sin confirmación de aviso por correo')+'</small></div><div><select onchange="actualizarEstadoContacto('+x.id+',this.value)">'+['Nuevo','En revisión','Respondido','Cerrado'].map(s=>'<option '+(x.status===s?'selected':'')+'>'+s+'</option>').join('')+'</select></div></div>'+
       '<p><b>'+esc(x.name)+'</b> · <span>'+esc(x.email)+'</span>'+(x.institution?' · '+esc(x.institution):'')+'</p><p>'+esc(x.message).replace(/\n/g,'<br>')+'</p>'+
       (x.admin_note?'<div class="mini-note"><b>Nota interna:</b> '+esc(x.admin_note)+'</div>':'')+
       '<div style="margin-top:14px"><label>Respuesta</label><textarea id="contact-reply-text-'+x.id+'" rows="5" placeholder="Escriba aquí la respuesta…"></textarea><div class="toolbar-row" style="margin-top:10px"><button type="button" class="btn primary" id="contact-send-'+x.id+'" onclick="enviarRespuestaContacto('+x.id+')">Enviar correo desde la plataforma</button> <button type="button" class="btn soft" onclick="guardarNotaContacto('+x.id+')">Nota interna</button> '+(x.status!=='En revisión'&&x.status!=='Cerrado'?'<button type="button" class="btn soft" onclick="actualizarEstadoContacto('+x.id+',\'En revisión\')">Marcar en revisión</button>':'')+(x.status!=='Cerrado'?'<button type="button" class="btn soft" onclick="actualizarEstadoContacto('+x.id+',\'Cerrado\')">Cerrar</button>':'')+'</div><div id="contact-reply-status-'+x.id+'" class="statusbar"></div></div></div>';
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

 window.renderIntegrantes=function(){
   const b=document.getElementById('admListado');if(!b)return;
   const a=getIntegrantes().filter(x=>x.rol!=='Administrador General'&&x.mesa!=='Administración');
   const by={};a.forEach(x=>{(by[x.correo]??=[]).push(x)});
   const rows=Object.entries(by);
   b.innerHTML=rows.length?rows.map(([correo,items])=>
     '<div class="card" style="margin-bottom:10px"><b>'+esc(items[0].nombre)+'</b><br><small>'+esc(correo)+'</small><div style="margin-top:10px">'+
     items.map(x=>'<div class="row"><div><b>'+esc(x.mesa)+'</b></div><div><span class="pill">'+esc(x.rol)+'</span> <span class="pill green">'+esc(x.estado)+'</span> <button class="btn danger" onclick="quitarIntegranteDeMesa(\''+String(x.profileId||'').replace(/'/g,"\\'")+'\','+Number(x.technicalTableId||0)+',\''+String(x.nombre||'Integrante').replace(/'/g,"\\'")+'\',\''+String(x.mesa||'Mesa').replace(/'/g,"\\'")+'\')">Quitar de esta Mesa</button></div></div>').join('')+
     '</div></div>').join(''):'<div class="notice">Sin integrantes registrados.</div>';
 };
 window.quitarIntegranteDeMesa=async function(profileId,technicalTableId,nombre,mesa){
   if(!isReal()||!['Administrador General','Administrador de Plataforma'].includes(currentUser.rol))return;
   if(!profileId||!technicalTableId)return alert('No se pudo identificar esta asignación.');
   if(!confirm('¿Quitar a '+nombre+' de la Mesa '+mesa+'?\n\nSe conservarán su cuenta, perfil y cualquier otra Mesa asignada.'))return;
   const {error}=await sbAuth.from('table_memberships').delete()
     .eq('profile_id',profileId).eq('technical_table_id',Number(technicalTableId));
   if(error){console.error(error);return alert('No fue posible quitar al integrante de esta Mesa.')}
   await refreshSharedAdmin();renderIntegrantes();
   alert('El integrante fue quitado únicamente de la Mesa '+mesa+'. Su cuenta y las demás asignaciones permanecen.');
 };

 function fmtBytes(n){
   n=Number(n||0);if(n<1024)return n+' B';
   const u=['KB','MB','GB','TB'];let i=-1;do{n/=1024;i++}while(n>=1024&&i<u.length-1);
   return n.toLocaleString('es-CL',{maximumFractionDigits:n>=100?0:n>=10?1:2})+' '+u[i];
 }
 function pct(v,max){return max?Math.min(999,Math.round((Number(v||0)/max)*100)):0}
 function healthFor(values){
   const max=Math.max(...values);
   if(max>=85)return {label:'Evaluar cambio a Pro',icon:'🔴',className:'amber'};
   if(max>=70)return {label:'Revisar capacidad',icon:'🟡',className:'amber'};
   return {label:'Plan Free suficiente',icon:'🟢',className:'green'};
 }
 window.adminEstado=async function(){
   if(!requireAdmin())return;
   const c=document.getElementById('admincontent');if(!c)return;
   c.innerHTML='<div class="kicker">Control general</div><h1 class="section-title">Estado de la Plataforma</h1><p class="muted">Calculando uso actual…</p>';
   if(!isReal()){c.innerHTML+='<div class="notice">Ingrese con una cuenta administrativa real para consultar el estado.</div>';return}
   try{
     const {data,error}=await sbAuth.rpc('admin_system_usage');if(error)throw error;
     const DB_MAX=500*1024*1024,STORAGE_MAX=1024*1024*1024,MAU_MAX=50000;
     const dbPct=pct(data.database_bytes,DB_MAX),stPct=pct(data.storage_bytes,STORAGE_MAX),mauPct=pct(data.mau_30d,MAU_MAX);
     const health=healthFor([dbPct,stPct,mauPct]);
     const bar=(p)=>'<div style="height:8px;background:#e7ebef;border-radius:99px;overflow:hidden;margin-top:8px"><div style="height:100%;width:'+Math.min(100,p)+'%;background:currentColor"></div></div>';
     c.innerHTML='<div class="kicker">Control general</div><h1 class="section-title">Estado de la Plataforma</h1>'+
       '<div class="notice"><b>'+health.icon+' '+health.label+'.</b> El semáforo considera Base de Datos, Storage y usuarios activos mensuales medidos automáticamente.</div><br>'+
       '<div class="grid3">'+
       '<div class="card"><span class="pill green">Actual</span><h3>Free</h3><p>Plan Supabase</p><small>Verificado para esta organización el 27-09-2026.</small></div>'+
       '<div class="card"><h3>'+esc(String(data.profiles||0))+'</h3><p>Profesionales activos</p></div>'+
       '<div class="card"><h3>'+esc(String(data.active_tables||0))+'</h3><p>Mesas activas</p></div>'+
       '<div class="card"><h3>'+fmtBytes(data.database_bytes)+'</h3><p>Base de datos · '+dbPct+'% de 500 MB</p>'+bar(dbPct)+'</div>'+
       '<div class="card"><h3>'+fmtBytes(data.storage_bytes)+'</h3><p>Archivos · '+stPct+'% de 1 GB</p><small>'+esc(String(data.storage_files||0))+' archivo(s)</small>'+bar(stPct)+'</div>'+
       '<div class="card"><h3>'+esc(String(data.mau_30d||0))+'</h3><p>Usuarios activos últimos 30 días · '+mauPct+'% de 50.000</p>'+bar(mauPct)+'</div>'+
       '</div>'+
       '<h2 class="section-sub">Seguridad y límites del plan</h2>'+
       '<div class="grid3">'+
       '<div class="card"><h3>🔒 No disponible en Free</h3><p>Protección contra contraseñas filtradas</p><small>Se habilita al pasar a Pro o superior.</small></div>'+
       '<div class="card"><h3>5 GB</h3><p>Egress incluido</p><small>El consumo exacto debe revisarse en Supabase → Usage.</small></div>'+
       '<div class="card"><h3>500.000</h3><p>Invocaciones Edge Function</p><small>El consumo exacto debe revisarse en Supabase → Usage.</small></div>'+
       '</div>'+
       '<div class="mini-note" style="margin-top:16px"><b>Regla del semáforo:</b> verde bajo 70%; amarillo desde 70%; rojo desde 85%. Si aparece rojo, conviene revisar el cambio a Pro antes de alcanzar el límite.</div>'+
       '<div class="mini-note" style="margin-top:10px">Última medición: '+new Date(data.measured_at).toLocaleString('es-CL')+'. Algunas métricas de facturación, especialmente transferencia y Edge Functions, solo están disponibles en el panel oficial de Supabase.</div>';
   }catch(e){
     console.error(e);
     c.innerHTML='<div class="kicker">Control general</div><h1 class="section-title">Estado de la Plataforma</h1><div class="notice">No fue posible calcular el uso de Supabase en este momento.</div>';
   }
 };
 window.guardarIntegrante=async function(){
   if(!isReal())return original.guardarIntegrante();
   const name=document.getElementById('admNombre').value.trim(),email=document.getElementById('admCorreo').value.trim().toLowerCase(),
     m=document.getElementById('admMesa').value,rol=document.getElementById('admRol').value,
     status=document.getElementById('admInviteStatus'),targetTableId=mesaId(m);
   if(!name||!email.includes('@')||!targetTableId)return status.textContent='Complete nombre, correo y Mesa.';
   const {data:p,error:pe}=await sbAuth.from('profiles').select('id').eq('email',email).maybeSingle();
   if(pe){console.error(pe);return status.textContent='No se pudo consultar la cuenta.'}
   if(!p)return status.textContent='El profesional debe registrarse y confirmar su correo antes de recibir una Mesa.';
   const {data:memberships,error:me}=await sbAuth.from('table_memberships')
     .select('technical_table_id,member_role,is_coordinator,technical_tables(name)')
     .eq('profile_id',p.id);
   if(me){console.error(me);return status.textContent='No se pudieron validar los roles actuales del integrante.'}
   const repeated=(memberships||[]).find(x=>{
     if(Number(x.technical_table_id)===Number(targetTableId))return false;
     const existingRole=x.is_coordinator?'Coordinador/a de Mesa':x.member_role;
     return existingRole===rol;
   });
   if(repeated){
     const otherMesa=repeated.technical_tables?.name||'otra Mesa Técnica';
     status.textContent='Este integrante ya tiene asignado el rol de '+rol+' en la Mesa '+otherMesa+'. Seleccione un rol diferente.';
     return;
   }
   const {error}=await sbAuth.from('table_memberships').upsert({
      profile_id:p.id,technical_table_id:targetTableId,member_role:rol,is_coordinator:/Coordinador/.test(rol)
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
 function solicitudGrupo(id){
   const all=getSolicitudes(),base=all.find(x=>String(x.id)===String(id));if(!base)return [];
   const t0=new Date(base.createdAt||0).getTime();
   return all.filter(x=>String(x.correo||'').toLowerCase()===String(base.correo||'').toLowerCase()
     &&String(x.nombre||'')===String(base.nombre||'')
     &&Math.abs(new Date(x.createdAt||0).getTime()-t0)<=10000);
 }
 function solicitudDocumentosUnicos(group){
   const seen=new Set();
   return (group||[]).filter(x=>{
     const key=String(x.libraryId||x.library_id||x.titulo||'');
     if(seen.has(key))return false;
     seen.add(key);return true;
   });
 }
 function solicitudEstadoLabel(s){
   return s==='Entregado'?'Entregado':s==='Enviada'?'Enviado':s||'Pendiente';
 }
 window.revisarSolicitudDocumento=async function(id){
   if(!isReal())return;
   const group=solicitudGrupo(id);if(!group.length)return alert('No se encontró la solicitud.');
   const first=group[0],host=document.getElementById('admincontent');if(!host)return;
   host.innerHTML='<div class="muted">Cargando documento solicitado…</div>';
   if(typeof window.loadPublicLibrary==='function')await window.loadPublicLibrary();
   let pubs=getPublicaciones();
   const uniqueDocs=solicitudDocumentosUnicos(group);
   const requestedIds=[...new Set(uniqueDocs.map(x=>Number(x.libraryId||x.library_id)).filter(Number.isFinite))];
   const missingIds=requestedIds.filter(libraryId=>!pubs.some(p=>Number(p.id)===libraryId));
   if(missingIds.length){
     const {data:direct,error:directError}=await sbAuth.from('public_library')
       .select('id,title,topic,snapshot,is_public,final_pdf_path,final_pdf_name,final_pdf_size_bytes')
       .in('id',missingIds);
     if(!directError){
       const recovered=(direct||[]).map(x=>({
         id:x.id,cloud:true,titulo:x.title,tema:x.topic||'',mesa:x.snapshot?.mesa||x.topic||'',
         finalPdfPath:x.final_pdf_path||'',finalPdfName:x.final_pdf_name||'',finalPdfSize:Number(x.final_pdf_size_bytes||0)
       }));
       pubs=[...pubs,...recovered];
     }
   }
   const requestedLibraryIds=new Set(uniqueDocs.map(x=>String(x.libraryId||x.library_id||'')).filter(Boolean));
   const docs=uniqueDocs.map(x=>{
     const libraryId=String(x.libraryId||x.library_id||'');
     const pub=pubs.find(p=>String(p.id)===libraryId);
     const requestId=x.id;
     const fileName=pub?.finalPdfName||'PDF oficial no disponible';
     const ready=!!pub?.finalPdfPath;
     return '<div class="card library-send-doc-card"><div class="row library-send-doc-row">'+
       '<div class="library-send-doc-main"><input class="library-request-doc" type="checkbox" value="'+esc(String(requestId))+'" data-library-id="'+esc(libraryId)+'" '+(ready?'checked':'disabled')+'>'+
       '<div class="library-send-doc-text"><b>'+esc(x.titulo)+'</b><br><small>Archivo: '+esc(fileName)+'</small><br><small>ID Biblioteca: '+esc(libraryId)+'</small></div></div>'+
       '<div class="library-send-doc-actions"><span class="pill '+(ready?'green':'amber')+'">'+(ready?'PDF DISPONIBLE':'SIN PDF')+'</span>'+
       (ready?'<button class="btn soft" type="button" onclick="verDocumentoFinalPDF('+Number(libraryId)+',false)">Ver PDF</button>':'')+
       '</div></div></div>';
   }).join('');
   host.innerHTML='<div class="kicker">Revisión de solicitud</div><h1 class="section-title">Enviar documentos de Biblioteca</h1>'+
    '<div class="card"><h3>Solicitante</h3><p><b>'+esc(first.nombre)+'</b><br>'+esc(first.correo)+(first.institucion?'<br>'+esc(first.institucion):'')+'</p>'+
    (first.motivo?'<p><b>Motivo / interés:</b><br>'+esc(first.motivo)+'</p>':'')+'</div>'+
    '<div class="card" style="margin-top:12px"><h3>Documento(s) solicitado(s)</h3><div class="mini-note"><b>Los documentos pedidos aparecen seleccionados automáticamente.</b> Si la solicitud incluye más de un documento, podrá enviar todos en el mismo correo, sin duplicados. Puede abrir cada PDF antes de enviarlo.</div>'+docs+'</div>'+
    '<div class="card" style="margin-top:12px"><label><b>Mensaje al solicitante</b></label><textarea id="libraryReplyMessage" rows="6" placeholder="Escriba aquí el mensaje que acompañará los documentos.">'+esc(first.adminMessage||'Adjuntamos los documentos solicitados desde nuestra Biblioteca. Saludos cordiales.')+'</textarea>'+
    '<p class="mini-note">El correo se enviará con los PDF marcados y una copia a la cuenta administrativa que realiza el envío.</p>'+
    '<div style="margin-top:12px"><button id="sendLibraryDocsBtn" class="btn primary" onclick="enviarDocumentosSolicitud('+id+')">Enviar documentos seleccionados</button> <button class="btn soft" onclick="adminSolicitudes()">Volver</button></div></div>';
 }
 async function generarAdjuntoPDFFinalBiblioteca(pub){
   const jsPDF=window.jspdf?.jsPDF;
   if(!jsPDF)throw new Error('No fue posible cargar jsPDF para generar el documento.');

   const x={...structuredClone(pub),estado:'Aprobado',borrador:false};
   const pdf=new jsPDF({unit:'mm',format:'a4',orientation:'portrait'});
   const pageW=210,pageH=297,marginX=18,top=18,bottom=18,maxW=pageW-marginX*2;
   let y=top;

   const toText=(html)=>{
     const box=document.createElement('div');
     box.innerHTML=String(html||'');
     return (box.innerText||box.textContent||'')
       .replace(/\u00a0/g,' ')
       .replace(/[ \t]+\n/g,'\n')
       .replace(/\n{3,}/g,'\n\n')
       .trim();
   };
   const ensure=(need=8)=>{
     if(y+need>pageH-bottom){
       pdf.addPage();
       y=top;
       drawHeader();
     }
   };
   const write=(text,{size=10,bold=false,italic=false,indent=0,after=4,line=5.2}={})=>{
     const clean=String(text||'').trim();
     if(!clean)return;
     pdf.setFont('helvetica',bold?'bold':(italic?'italic':'normal'));
     pdf.setFontSize(size);
     const lines=pdf.splitTextToSize(clean,maxW-indent);
     ensure(Math.max(line,lines.length*line)+after);
     for(const ln of lines){
       ensure(line);
       pdf.text(ln,marginX+indent,y);
       y+=line;
     }
     y+=after;
   };
   const drawHeader=()=>{
     pdf.setDrawColor(18,59,103);
     pdf.setLineWidth(.5);
     pdf.line(marginX,12,pageW-marginX,12);
     pdf.setFont('helvetica','bold');pdf.setFontSize(8);
     pdf.setTextColor(18,59,103);
     pdf.text('Frente de Profesionales y Técnicos - Región de O’Higgins',marginX,9);
     pdf.setTextColor(23,37,54);
   };
   const drawFooter=()=>{
     const pages=pdf.getNumberOfPages();
     for(let p=1;p<=pages;p++){
       pdf.setPage(p);
       pdf.setDrawColor(180,190,200);
       pdf.setLineWidth(.3);
       pdf.line(marginX,pageH-12,pageW-marginX,pageH-12);
       pdf.setFont('helvetica','normal');pdf.setFontSize(8);pdf.setTextColor(101,116,135);
       pdf.text('Documento técnico institucional',marginX,pageH-8);
       pdf.text('Página '+p+' de '+pages,pageW-marginX,pageH-8,{align:'right'});
     }
     pdf.setTextColor(23,37,54);
   };

   // Portada institucional definitiva.
   if(typeof imagenAPngBytes!=='function')throw new Error('No está disponible el cargador de logos institucionales.');
   const [logoDC,logoFrente]=await Promise.all([
     imagenAPngBytes('https://upload.wikimedia.org/wikipedia/commons/7/71/Logo_Democracia_Cristiana_Chile_2020.png',260,92),
     imagenAPngBytes('https://upload.wikimedia.org/wikipedia/commons/1/1b/Emblem_of_the_Christian_Democrat_Party_of_Chile.svg',110,92)
   ]);
   const dcW=Math.min(78,logoDC.width*0.2646),dcH=logoDC.height*(dcW/logoDC.width);
   const frW=Math.min(28,logoFrente.width*0.2646),frH=logoFrente.height*(frW/logoFrente.width);
   pdf.addImage(logoDC.data,'PNG',22,15,dcW,dcH);
   pdf.addImage(logoFrente.data,'PNG',pageW-22-frW,14,frW,frH);

   pdf.setTextColor(18,59,103);
   pdf.setFont('helvetica','bold');pdf.setFontSize(15.5);
   pdf.text('Plataforma Digital Frente PT O’Higgins',pageW/2,48,{align:'center'});
   pdf.setFont('helvetica','bold');pdf.setFontSize(10.5);pdf.setTextColor(30,93,145);
   pdf.text('Conocimiento · Participación · Colaboración · Propuestas',pageW/2,57,{align:'center'});

   pdf.setTextColor(30,93,145);pdf.setFont('helvetica','bold');pdf.setFontSize(13);
   pdf.text('INFORME TÉCNICO FINAL',pageW/2,75,{align:'center'});

   pdf.setTextColor(23,37,54);pdf.setFontSize(22);
   const titleLines=pdf.splitTextToSize(x.titulo||'Documento técnico',155);
   pdf.text(titleLines,pageW/2,93,{align:'center'});
   let my=93+titleLines.length*9+16;

   const coordinador=(typeof getCoordinator==='function'?getCoordinator(x.mesa):'')||'No registrado';
   const fechaRaw=x.fechaPublicacion||x.fecha||new Date().toLocaleDateString('es-CL');
   const fecha=String(fechaRaw).split(',')[0];
   const tipo=x.tipoEstudio||x.tipo_estudio||'Estudio técnico';
   const meta=[
     ['Mesa Técnica',x.mesa||''],
     ['Tipo de estudio',tipo],
     ['Coordinador/a',coordinador],
     ['Fecha de aprobación',fecha],
     ['Versión',String(x.version||1)],
     ['Estado','APROBADO PARA PUBLICACIÓN']
   ];
   const labelW=66,rowH=10;
   pdf.setFontSize(9);
   meta.forEach(([label,value])=>{
     pdf.setFillColor(238,243,248);
     pdf.rect(marginX,my,labelW,rowH,'F');
     pdf.setTextColor(30,93,145);pdf.setFont('helvetica','bold');
     pdf.text(label,marginX+2,my+6.4);
     pdf.setTextColor(23,37,54);pdf.setFont('helvetica','normal');
     const lines=pdf.splitTextToSize(String(value||''),maxW-labelW-4);
     pdf.text(lines,marginX+labelW+2,my+6.4);
     my+=Math.max(rowH,lines.length*4.2+3);
   });

   // Equipo de elaboración y revisión técnica.
   pdf.addPage();y=top;drawHeader();
   write('Equipo de elaboración',{size:15,bold:true,after:6,line:7});
   write('El presente informe fue desarrollado colaborativamente por los integrantes de la Mesa Técnica que se individualizan a continuación.',{size:10,after:5});
   const team=typeof getTeamForMesa==='function'?getTeamForMesa(x.mesa):[];
   if(team.length){
     team.forEach(p=>write((p.nombre||'')+' - '+(p.titulo||'Título profesional no registrado')+' - '+(p.rol||'Integrante'),{size:9,indent:3,after:2,line:4.5}));
   }else write('Sin integrantes registrados.',{size:9,italic:true});
   write('Revisión técnica',{size:14,bold:true,after:5,line:6.5});
   const reviewers=Array.isArray(x.revisiones)?x.revisiones:[];
   if(reviewers.length){
     reviewers.forEach(r=>write((r.nombre||'')+' - '+(r.profesion||'Profesión no registrada')+' - '+(r.cargo||'Integrante de Mesa'),{size:9,indent:3,after:2,line:4.5}));
   }else write('Sin vistos buenos registrados.',{size:9,italic:true});

   // Índice.
   pdf.addPage();y=top;drawHeader();
   write('Índice',{size:15,bold:true,after:7,line:7});
   write('Resumen ejecutivo',{size:10,after:2});
   STUDY_SECTION_NAMES.forEach((sec,idx)=>write((idx+1)+'. '+sec,{size:10,after:2}));
   write('Referencias',{size:10,after:2});
   write('Anexos',{size:10,after:2});

   // Cuerpo final.
   pdf.addPage();y=top;drawHeader();
   write('Resumen ejecutivo',{size:15,bold:true,after:6,line:7});
   write('Se genera a partir de la versión final del estudio.',{size:10,italic:true,after:6});
   STUDY_SECTION_NAMES.forEach((sec,idx)=>{
     write((idx+1)+'. '+sec,{size:14,bold:true,after:5,line:6.5});
     const txt=toText(x.contenido?.[sec]);
     write(txt||'Sin contenido.',{size:10,after:6,line:5.2});
   });
   write('Referencias',{size:14,bold:true,after:5,line:6.5});
   const refs=[...(x.referencias||[])].sort((a,b)=>(a.autor||'').localeCompare(b.autor||''));
   if(refs.length)refs.forEach((r,idx)=>write((idx+1)+'. '+(r.apa||''),{size:9,indent:2,after:3,line:4.7}));
   else write('Sin referencias registradas.',{size:9,italic:true});
   write('Anexos',{size:14,bold:true,after:5,line:6.5});
   write('Se incorporarán cuando corresponda.',{size:9,italic:true});

   drawFooter();

   const blob=pdf.output('blob');
   return {
     library_id:Number(pub.id||0),
     filename:limpiarNombreArchivo(pub.titulo||'documento')+'_VERSION_FINAL.pdf',
     blob,
     size:blob.size
   };
 }
 window.enviarDocumentosSolicitud=async function(id){
   if(!isReal())return;
   const group=solicitudGrupo(id);if(!group.length)return alert('No se encontró la solicitud.');
   const btn=document.getElementById('sendLibraryDocsBtn'),message=(document.getElementById('libraryReplyMessage')?.value||'').trim();
   const requestIds=[...document.querySelectorAll('.library-request-doc:checked')].map(x=>Number(x.value)).filter(Number.isFinite);
   if(!requestIds.length)return alert('Seleccione al menos un documento solicitado para adjuntar al correo.');
   if(btn){btn.disabled=true;btn.textContent='Enviando PDF oficial…';}
   try{
     const {data,error}=await sbAuth.functions.invoke('send-library-copy',{body:{
       request_ids:requestIds,
       message
     }});
     if(error)throw error;if(!data?.ok)throw new Error(data?.error||'No fue posible enviar.');
     await refreshSharedAdmin();
     alert('Correo enviado correctamente con '+(data.attachments?.length||requestIds.length)+' PDF oficial adjunto(s).');
     await window.adminSolicitudes();
   }catch(e){
     console.error(e);alert('No fue posible enviar el PDF oficial. La solicitud no se marcó como enviada.');
     if(btn){btn.disabled=false;btn.textContent='Enviar documentos seleccionados';}
   }
 };
 async function guardarPdfFinalLegacy(pub){
   if(!isReal()||!['Administrador General','Administrador de Plataforma'].includes(currentUser.rol)||pub.finalPdfPath)return pub;
   const finalPdf=await generarAdjuntoPDFFinalBiblioteca({...copy(pub),estado:'Aprobado',borrador:false});
   const safeFile=finalPdf.filename.replace(/[^a-zA-Z0-9._-]+/g,'_');
   const path=STATE.uid+'/biblioteca/legacy-'+pub.id+'-'+Date.now()+'/'+safeFile;
   const upload=await sbAuth.storage.from('frente-documentos').upload(path,finalPdf.blob,{contentType:'application/pdf',upsert:false});
   if(upload.error)throw upload.error;
   const {error}=await sbAuth.from('public_library').update({
     final_pdf_path:path,
     final_pdf_name:finalPdf.filename,
     final_pdf_size_bytes:finalPdf.size,
     final_pdf_created_at:new Date().toISOString()
   }).eq('id',pub.id).eq('is_public',true);
   if(error){
     try{await sbAuth.storage.from('frente-documentos').remove([path])}catch(e){}
     throw error;
   }
   pub.finalPdfPath=path;pub.finalPdfName=finalPdf.filename;pub.finalPdfSize=finalPdf.size;pub.finalPdfCreatedAt=new Date().toISOString();
   return pub;
 }
 window.verDocumentoFinalPDF=async function(id,descargar=false){
   try{
     if(typeof window.loadPublicLibrary==='function')await window.loadPublicLibrary();
     const p=getPublicaciones().find(x=>String(x.id)===String(id));
     if(!p||!p.finalPdfPath)return alert('Este documento todavía no tiene un PDF final oficial disponible.');
     const opts=descargar?{download:p.finalPdfName||'documento-final.pdf'}:undefined;
     const signed=await sbAuth.storage.from('frente-documentos').createSignedUrl(p.finalPdfPath,300,opts);
     if(signed.error||!signed.data?.signedUrl)throw signed.error||new Error('No se pudo crear el acceso al PDF.');
     if(descargar){
       const a=document.createElement('a');a.href=signed.data.signedUrl;a.download=p.finalPdfName||'documento-final.pdf';
       document.body.appendChild(a);a.click();a.remove();
     }else{
       const w=window.open(signed.data.signedUrl,'_blank','noopener,noreferrer');
       if(!w)location.href=signed.data.signedUrl;
     }
   }catch(e){console.error(e);alert('No fue posible abrir el documento final en PDF. Inténtelo nuevamente.')}
 };
 window.verDocumentoFinalMesaActual=async function(){
   if(typeof window.loadPublicLibrary==='function')await window.loadPublicLibrary();
   const p=getPublicaciones().find(x=>x.mesa===currentDocMesa&&x.titulo===getWork(currentDocMesa).titulo);
   if(!p)return alert('No se encontró la publicación final de esta Mesa.');
   return window.verDocumentoFinalPDF(p.id,false);
 };
 window.comprobarEntregaSolicitudes=async function(){
   if(!isReal())return;
   const ids=getSolicitudes().filter(x=>x.deliveryEmailId&&x.estado!=='Entregado').map(x=>x.id);
   if(!ids.length)return;
   try{
     const {data,error}=await sbAuth.functions.invoke('check-library-delivery',{body:{request_ids:ids}});
     if(error)throw error;
     if(data?.updated){await refreshSharedAdmin();}
   }catch(e){console.warn('No se pudo comprobar el estado de entrega.',e)}
 };
 window.marcarEnviada=async function(id){
   return window.revisarSolicitudDocumento(id);
 };
 window.adminSolicitudes=async function(){
   if(!isReal()||!['Administrador General','Administrador de Plataforma'].includes(currentUser.rol))return original.adminSolicitudes();
   await refreshSharedAdmin();
   await window.comprobarEntregaSolicitudes();
   const c=document.getElementById('admincontent'),a=getSolicitudes();if(!c)return;
   const groups=[];
   for(const x of a){
     if(groups.some(g=>g.some(y=>String(y.id)===String(x.id))))continue;
     groups.push(solicitudGrupo(x.id));
   }
   c.innerHTML='<div class="kicker">Registro de interés</div><h1 class="section-title">Solicitudes documentos de biblioteca</h1>'+
    '<div class="notice">Revise qué se solicitó antes de enviar. El sistema muestra únicamente dos estados de despacho: <b>Enviado</b> y <b>Entregado</b>.</div><br>'+
    (groups.length?groups.map(g=>{
      const x=g[0],allDelivered=g.every(y=>y.estado==='Entregado'),allSent=g.every(y=>['Enviada','Entregado'].includes(y.estado));
      const estado=allDelivered?'Entregado':allSent?'Enviado':'Pendiente';
      const uniqueDocs=solicitudDocumentosUnicos(g);
      const names=uniqueDocs.map(y=>y.titulo).join(' · ');
      return '<div class="card" style="margin:12px 0"><div class="row"><div><b>'+esc(x.nombre)+'</b> · '+esc(x.correo)+'<br><small>'+esc(x.fecha)+(x.institucion?' · '+esc(x.institucion):'')+'</small><p style="margin:8px 0 0"><b>'+uniqueDocs.length+' documento(s):</b> '+esc(names)+'</p>'+(x.copyEmail?'<small>Copia administrativa: '+esc(x.copyEmail)+'</small>':'')+'</div><div><span class="pill '+(estado==='Entregado'?'green':estado==='Enviado'?'amber':'')+'">'+estado+'</span><br><button class="btn soft" style="margin-top:8px" onclick="revisarSolicitudDocumento('+x.id+')">'+(allSent?'Ver envío':'Revisar y enviar')+'</button></div></div></div>';
    }).join(''):'<div class="card"><p>Aún no hay solicitudes registradas.</p></div>');
 };
 window.publicarSolicitud=async function(id){
   if(!isReal())return original.publicarSolicitud(id);
   const cached=getPubRequests().find(a=>a.id===id);if(!cached)return;
   const tema=prompt('Tema para clasificar en Biblioteca:',cached.mesa);if(tema===null)return;
   const description=prompt('Descripción pública:','Documento técnico autorizado por la Mesa.');if(description===null)return;
   let uploadedPath='';
   try{
     // Leer la solicitud directamente desde Supabase justo antes de generar
     // el PDF. Así Administración publica exactamente el snapshot inmutable
     // que fue enviado por la Coordinación, no una copia antigua del navegador.
     const {data:req,error:reqError}=await sbAuth.from('publication_requests')
       .select('id,technical_table_id,title,version,snapshot,status,requested_at,requested_by')
       .eq('id',id).single();
     if(reqError)throw reqError;
     if(req.status!=='Pendiente')throw new Error('La solicitud ya no está pendiente.');

     const mesa=Object.keys(STATE.ids).find(m=>String(STATE.ids[m])===String(req.technical_table_id))||cached.mesa;
     const source={
       ...copy(req.snapshot||{}),
       id:0,
       mesa,
       titulo:req.title,
       version:req.version||1,
       contenido:copy(req.snapshot?.contenido||{}),
       referencias:copy(req.snapshot?.referencias||[]),
       revisiones:copy(req.snapshot?.revisiones||[]),
       fechaPublicacion:new Date().toLocaleDateString('es-CL'),
       estado:'Aprobado',
       borrador:false
     };
     const finalPdf=await generarAdjuntoPDFFinalBiblioteca(source);
     const safeFile=finalPdf.filename.replace(/[^a-zA-Z0-9._-]+/g,'_');
     uploadedPath=STATE.uid+'/biblioteca/solicitud-'+id+'-'+Date.now()+'/'+safeFile;
     const upload=await sbAuth.storage.from('frente-documentos').upload(uploadedPath,finalPdf.blob,{
       contentType:'application/pdf',upsert:false
     });
     if(upload.error)throw upload.error;

     const {data:libraryId,error}=await sbAuth.rpc('publish_publication_request_with_pdf',{
       p_request_id:id,
       p_topic:tema,
       p_description:description,
       p_pdf_path:uploadedPath,
       p_pdf_name:finalPdf.filename,
       p_pdf_size_bytes:finalPdf.size
     });
     if(error)throw error;
     await refreshSharedAdmin();await window.loadPublicLibrary();await window.adminPublicaciones();
     alert('Documento publicado. El PDF final oficial quedó guardado en Biblioteca y será el mismo archivo que se visualizará, descargará y enviará por correo.');
   }catch(error){
     console.error(error);
     if(uploadedPath){
       try{await sbAuth.storage.from('frente-documentos').remove([uploadedPath])}catch(e){console.warn('No se pudo limpiar el PDF temporal',e)}
     }
     alert('No se pudo completar la publicación del documento final. No se publicará sin su PDF oficial.');
   }
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
   if(!isReal()||!['Administrador General','Administrador de Plataforma'].includes(currentUser.rol))return;
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
   const body=STUDY_SECTION_NAMES.map(n=>'<h3>'+esc(studyLabel(n))+'</h3><div>'+(sections[n]||'<p class="muted">Sin contenido.</p>')+'</div>').join('');const revs=Array.isArray(s.revisiones)?s.revisiones:[];const reviewBlock='<h2>Revisión técnica</h2>'+(revs.length?'<ul>'+revs.map(r=>'<li><b>'+esc(r.nombre||'')+'</b> — '+esc(r.profesion||'Profesión no registrada')+' · '+esc(r.cargo||'Integrante de Mesa')+'</li>').join('')+'</ul>':'<p class="muted">Sin vistos buenos registrados.</p>');
   const w=window.open('','_blank');
   if(!w)return alert('El navegador bloqueó la vista. Habilite ventanas emergentes para revisar el documento.');
   w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>'+esc(x.titulo)+'</title><style>body{font-family:Arial,sans-serif;max-width:900px;margin:40px auto;padding:0 24px;line-height:1.6}h1,h2,h3{color:#123b67}.meta{background:#f4f7fb;padding:14px;border-radius:10px}</style></head><body><h1>'+esc(x.titulo)+'</h1><div class="meta"><b>Mesa:</b> '+esc(x.mesa)+' · <b>Versión:</b> '+esc(x.version)+' · <b>Solicitado por:</b> '+esc(x.solicitante||'Coordinación')+'</div>'+body+reviewBlock+'</body></html>');
   w.document.close();
 };

 async function cargarMisAportes(){
   if(!isReal())return [];
   const {data,error}=await sbAuth.from('individual_contributions')
     .select('id,title,document_type,topic,summary,body,status,version,versions,review_observation,admin_observation,created_at,updated_at')
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
     (rows.length?rows.map(x=>'<div class="row"><div><b>'+esc(x.title||'Sin título')+'</b><br><small>'+esc(x.document_type)+' · '+esc(x.topic)+' · Versión '+x.version+' · '+esc(x.status)+' · '+new Date(x.updated_at).toLocaleString('es-CL')+'</small>'+(x.review_observation?'<p class="muted"><b>Observación de Coordinación:</b> '+esc(x.review_observation)+'</p>':'')+(x.admin_observation?'<p class="muted"><b>Observación de Administración:</b> '+esc(x.admin_observation)+'</p>':'')+'</div><div><button class="btn soft" onclick="editarAporteIndividual('+x.id+')">Abrir</button> '+(x.status==='Retirado de publicación'?'<button class="btn success" onclick="reabrirAporteIndividual('+x.id+')">Iniciar nueva versión</button>':'')+'</div></div>').join(''):'<div class="card"><p>Aún no ha creado aportes individuales.</p></div>');
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
 async function cargarMesasRevisionAportes(){
   if(Array.isArray(STATE.reviewTables))return STATE.reviewTables;
   const [{data:tables,error},{data:coords,error:coordError}]=await Promise.all([
     sbAuth.from('technical_tables').select('id,name,is_active').eq('is_active',true).order('name'),
     sbAuth.from('table_memberships').select('technical_table_id').eq('is_coordinator',true)
   ]);
   if(error||coordError){console.error(error||coordError);STATE.reviewTables=[];return []}
   const withCoordinator=new Set((coords||[]).map(x=>String(x.technical_table_id)));
   STATE.reviewTables=(tables||[]).filter(t=>withCoordinator.has(String(t.id)));
   return STATE.reviewTables;
 }
 async function resumenRevisionAporte(contributionId){
   const {data:reqs,error}=await sbAuth.from('individual_review_requests')
     .select('id,technical_table_id,requested_by,status,version,requested_at,closed_at,coordinator_observation,technical_tables(name)')
     .eq('contribution_id',contributionId).order('requested_at',{ascending:false}).limit(1);
   if(error||!reqs?.length)return null;
   const r=reqs[0];
   const {data:feedback}=await sbAuth.from('individual_review_feedback')
     .select('id,profile_id,feedback_type,message,created_at,profiles(full_name,profession)')
     .eq('review_request_id',r.id).order('created_at',{ascending:true});
   return {...r,feedback:feedback||[]};
 }
 function resumenRevisionAporteHTML(r){
   if(!r)return '';
   const vistos=(r.feedback||[]).filter(x=>x.feedback_type==='Visto bueno');
   const mensajes=(r.feedback||[]).filter(x=>x.feedback_type==='Mensaje');
   return '<div class="notice" style="margin-top:14px"><b>Revisión de la Mesa '+esc(r.technical_tables?.name||'')+'</b><br>'+
     '<span class="pill '+(r.status==='Validada'?'green':'amber')+'">'+esc(r.status)+'</span> · Versión '+esc(String(r.version))+
     ' · '+vistos.length+' visto'+(vistos.length===1?' bueno':'s buenos')+' · '+mensajes.length+' mensaje'+(mensajes.length===1?'':'s')+
     (r.coordinator_observation?'<p><b>Observación de Coordinación:</b> '+esc(r.coordinator_observation)+'</p>':'')+
     (vistos.length?'<div style="margin-top:8px"><b>Vistos buenos:</b><ul>'+vistos.map(v=>'<li>'+esc(v.profiles?.full_name||'Integrante')+(v.profiles?.profession?' · '+esc(v.profiles.profession):'')+'</li>').join('')+'</ul></div>':'')+
     (mensajes.length?'<div><b>Mensajes:</b><ul>'+mensajes.map(v=>'<li><b>'+esc(v.profiles?.full_name||'Integrante')+':</b> '+esc(v.message||'')+'</li>').join('')+'</ul></div>':'')+
     '</div>';
 }
 window.editarAporteIndividual=async function(id){
   let x=aporteActual(id);
   if(!x){await cargarMisAportes();x=aporteActual(id);if(!x)return}
   const box=document.getElementById('aporteEditor');if(!box)return;
   const tables=await cargarMesasRevisionAportes();
   const review=await resumenRevisionAporte(id);
   const locked=['En revisión de Mesa','Solicitud de publicación','Publicado','Retirado de publicación'].includes(x.status);
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
     (x.review_observation?'<div class="notice" style="margin-top:12px"><b>Observación de Coordinación:</b> '+esc(x.review_observation)+'</div>':'')+
     (x.admin_observation?'<div class="notice" style="margin-top:12px"><b>Observación de Administración:</b> '+esc(x.admin_observation)+'</div>':'')+
     resumenRevisionAporteHTML(review)+
     (!locked&&!editing?(tables.length?'<div class="form-row" style="margin-top:14px"><div><label>Mesa Técnica que revisará este aporte</label><select id="aporteMesaRevision">'+tables.map(t=>'<option value="'+t.id+'" '+(t.name===x.topic?'selected':'')+'>'+esc(t.name)+'</option>').join('')+'</select><div class="mini-note" style="margin-top:6px">Solo aparecen Mesas activas que tienen Coordinador/a asignado/a.</div></div></div>':'<div class="notice" style="margin-top:14px">No hay una Mesa Técnica activa con Coordinador/a disponible para revisar este aporte. Administración debe asignar una Coordinación antes de enviarlo.</div>'):'')+
     '<div class="toolbar-row" style="margin-top:14px">'+
       (editing?'<button class="btn primary" onclick="finalizarEdicionAporte('+x.id+')">Finalizar edición</button> <button class="btn soft" onclick="guardarAporteIndividual('+x.id+',false)">Guardar borrador</button> <button class="btn success" onclick="guardarAporteIndividual('+x.id+',true)">Guardar versión</button>':'')+
       (!locked&&!editing?'<button class="btn primary" onclick="iniciarEdicionAporte('+x.id+')">Editar</button> '+(tables.length?'<button class="btn success" onclick="solicitarRevisionAporte('+x.id+')">Solicitar revisión</button>':''):'')+
       (review&&review.status==='En revisión'&&review.requested_by===STATE.uid?' <button class="btn danger" onclick="cancelarRevisionAporte('+review.id+')">Cancelar revisión y volver a editar</button>':'')+
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
   await cargarMisAportes();
   STATE.editingContribution=id;
   await editarAporteIndividual(id);
   alert('Versión '+n+' recuperada como borrador y abierta para edición. Guarde una nueva versión cuando termine de revisarla.');
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
 window.solicitarRevisionAporte=async function(id){
   const x=aporteActual(id);if(!x)return;
   if(x.status!=='En elaboración')return alert('Este aporte no está disponible para una nueva revisión.');
   if(STATE.editingContribution===id)return alert('Finalice la edición antes de solicitar revisión.');
   if(!String(x.title||'').trim()||!String(x.body||'').replace(/<[^>]*>/g,'').trim())return alert('El aporte debe tener título y contenido antes de enviarlo.');
   const mesaId=Number(document.getElementById('aporteMesaRevision')?.value||0);
   if(!mesaId)return alert('Seleccione la Mesa Técnica que revisará el aporte.');
   const {error}=await sbAuth.rpc('submit_individual_review',{p_contribution_id:id,p_technical_table_id:mesaId});
   if(error){console.error(error);return alert(/already pending/i.test(String(error.message||''))?'Ya existe una revisión pendiente.':'No se pudo enviar la solicitud de revisión.')}
   STATE.editingContribution=null;
   await renderAportes(document.getElementById('privatecontent'));
   alert('Solicitud enviada a la Mesa Técnica. Los integrantes podrán dar visto bueno o dejar mensajes. La Coordinación deberá validar la revisión antes de enviarla a Administración.');
 };
 window.cancelarRevisionAporte=async function(reviewId){
   if(!isReal())return;
   if(!confirm('¿Cancelar esta revisión y volver el aporte a En elaboración? Los vistos buenos o mensajes ya registrados quedarán en el historial de la revisión cancelada.'))return;
   try{
     const {error}=await sbAuth.rpc('cancel_individual_review',{p_review_request_id:Number(reviewId)});
     if(error)throw error;
     STATE.editingContribution=null;
     await renderAportes(document.getElementById('privatecontent'));
     alert('Revisión cancelada. El aporte volvió a En elaboración y puede editarlo nuevamente.');
   }catch(e){console.error(e);alert('No se pudo cancelar la revisión. Inténtelo nuevamente.');}
 };
 window.solicitarPublicacionAporte=window.solicitarRevisionAporte;
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
 async function cargarRevisionesAportesMesa(){
   const {data,error}=await sbAuth.from('individual_review_requests')
     .select('id,contribution_id,technical_table_id,requested_by,version,snapshot,status,coordinator_observation,requested_at,closed_at,validated_by,technical_tables(name)')
     .order('requested_at',{ascending:false});
   if(error){console.error(error);return []}
   const rows=data||[];
   if(!rows.length)return [];
   const ids=rows.map(x=>x.id);
   const {data:fb,error:fbErr}=await sbAuth.from('individual_review_feedback')
     .select('id,review_request_id,profile_id,feedback_type,message,created_at,profiles(full_name,profession)')
     .in('review_request_id',ids).order('created_at',{ascending:true});
   if(fbErr)console.warn(fbErr);
   return rows.map(r=>({...r,feedback:(fb||[]).filter(x=>x.review_request_id===r.id)}));
 }
 window.renderRevisionAportes=async function(container){
   const c=container||document.getElementById('privatecontent');if(!c)return;
   if(!isReal()){c.innerHTML='<div class="notice">Ingrese con una cuenta real para revisar aportes.</div>';return}
   c.innerHTML='<div class="kicker">Revisión colaborativa</div><h1 class="section-title">Revisión de aportes</h1><p class="muted">Cargando solicitudes…</p>';
   const rows=await cargarRevisionesAportesMesa();
   STATE.reviewContributionRows=rows;
   const assigned=getAssignedMesas();
   const visibles=rows.filter(r=>assigned.includes(r.technical_tables?.name)||r.requested_by===STATE.uid);
   c.innerHTML='<div class="kicker">Revisión colaborativa</div><h1 class="section-title">Revisión de aportes</h1>'+
     '<div class="notice"><b>Privacidad por Mesa:</b> cada revisión solo puede ser vista por los integrantes de la Mesa Técnica revisora, por el autor de ese aporte y por Administración. Los integrantes de otras Mesas no tienen acceso. Dentro de la Mesa revisora, sus integrantes pueden <b>dar visto bueno</b> o <b>dejar un mensaje</b>. Solo la Coordinación de esa Mesa puede cerrar la revisión y enviarla a Administración.</div><br>'+
     (visibles.length?visibles.map(r=>{
       const mesa=r.technical_tables?.name||'';
       const vistos=(r.feedback||[]).filter(x=>x.feedback_type==='Visto bueno');
       const mensajes=(r.feedback||[]).filter(x=>x.feedback_type==='Mensaje');
       const mine=vistos.some(x=>x.profile_id===STATE.uid);
       const coord=/Coordinador/.test(getRoleForMesa(mesa));
       const open=r.status==='En revisión';
       return '<div class="card" style="margin-bottom:14px"><div class="row"><div><span class="pill amber">'+esc(mesa)+'</span> <b>'+esc(r.snapshot?.title||'Aporte individual')+'</b><br><small>Autor: '+esc(r.snapshot?.author_name||'Profesional')+(r.snapshot?.author_profession?' · '+esc(r.snapshot.author_profession):'')+' · '+esc(r.snapshot?.document_type||'')+' · Versión '+r.version+' · '+new Date(r.requested_at).toLocaleString('es-CL')+'</small><br><small><b>'+vistos.length+'</b> vistos buenos · <b>'+mensajes.length+'</b> mensajes · Estado: '+esc(r.status)+'</small></div></div>'+
       '<div class="toolbar-row" style="margin-top:12px"><button class="btn soft" onclick="verRevisionAporte('+r.id+')">Ver aporte</button>'+
       (open&&assigned.includes(mesa)?' <button class="btn success" '+(mine?'disabled':'')+' onclick="darVistoBuenoAporte('+r.id+')">'+(mine?'✓ Visto bueno registrado':'✓ Dar visto bueno')+'</button> <button class="btn soft" onclick="mensajeRevisionAporte('+r.id+')">💬 Dejar mensaje</button>':'')+
       (open&&coord?' <button class="btn primary" onclick="coordinadorEnviarAporte('+r.id+')">Validar y solicitar publicación</button> <button class="btn soft" onclick="coordinadorDevolverAporte('+r.id+')">Devolver al autor</button>':'')+
       '</div>'+
       ((r.feedback||[]).length?'<div style="margin-top:12px"><b>Actividad de revisión</b><ul>'+r.feedback.map(f=>'<li>'+esc(f.profiles?.full_name||'Integrante')+' · '+esc(f.feedback_type)+(f.message?': '+esc(f.message):'')+' · '+new Date(f.created_at).toLocaleString('es-CL')+'</li>').join('')+'</ul></div>':'')+
       (r.coordinator_observation?'<div class="mini-note"><b>Observación de Coordinación:</b> '+esc(r.coordinator_observation)+'</div>':'')+
       '</div>';
     }).join(''):'<div class="card"><p>No hay aportes en revisión para sus Mesas.</p></div>');
 };
 window.verRevisionAporte=function(id){
   const r=(STATE.reviewContributionRows||[]).find(x=>x.id===id);if(!r)return;
   const mesa=r.technical_tables?.name||'';
   const admin=['Administrador General','Administrador de Plataforma'].includes(currentUser?.rol);
   const allowed=admin||r.requested_by===STATE.uid||getAssignedMesas().includes(mesa);
   if(!allowed)return alert('No tiene permiso para ver este aporte. La revisión pertenece a otra Mesa Técnica.');
   const s=r.snapshot||{},w=window.open('','_blank');if(!w)return alert('El navegador bloqueó la vista.');
   w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>'+esc(s.title||'Aporte')+'</title><style>body{font-family:Arial,sans-serif;max-width:900px;margin:40px auto;padding:0 24px;line-height:1.7}.meta{background:#f4f7fb;padding:14px;border-radius:10px}h1,h2,h3{color:#123b67}</style></head><body><h1>'+esc(s.title||'Aporte individual')+'</h1><div class="meta"><b>Autor:</b> '+esc(s.author_name||'')+(s.author_profession?' · '+esc(s.author_profession):'')+' · <b>Mesa revisora:</b> '+esc(r.technical_tables?.name||'')+' · <b>Versión:</b> '+r.version+'</div>'+(s.summary?'<h2>Resumen</h2><p>'+esc(s.summary)+'</p>':'')+'<hr><div>'+safeRichHTML(s.body||'')+'</div></body></html>');
   w.document.close();
 };
 window.darVistoBuenoAporte=async function(id){
   const {error}=await sbAuth.rpc('give_individual_review_approval',{p_review_request_id:id});
   if(error){console.error(error);return alert('No se pudo registrar el visto bueno.')}
   await renderRevisionAportes(document.getElementById('privatecontent'));
 };
 window.mensajeRevisionAporte=async function(id){
   const msg=prompt('Escriba su mensaje u observación para el autor y la Mesa:');if(msg===null)return;
   if(!msg.trim())return alert('Escriba un mensaje.');
   const {error}=await sbAuth.rpc('add_individual_review_message',{p_review_request_id:id,p_message:msg.trim()});
   if(error){console.error(error);return alert('No se pudo guardar el mensaje.')}
   await renderRevisionAportes(document.getElementById('privatecontent'));
 };
 window.coordinadorEnviarAporte=async function(id){
   if(!confirm('¿Cerrar la revisión de la Mesa y enviar esta versión a Administración para publicación?'))return;
   const {error}=await sbAuth.rpc('coordinator_submit_individual_publication',{p_review_request_id:id});
   if(error){console.error(error);return alert('No se pudo enviar a Administración. Verifique que usted sea Coordinador/a de esta Mesa.')}
   await renderRevisionAportes(document.getElementById('privatecontent'));
   alert('Revisión validada. La solicitud de publicación fue enviada a Administración.');
 };
 window.coordinadorDevolverAporte=async function(id){
   const obs=prompt('Indique la observación para devolver el aporte al autor:');if(obs===null)return;
   if(!obs.trim())return alert('Debe registrar una observación.');
   const {error}=await sbAuth.rpc('return_individual_review',{p_review_request_id:id,p_observation:obs.trim()});
   if(error){console.error(error);return alert('No se pudo devolver el aporte.')}
   await renderRevisionAportes(document.getElementById('privatecontent'));
   alert('El aporte fue devuelto al autor para correcciones.');
 };
 window.adminPublicaciones=async function(){
   const c=document.getElementById('admincontent');if(!c)return;
   if(!isReal()||!['Administrador General','Administrador de Plataforma'].includes(currentUser.rol)){c.innerHTML='<div class="notice">Esta sección requiere Administración General.</div>';return}
   await refreshSharedAdmin();
   const [ir,profiles,libs]=await Promise.all([
     sbAuth.from('individual_publication_requests').select('*').order('requested_at',{ascending:false}),
     sbAuth.from('profiles').select('id,full_name,email,profession'),
     sbAuth.from('public_library').select('id,title,topic,published_at,is_public,withdrawn_at,withdrawal_reason,publication_request_id,technical_table_id,origin_type,author_name,source_contribution_id').order('published_at',{ascending:false})
   ]);
   if(ir.error||profiles.error||libs.error){console.error(ir.error||profiles.error||libs.error);c.textContent='No se pudo consultar el flujo de publicaciones.';return}
   STATE.individualRequests=ir.data||[];
   const people=profiles.data||[];
   const reqs=getPubRequests().filter(x=>x.estado==='Pendiente');
   const individualPending=(ir.data||[]).filter(x=>x.status==='Pendiente');
   c.innerHTML='<div class="kicker">Difusión pública</div><h1 class="section-title">Solicitudes de publicación</h1>'+
     '<div class="notice">La plataforma distingue entre <b>Documentos de Mesa Técnica</b> y <b>Aportes individuales</b>. Los aportes individuales solo llegan aquí después de la revisión y validación de su Mesa Técnica. Administración revisa la versión exacta validada antes de publicarla o devolverla.</div>'+
     '<h2 class="section-sub">Documentos de Mesa pendientes</h2>'+
     (reqs.length?reqs.map(x=>'<div class="row"><div><span class="pill green">Documento de Mesa</span> <b>'+esc(x.titulo)+'</b><br><small>Mesa '+esc(x.mesa)+' · Versión '+esc(x.version)+' · '+esc(x.solicitante||'Coordinación')+' · '+esc(x.fecha)+'</small></div><div><button class="btn soft" onclick="verSolicitudPublicacion('+x.id+')">Ver documento</button> <button class="btn primary" onclick="publicarSolicitud('+x.id+')">Publicar</button> <button class="btn soft" onclick="rechazarSolicitudPublicacion('+x.id+')">Devolver</button></div></div>').join(''):'<div class="card"><p>No hay documentos de Mesa pendientes.</p></div>')+
     '<h2 class="section-sub">Aportes individuales pendientes</h2>'+
     (individualPending.length?individualPending.map(x=>{const a=people.find(p=>p.id===x.requested_by);return '<div class="row"><div><span class="pill amber">Aporte individual</span> <b>'+esc(x.title)+'</b><br><small>Autor: '+esc(a?.full_name||'Profesional')+(a?.profession?' · '+esc(a.profession):'')+' · '+esc(x.snapshot?.document_type||'')+' · '+esc(x.snapshot?.topic||'')+' · Versión '+x.version+' · '+((x.snapshot?.reviewers||[]).length)+' vistos buenos · '+new Date(x.requested_at).toLocaleString('es-CL')+'</small></div><div><button class="btn soft" onclick="verSolicitudAporteIndividual('+x.id+')">Ver aporte</button> <button class="btn primary" onclick="publicarAporteIndividual('+x.id+')">Publicar</button> <button class="btn soft" onclick="devolverAporteIndividual('+x.id+')">Devolver</button></div></div>'}).join(''):'<div class="card"><p>No hay aportes individuales pendientes.</p></div>')+
     '<h2 class="section-sub">Historial de Biblioteca</h2>'+
     ((libs.data||[]).length?(libs.data||[]).map(p=>'<div class="row"><div><span class="pill '+(p.origin_type==='Aporte individual'?'amber':'green')+'">'+esc(p.origin_type||'Documento de Mesa')+'</span> <b>'+esc(p.title)+'</b><br><small>'+esc(p.topic)+' · '+(p.author_name?'Autor: '+esc(p.author_name)+' · ':'')+new Date(p.published_at).toLocaleDateString('es-CL')+(p.withdrawn_at?' · Retirado '+new Date(p.withdrawn_at).toLocaleDateString('es-CL'):'')+(p.withdrawal_reason?' · '+esc(p.withdrawal_reason):'')+'</small></div><div><span class="pill '+(p.is_public?'green':'amber')+'">'+(p.is_public?'PUBLICADO':'RETIRADO DE PUBLICACIÓN')+'</span> '+(p.is_public?'<button class="btn danger" onclick="retirarPublicacion('+p.id+')">Retirar de publicación</button>':'')+'</div></div>').join(''):'<div class="card"><p>Aún no hay documentos en el historial de Biblioteca.</p></div>');
 };

 function coordinatorMesas(){
   return getAssignedMesas().filter(m=>/Coordinador/i.test(getRoleForMesa(m)));
 }
 window.renderInvitacionesIntegrantes=async function(container){
   const c=container||document.getElementById('privatecontent');if(!c)return;
   if(!isReal()){c.innerHTML='<div class="notice">Ingrese con una cuenta real para gestionar incorporaciones.</div>';return}
   const mesasCoord=coordinatorMesas();
   if(!mesasCoord.length){c.innerHTML='<div class="notice">Esta sección está disponible para Coordinadores de Mesa.</div>';return}
   const {data,error}=await sbAuth.from('member_invitation_requests')
     .select('id,full_name,email,profession,phone,technical_table_id,proposed_role,status,requested_at,rejection_reason,technical_tables(name)')
     .eq('requested_by',STATE.uid).order('requested_at',{ascending:false});
   if(error){console.error(error);c.innerHTML='<div class="notice">No fue posible consultar las solicitudes de incorporación.</div>';return}
   const options=mesasCoord.map(m=>'<option value="'+esc(String(mesaId(m)))+'">'+esc(m)+'</option>').join('');
   c.innerHTML='<div class="kicker">Coordinación de Mesa</div><h1 class="section-title">Nuevos integrantes</h1>'+
    '<div class="notice">La Coordinación propone la incorporación. Administración revisa la solicitud y, si la aprueba, envía la invitación al profesional.</div><br>'+
    '<div class="card form" style="max-width:720px"><h3>Solicitar incorporación</h3>'+
    '<label>Nombre completo</label><input id="invName" autocomplete="name">'+
    '<label>Correo electrónico</label><input id="invEmail" type="email" autocomplete="email">'+
    '<label>Profesión</label><input id="invProfession" autocomplete="organization-title">'+
    '<label>Teléfono <span class="muted">(opcional)</span></label><input id="invPhone" autocomplete="tel">'+
    '<label>Mesa Técnica</label><select id="invMesa">'+options+'</select>'+
    '<label>Rol propuesto</label><select id="invRole"><option>Integrante de Mesa</option><option>Secretario Técnico</option></select>'+
    '<button id="invSubmitBtn" class="btn primary" onclick="solicitarNuevoIntegrante()">Enviar solicitud a Administración</button><p id="invStatus" class="muted"></p></div>'+
    '<h2 class="section-sub">Mis solicitudes</h2>'+
    ((data||[]).length?(data||[]).map(x=>'<div class="row"><div><b>'+esc(x.full_name)+'</b> · '+esc(x.email)+'<br><small>'+esc(x.technical_tables?.name||'Mesa')+' · '+esc(x.proposed_role)+' · '+new Date(x.requested_at).toLocaleString('es-CL')+(x.rejection_reason?' · '+esc(x.rejection_reason):'')+'</small></div><span class="pill '+(x.status==='Cuenta activada'?'green':x.status==='Rechazada'?'amber':'')+'">'+esc(x.status)+'</span></div>').join(''):'<div class="card"><p>Aún no ha enviado solicitudes de incorporación.</p></div>');
 };
 window.solicitarNuevoIntegrante=async function(){
   if(!isReal())return;
   const name=document.getElementById('invName')?.value.trim()||'',
     email=document.getElementById('invEmail')?.value.trim().toLowerCase()||'',
     profession=document.getElementById('invProfession')?.value.trim()||'',
     phone=document.getElementById('invPhone')?.value.trim()||'',
     technical_table_id=Number(document.getElementById('invMesa')?.value),
     proposed_role=document.getElementById('invRole')?.value||'Integrante de Mesa',
     status=document.getElementById('invStatus'),btn=document.getElementById('invSubmitBtn');
   if(!name||!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)||!technical_table_id){status.textContent='Complete nombre, correo válido y Mesa.';return}
   btn.disabled=true;btn.textContent='Enviando…';status.textContent='';
   try{
     const {data,error}=await sbAuth.functions.invoke('member-invitation',{body:{action:'submit',full_name:name,email,profession,phone,technical_table_id,proposed_role}});
     if(error)throw error;if(!data?.ok)throw new Error(data?.error||'No fue posible registrar la solicitud.');
     status.style.color='#2e7d62';status.textContent='Solicitud enviada a Administración.';
     await window.renderInvitacionesIntegrantes(document.getElementById('privatecontent'));
   }catch(e){
     console.error(e);status.style.color='#a3352a';status.textContent=e?.message||'No fue posible enviar la solicitud.';
   }finally{if(btn){btn.disabled=false;btn.textContent='Enviar solicitud a Administración';}}
 };
 window.adminInvitaciones=async function(){
   const c=document.getElementById('admincontent');if(!c)return;
   if(!isReal()||!['Administrador General','Administrador de Plataforma'].includes(currentUser.rol)){c.innerHTML='<div class="notice">Se requiere una cuenta administrativa.</div>';return}
   const [{data:rows,error},{data:profiles}]=await Promise.all([
     sbAuth.from('member_invitation_requests')
       .select('id,full_name,email,profession,phone,technical_table_id,proposed_role,status,requested_by,requested_at,reviewed_at,invitation_sent_at,rejection_reason,email_provider_id,email_delivery_status,delivered_at,registered_at,technical_tables(name)')
       .order('requested_at',{ascending:false}),
     sbAuth.from('profiles').select('id,full_name,email')
   ]);
   if(error){console.error(error);c.innerHTML='<div class="notice">No fue posible consultar las invitaciones.</div>';return}
   const who=id=>(profiles||[]).find(p=>String(p.id)===String(id));
   const sent=(rows||[]).filter(x=>!x.technical_table_id&&x.invitation_sent_at);
   const requests=(rows||[]).filter(x=>x.technical_table_id);
   const fmt=d=>d?new Date(d).toLocaleString('es-CL'):'—';
   // Para cada correo, solo la invitación más reciente asociada al registro
   // puede mostrarse como “Registro completado”. Las anteriores conservan su
   // valor histórico y se identifican como “Invitación anterior”.
   const completedRowByEmail=new Map();
   for(const x of sent){
     if(!x.registered_at)continue;
     const key=String(x.email||'').trim().toLowerCase();
     const current=completedRowByEmail.get(key);
     if(!current||new Date(x.invitation_sent_at||0)>new Date(current.invitation_sent_at||0))completedRowByEmail.set(key,x);
   }
   const regView=x=>{
     const key=String(x.email||'').trim().toLowerCase();
     const selected=completedRowByEmail.get(key);
     if(x.registered_at&&selected&&String(selected.id)===String(x.id))return {label:'Registro completado',date:x.registered_at,green:true};
     if(selected&&new Date(x.invitation_sent_at||0)<new Date(selected.invitation_sent_at||0))return {label:'Invitación anterior',date:null,green:false};
     return {label:'Pendiente de registro',date:null,green:false};
   };
   c.innerHTML='<div class="kicker">Administración</div><h1 class="section-title">Invitaciones de integrantes</h1>'+
    '<div class="notice"><b>Seguimiento de la invitación:</b> “Estado del correo” indica únicamente si el mensaje fue enviado, entregado o tuvo un problema de entrega. “Estado del registro” cambia a “Registro completado” solo cuando la persona entra a la plataforma y finaliza la creación de su acceso. Posteriormente, Administración asigna Mesa Técnica y rol según la constitución de la Mesa.</div><br>'+
    '<button class="btn primary" onclick="adminInvitacionDirecta()">＋ Invitar directamente</button> <button id="btnActualizarInvitaciones" class="btn soft" onclick="actualizarEstadosInvitaciones()">↻ Actualizar estados</button> <span id="estadoActualizacionInvitaciones" class="muted" style="margin-left:8px">'+esc(window._inviteRefreshMessage||'')+'</span>'+
    '<h2 class="section-sub">Registro de invitaciones enviadas</h2>'+
    (sent.length?'<div style="overflow:auto"><table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid var(--line);border-radius:12px;overflow:hidden"><thead><tr style="text-align:left;background:#f7f9fc"><th style="padding:10px">Fecha invitación</th><th style="padding:10px">Correo</th><th style="padding:10px">Estado del correo</th><th style="padding:10px">Estado del registro</th><th style="padding:10px">Fecha de registro</th></tr></thead><tbody>'+
      sent.map(x=>{const rv=regView(x);return '<tr style="border-top:1px solid var(--line)"><td style="padding:10px">'+esc(fmt(x.invitation_sent_at||x.requested_at))+'</td><td style="padding:10px"><b>'+esc(x.email)+'</b></td><td style="padding:10px"><span class="pill '+(x.email_delivery_status==='Entregado'?'green':/Fallido|Rebotado|Reclamado|Suprimido/.test(x.email_delivery_status||'')?'amber':'')+'">'+esc(x.email_delivery_status||'Enviado')+'</span></td><td style="padding:10px"><span class="pill '+(rv.green?'green':'')+'">'+esc(rv.label)+'</span></td><td style="padding:10px">'+esc(rv.date?fmt(rv.date):'—')+'</td></tr>'}).join('')+
      '</tbody></table></div>':'<div class="card"><p>No hay invitaciones enviadas todavía.</p></div>')+
    '<h2 class="section-sub">Solicitudes recibidas</h2>'+
    (requests.length?requests.map(x=>{
      const r=who(x.requested_by),pending=x.status==='Pendiente';
      return '<div class="card" style="margin:12px 0"><div class="row"><div><b>'+esc(x.full_name||x.email)+'</b> · '+esc(x.email)+'<br><small>'+esc(x.profession||'Profesión no indicada')+(x.phone?' · '+esc(x.phone):'')+' · '+esc(x.technical_tables?.name||'Mesa')+' · '+esc(x.proposed_role||'Rol por definir')+'</small><br><small>Solicitado por: '+esc(r?.full_name||'Administración')+' · '+fmt(x.requested_at)+'</small>'+(x.rejection_reason?'<p class="muted"><b>Motivo:</b> '+esc(x.rejection_reason)+'</p>':'')+'</div><div><span class="pill '+(x.status==='Registro completado'?'green':x.status==='Rechazada'?'amber':'')+'">'+esc(x.status)+'</span>'+(pending?'<br><button class="btn primary" style="margin-top:8px" onclick="aprobarInvitacionIntegrante('+x.id+')">Aprobar y enviar invitación</button> <button class="btn soft" style="margin-top:8px" onclick="rechazarInvitacionIntegrante('+x.id+')">Rechazar</button>':'')+'</div></div></div>';
    }).join(''):'<div class="card"><p>No hay solicitudes de incorporación.</p></div>');
 };
 window.actualizarEstadosInvitaciones=async function(){
   const btn=document.getElementById('btnActualizarInvitaciones'),msg=document.getElementById('estadoActualizacionInvitaciones');
   if(btn){btn.disabled=true;btn.textContent='Actualizando…'}
   window._inviteRefreshMessage='Consultando estado real de correos y registros…';
   if(msg)msg.textContent=window._inviteRefreshMessage;
   try{
     const {data,error}=await sbAuth.functions.invoke('member-invitation',{body:{action:'check_delivery'}});
     if(error)throw error;
     if(!data?.ok)throw new Error(data?.error||'No fue posible actualizar.');
     const parts=[];
     if(Number(data.updated||0)>0)parts.push(data.updated+' correo(s) actualizado(s)');
     if(Number(data.registered_updated||0)>0)parts.push(data.registered_updated+' registro(s) completado(s)');
     const hora=new Date().toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'});
     const checked=Number(data.checked||0);
     window._inviteRefreshMessage=parts.length
       ?'Actualizado '+hora+': '+parts.join(' · ')
       :'Actualización completada '+hora+'. '+checked+' correo(s) revisado(s); sin cambios nuevos.';
     if(msg)msg.textContent=window._inviteRefreshMessage;
     await window.adminInvitaciones();
   }catch(e){
     console.error(e);
     window._inviteRefreshMessage='No fue posible actualizar los estados. Intente nuevamente.';
     if(msg)msg.textContent=window._inviteRefreshMessage;
     alert(e?.message||'No fue posible actualizar los estados.');
   }finally{
     const b=document.getElementById('btnActualizarInvitaciones');
     if(b){b.disabled=false;b.textContent='↻ Actualizar estados'}
   }
 };
 window.aprobarInvitacionIntegrante=async function(id){
   if(!confirm('¿Aprobar esta incorporación y enviar la invitación por correo?'))return;
   try{
     const {data,error}=await sbAuth.functions.invoke('member-invitation',{body:{action:'approve',id}});
     if(error)throw error;if(!data?.ok)throw new Error(data?.error||'No fue posible aprobar.');
     alert(data.status==='Cuenta activada'?'La persona ya tenía cuenta. Se agregó la Mesa y el rol aprobados.':'Invitación enviada correctamente por correo.');
     await window.adminInvitaciones();
   }catch(e){console.error(e);alert(e?.message||'No fue posible aprobar la solicitud.');}
 };
 window.rechazarInvitacionIntegrante=async function(id){
   const reason=prompt('Indique el motivo del rechazo:');if(reason===null)return;if(!reason.trim())return alert('Debe indicar un motivo.');
   try{
     const {data,error}=await sbAuth.functions.invoke('member-invitation',{body:{action:'reject',id,reason:reason.trim()}});
     if(error)throw error;if(!data?.ok)throw new Error(data?.error||'No fue posible rechazar.');
     await window.adminInvitaciones();
   }catch(e){console.error(e);alert(e?.message||'No fue posible rechazar la solicitud.');}
 };
 window.adminInvitacionDirecta=async function(){
   const email=prompt('Correo electrónico:');if(email===null)return;
   const clean=String(email).normalize('NFKC').replace(/[\s\u200B-\u200D\uFEFF]+/g,'').toLowerCase();
   const parts=clean.split('@');
   const valid=parts.length===2&&parts[0].length>0&&/^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(parts[0])&&/^[A-Z0-9-]+(?:\.[A-Z0-9-]+)+$/i.test(parts[1]);
   if(!valid)return alert('Ingrese un correo electrónico válido.');
   try{
     const {data,error}=await sbAuth.functions.invoke('member-invitation',{body:{action:'direct_invite',email:clean}});
     if(error)throw error;if(!data?.ok)throw new Error(data?.error||'No fue posible enviar la invitación.');
     alert(data.status==='Registro completado'?'Este correo ya tiene el registro completado.':'Invitación enviada correctamente. El correo quedó registrado en la lista de invitaciones.');
     await window.adminInvitaciones();
   }catch(e){console.error(e);alert(e?.message||'No fue posible enviar la invitación.');}
 };

 const _renderInvitacionesIntegrantes=window.renderInvitacionesIntegrantes;
 window.renderInvitacionesIntegrantes=async function(container){
   const c=container||document.getElementById('privatecontent');
   await _renderInvitacionesIntegrantes(c);
   if(!c||!isReal())return;
   const mesasCoord=coordinatorMesas();if(!mesasCoord.length)return;
   const ids=mesasCoord.map(m=>Number(mesaId(m))).filter(Boolean);
   const [{data:members,error:me},{data:removals,error:re}]=await Promise.all([
     sbAuth.from('table_memberships')
       .select('profile_id,technical_table_id,member_role,is_coordinator,profiles(id,full_name,email),technical_tables(name)')
       .in('technical_table_id',ids),
     sbAuth.from('member_removal_requests')
       .select('id,profile_id,technical_table_id,reason,status,requested_at,profiles(full_name,email),technical_tables(name)')
       .eq('requested_by',STATE.uid).order('requested_at',{ascending:false})
   ]);
   if(me||re){console.warn(me||re);return}
   const current=(members||[]).filter(x=>String(x.profile_id)!==String(STATE.uid));
   const pending=new Set((removals||[]).filter(x=>x.status==='Pendiente').map(x=>String(x.profile_id)+'|'+String(x.technical_table_id)));
   const sec=document.createElement('div');
   sec.innerHTML='<h2 class="section-sub">Integrantes de mis Mesas</h2>'+
     '<div class="notice">El Coordinador puede solicitar que una persona sea retirada de su Mesa. Administración debe aprobar la solicitud. La cuenta del profesional nunca se elimina.</div><br>'+
     (current.length?current.map(x=>{
       const key=String(x.profile_id)+'|'+String(x.technical_table_id),wait=pending.has(key);
       return '<div class="row"><div><b>'+esc(x.profiles?.full_name||'Integrante')+'</b> · '+esc(x.profiles?.email||'')+
         '<br><small>'+esc(x.technical_tables?.name||'Mesa')+' · '+esc(x.is_coordinator?'Coordinador/a de Mesa':x.member_role||'Integrante de Mesa')+'</small></div><div>'+
         (wait?'<span class="pill amber">Retiro pendiente</span>':'<button class="btn danger" onclick="solicitarRetiroIntegrante(\''+String(x.profile_id).replace(/'/g,"\\'")+'\','+Number(x.technical_table_id)+',\''+String(x.profiles?.full_name||'Integrante').replace(/'/g,"\\'")+'\',\''+String(x.technical_tables?.name||'Mesa').replace(/'/g,"\\'")+'\')">Solicitar quitar de esta Mesa</button>')+
         '</div></div>';
     }).join(''):'<div class="card"><p>No hay otros integrantes asignados a sus Mesas.</p></div>')+
     '<h2 class="section-sub">Solicitudes de retiro enviadas</h2>'+
     ((removals||[]).length?(removals||[]).map(x=>'<div class="row"><div><b>'+esc(x.profiles?.full_name||'Integrante')+'</b><br><small>'+esc(x.technical_tables?.name||'Mesa')+(x.reason?' · '+esc(x.reason):'')+' · '+new Date(x.requested_at).toLocaleString('es-CL')+'</small></div><span class="pill '+(x.status==='Aprobada'?'green':x.status==='Rechazada'?'amber':'')+'">'+esc(x.status)+'</span></div>').join(''):'<div class="card"><p>No ha solicitado retiros.</p></div>');
   c.appendChild(sec);
 };
 window.solicitarRetiroIntegrante=async function(profileId,technicalTableId,nombre,mesa){
   const reason=prompt('Motivo para solicitar que '+nombre+' sea retirado/a de la Mesa '+mesa+':','');
   if(reason===null)return;
   try{
     const {data,error}=await sbAuth.functions.invoke('member-removal',{body:{action:'submit',profile_id:profileId,technical_table_id:Number(technicalTableId),reason:reason.trim()}});
     if(error)throw error;if(!data?.ok)throw new Error(data?.error||'No fue posible registrar la solicitud.');
     alert('Solicitud enviada a Administración.');
     await window.renderInvitacionesIntegrantes(document.getElementById('privatecontent'));
   }catch(e){console.error(e);alert(e?.message||'No fue posible enviar la solicitud de retiro.');}
 };

 const _adminInvitaciones=window.adminInvitaciones;
 window.adminInvitaciones=async function(){
   await _adminInvitaciones();
   const c=document.getElementById('admincontent');if(!c||!isReal())return;
   const [{data:rows,error},{data:profiles}]=await Promise.all([
     sbAuth.from('member_removal_requests')
       .select('id,profile_id,technical_table_id,reason,status,requested_by,requested_at,reviewed_at,profiles(full_name,email),technical_tables(name)')
       .order('requested_at',{ascending:false}),
     sbAuth.from('profiles').select('id,full_name,email')
   ]);
   if(error){console.warn(error);return}
   const who=id=>(profiles||[]).find(p=>String(p.id)===String(id));
   const sec=document.createElement('div');
   sec.innerHTML='<h2 class="section-sub">Solicitudes para quitar integrantes de una Mesa</h2>'+
     '<div class="notice">Administración puede quitar únicamente la asignación a una Mesa. La cuenta y el perfil del profesional no se eliminan y puede ser asignado posteriormente a otra Mesa o rol.</div><br>'+
     ((rows||[]).length?(rows||[]).map(x=>{
       const r=who(x.requested_by),pending=x.status==='Pendiente';
       return '<div class="card" style="margin:12px 0"><div class="row"><div><b>'+esc(x.profiles?.full_name||'Integrante')+'</b> · '+esc(x.profiles?.email||'')+
       '<br><small>Mesa '+esc(x.technical_tables?.name||'')+' · Solicitado por '+esc(r?.full_name||'Coordinación')+' · '+new Date(x.requested_at).toLocaleString('es-CL')+'</small>'+
       (x.reason?'<p class="muted"><b>Motivo:</b> '+esc(x.reason)+'</p>':'')+'</div><div><span class="pill '+(x.status==='Aprobada'?'green':x.status==='Rechazada'?'amber':'')+'">'+esc(x.status)+'</span>'+
       (pending?'<br><button class="btn danger" style="margin-top:8px" onclick="aprobarRetiroIntegrante('+x.id+')">Aprobar retiro de Mesa</button> <button class="btn soft" style="margin-top:8px" onclick="rechazarRetiroIntegrante('+x.id+')">Rechazar</button>':'')+'</div></div></div>';
     }).join(''):'<div class="card"><p>No hay solicitudes de retiro.</p></div>');
   c.appendChild(sec);
 };
 window.aprobarRetiroIntegrante=async function(id){
   if(!confirm('¿Aprobar que esta persona sea quitada de la Mesa?\n\nSu cuenta, perfil y otras Mesas se conservarán.'))return;
   try{
     const {data,error}=await sbAuth.functions.invoke('member-removal',{body:{action:'approve',id}});
     if(error)throw error;if(!data?.ok)throw new Error(data?.error||'No fue posible aprobar el retiro.');
     await refreshSharedAdmin();alert('La persona fue quitada únicamente de esa Mesa.');
     await window.adminInvitaciones();
   }catch(e){console.error(e);alert(e?.message||'No fue posible aprobar el retiro.');}
 };
 window.rechazarRetiroIntegrante=async function(id){
   if(!confirm('¿Rechazar esta solicitud de retiro?'))return;
   try{
     const {data,error}=await sbAuth.functions.invoke('member-removal',{body:{action:'reject',id}});
     if(error)throw error;if(!data?.ok)throw new Error(data?.error||'No fue posible rechazar.');
     await window.adminInvitaciones();
   }catch(e){console.error(e);alert(e?.message||'No fue posible rechazar la solicitud.');}
 };

 function invitationModal(){
   let m=document.getElementById('invitationPasswordModal');if(m)return m;
   m=document.createElement('div');m.id='invitationPasswordModal';m.className='modal-back';
   m.innerHTML='<div class="modal"><div class="kicker">Invitación aceptada</div><h2 class="section-title">Crear contraseña</h2><p class="muted">Defina una contraseña personal de al menos 8 caracteres para completar su acceso.</p><div class="form"><label>Nueva contraseña</label><input id="invNewPass" type="password" minlength="8" autocomplete="new-password"><label>Repetir contraseña</label><input id="invNewPass2" type="password" minlength="8" autocomplete="new-password"><button id="invSetPassBtn" class="btn primary" onclick="guardarClaveInvitacion()">Guardar contraseña y activar cuenta</button><p id="invSetPassStatus" class="muted"></p></div></div>';
   document.body.appendChild(m);return m;
 }
 window.mostrarClaveInvitacion=async function(){
   if(!sbAuth||new URLSearchParams(location.search).get('invite')!=='1')return;
   const qs=new URLSearchParams(location.search);
   const tokenHash=qs.get('token_hash');
   if(tokenHash){
     const otpType=qs.get('type')==='email'?'email':'invite';
     const {error}=await sbAuth.auth.verifyOtp({token_hash:tokenHash,type:otpType});
     if(error){
       console.error('Error al validar invitación',error);
       alert('El enlace de invitación no pudo validarse o ya expiró. Solicite a Administración una nueva invitación.');
       return;
     }
     qs.delete('token_hash');qs.delete('type');
     const clean=location.pathname+(qs.toString()?'?'+qs.toString():'')+location.hash;
     history.replaceState({},document.title,clean);
   }
   const {data}=await sbAuth.auth.getSession();if(!data?.session)return;
   invitationModal().classList.add('open');
 };
 window.guardarClaveInvitacion=async function(){
   const p=document.getElementById('invNewPass')?.value||'',p2=document.getElementById('invNewPass2')?.value||'',s=document.getElementById('invSetPassStatus'),btn=document.getElementById('invSetPassBtn');
   if(p.length<8){s.textContent='La contraseña debe tener al menos 8 caracteres.';return}
   if(p!==p2){s.textContent='Las contraseñas no coinciden.';return}
   btn.disabled=true;btn.textContent='Activando…';s.textContent='';
   try{
     const {error}=await sbAuth.auth.updateUser({password:p});if(error)throw error;
     try{await sbAuth.functions.invoke('member-invitation',{body:{action:'activate'}})}catch(e){console.warn(e)}
     history.replaceState({},document.title,location.pathname);
     invitationModal().classList.remove('open');
     alert('Cuenta activada correctamente. Ya puede ingresar con su correo y nueva contraseña.');
     await sbAuth.auth.signOut();go('mesas');
   }catch(e){console.error(e);s.textContent='No fue posible guardar la contraseña. Abra nuevamente el enlace de invitación.';btn.disabled=false;btn.textContent='Guardar contraseña y activar cuenta';}
 };
 if(sbAuth){
   sbAuth.auth.onAuthStateChange((event,session)=>{
     if(session&&new URLSearchParams(location.search).get('invite')==='1')setTimeout(()=>window.mostrarClaveInvitacion(),0);
   });
   setTimeout(()=>window.mostrarClaveInvitacion(),400);
 }

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
     const {data,error}=await sbAuth.auth.signUp({email,password,options:{data:{full_name:name},emailRedirectTo:'https://profesionalesohiggins.cl/'}});
     if(error)throw error;
     if(!data?.user)throw Error('El servicio no confirmó la creación de la cuenta.');
     status.style.color='#2e7d62';
     status.textContent=data.session?'Cuenta creada correctamente. Ya puede ingresar con su correo y contraseña. Administración podrá asignarle una Mesa Técnica y el rol correspondiente.':'Cuenta registrada correctamente. Revise su correo electrónico y confirme el enlace recibido. Una vez validado su correo, Administración podrá asignarle una Mesa Técnica y el rol correspondiente.';
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
   const otherIds=[...new Set((data||[]).filter(x=>x.profile_id&&x.profile_id!==STATE.uid).map(x=>x.profile_id))];
   let people=[];
   if(otherIds.length){
     const {data:profiles,error:profileError}=await sbAuth.from('profiles').select('id,full_name,email').in('id',otherIds);
     if(!profileError)people=profiles||[];
   }
   const now=Date.now();
   let changed=false;
   for(const name of STUDY_SECTION_NAMES){
     const row=(data||[]).find(x=>x.section_name===name&&now-new Date(x.locked_at).getTime()<300000);
     const current=getLock(m,name);
     if(row&&row.profile_id!==STATE.uid){
       const person=people.find(p=>String(p.id)===String(row.profile_id));
       const next={email:'cloud:'+row.profile_id,nombre:person?.full_name||person?.email||'Otro integrante',ts:new Date(row.locked_at).getTime()};
       if(!current||current.email!==next.email||current.nombre!==next.nombre||current.ts!==next.ts)changed=true;
       localStorage.setItem(lockKey(m,name),JSON.stringify(next));
     }else if(current?.email?.startsWith('cloud:')){localStorage.removeItem(lockKey(m,name));changed=true}
   }
   if(changed&&!ownedLocks().length&&m===currentDocMesa&&document.getElementById('wsTitulo')){
     const active=currentSection;
     renderEspacio(document.getElementById('privatecontent'));
     const tab=document.querySelector('[data-tabsec="'+active+'"]');
     if(tab)showDocSection(active,tab,false);
     label('Estado de edición actualizado.');
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
     COLLECTION_KEYS.forEach(k=>delete unsaved[k]);
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
 window.addEventListener('pagehide',()=>{if(isReal())Object.keys(STATE.ids).forEach(m=>{if(localStorage.getItem(pendingKey(m))==='1')flush(m)});const m=currentDocMesa,names=ownedLocks();if(names.length)void flushThenRelease(m,names)});
 // Hacer que las solicitudes y los documentos públicos tengan el mismo origen en todos los dispositivos.
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>window.loadPublicLibrary());else window.loadPublicLibrary();
})();

/* mi-trabajo-mesas-roles-v1 */
(function(){
  window.abrirMesaTrabajo=function(m){
    const mesa=decodeURIComponent(m);
    if(!getAssignedMesas().includes(mesa))return;
    currentDocMesa=mesa;
    privateTab('espacio');
  };
  window.renderPanel=function(c){
    const ass=getAssignedMesas();
    const cards=ass.map(m=>{
      const d=getWork(m),role=getRoleForMesa(m),version=d.versiones.length?d.versiones[d.versiones.length-1].numero:'—';
      return '<div class="card" style="margin-bottom:14px">'+
        '<div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap">'+
          '<div><small>Mesa Técnica</small><h3 style="margin:4px 0 2px">'+esc(m)+'</h3><span class="pill">'+esc(role)+'</span></div>'+
          '<button class="btn primary" onclick="abrirMesaTrabajo(\''+encodeURIComponent(m)+'\')">Abrir Mesa</button>'+
        '</div>'+
        '<div class="summary-card" style="margin-top:14px">'+
          '<div><small>Documento actual</small><br><b>'+esc(d.titulo||'Sin título')+'</b></div>'+
          '<div><small>Estado</small><br><span class="pill">'+esc(d.estado)+'</span></div>'+
          '<div><small>Versión</small><br><b>'+version+'</b></div>'+
          '<div><small>Última actualización</small><br><b>'+esc(d.ultima||'Sin registro')+'</b></div>'+
        '</div>'+
      '</div>';
    }).join('');
    c.innerHTML='<div class="kicker">Área privada</div><h1 class="section-title">Mi Trabajo</h1>'+
      '<div class="notice"><b>'+esc(currentUser.nombre)+'</b><br>Estas son todas sus Mesas Técnicas y el rol asignado en cada una.</div><br>'+
      (cards||'<div class="notice">No tiene Mesas Técnicas asignadas.</div>')+
      '<button class="btn soft" onclick="privateTab(\'aprobados\')">Ver documentos aprobados</button>';
  };
})();


/* crear-nuevo-documento-v1 */
(function(){
  const previousRenderPanel=window.renderPanel;

  window.crearNuevoDocumentoMesa=async function(encodedMesa){
    const mesa=decodeURIComponent(encodedMesa);
    if(!getAssignedMesas().includes(mesa))return alert('No tiene acceso a esta Mesa Técnica.');

    const role=getRoleForMesa(mesa);
    if(!/^Coordinador/i.test(role||'')){
      return alert('Solo el Coordinador o Coordinadora de la Mesa puede iniciar un nuevo documento.');
    }

    const actual=getWork(mesa);
    if(!['Publicado','Retirado de publicación'].includes(actual.estado)){
      return alert('Para crear un nuevo documento, el documento actual debe estar publicado o retirado de publicación.');
    }

    const ok=confirm('¿Crear un nuevo documento para la Mesa '+mesa+'?\n\nEl documento publicado se conservará en la Biblioteca y se abrirá un documento nuevo en blanco, comenzando nuevamente en estado En elaboración.');
    if(!ok)return;

    try{
      const {data:table,error:tableError}=await sbAuth.from('technical_tables')
        .select('id').eq('name',mesa).maybeSingle();
      if(tableError||!table?.id)throw tableError||new Error('Mesa no encontrada');

      const {data,error}=await sbAuth.rpc('start_new_workspace_document',{
        p_technical_table_id:table.id
      });
      if(error)throw error;

      alert('Nuevo documento creado para la Mesa '+mesa+'. El documento anterior permanece en la Biblioteca.');
      currentDocMesa=mesa;
      location.reload();
    }catch(err){
      console.error(err);
      const msg=String(err?.message||'');
      if(/Only the table coordinator/i.test(msg))alert('Solo el Coordinador o Coordinadora de la Mesa puede iniciar un nuevo documento.');
      else if(/only be started after/i.test(msg))alert('El documento actual todavía no está cerrado. Debe estar publicado o retirado antes de iniciar otro.');
      else if(/Published copy not found/i.test(msg))alert('No se encontró la copia publicada en Biblioteca. No se modificó el documento actual.');
      else alert('No fue posible crear el nuevo documento. El documento actual no fue modificado.');
    }
  };

  window.renderPanel=function(c){
    const ass=getAssignedMesas();
    const cards=ass.map(m=>{
      const d=getWork(m),role=getRoleForMesa(m),version=d.versiones.length?d.versiones[d.versiones.length-1].numero:'—';
      const closed=['Publicado','Retirado de publicación'].includes(d.estado);
      const canCreate=closed&&/^Coordinador/i.test(role||'');
      return '<div class="card" style="margin-bottom:14px">'+
        '<div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap">'+
          '<div><small>Mesa Técnica</small><h3 style="margin:4px 0 2px">'+esc(m)+'</h3><span class="pill">'+esc(role)+'</span></div>'+
          '<div style="display:flex;gap:8px;flex-wrap:wrap">'+
            '<button class="btn primary" onclick="abrirMesaTrabajo(\''+encodeURIComponent(m)+'\')">Abrir Mesa</button>'+
            (canCreate?'<button class="btn soft" onclick="crearNuevoDocumentoMesa(\''+encodeURIComponent(m)+'\')">Crear nuevo documento</button>':'')+
          '</div>'+
        '</div>'+
        '<div class="summary-card" style="margin-top:14px">'+
          '<div><small>Documento actual</small><br><b>'+esc(d.titulo||'Sin título')+'</b></div>'+
          '<div><small>Estado</small><br><span class="pill">'+esc(d.estado)+'</span></div>'+
          '<div><small>Versión</small><br><b>'+version+'</b></div>'+
          '<div><small>Última actualización</small><br><b>'+esc(d.ultima||'Sin registro')+'</b></div>'+
        '</div>'+
      '</div>';
    }).join('');
    c.innerHTML='<div class="kicker">Área privada</div><h1 class="section-title">Mi Trabajo</h1>'+
      '<div class="notice"><b>'+esc(currentUser.nombre)+'</b><br>Estas son todas sus Mesas Técnicas y el rol asignado en cada una.</div><br>'+
      (cards||'<div class="notice">No tiene Mesas Técnicas asignadas.</div>')+
      '<button class="btn soft" onclick="privateTab(\'aprobados\')">Ver documentos aprobados</button>';
  };
})();
