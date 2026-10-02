/* Corrección 2026-10-02: captura segura del editor y permisos de restauración. */
(function(){
 'use strict';

 // 1) Felipe y cualquier Secretario/a Técnico/a debe poder restaurar versiones.
 // La base puede guardar variantes como "Secretario Técnico", "Secretaria Técnica"
 // o la etiqueta histórica "Secretario/a Técnico/a".
 const basePuedeGestionar=window.puedeGestionarMesa;
 window.puedeGestionarMesa=function(m){
   if(typeof isAnyAdmin==='function'&&isAnyAdmin())return true;
   const rol=String(typeof getRoleForMesa==='function'?getRoleForMesa(m||window.currentDocMesa):'')
     .normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
   if(/coordinador|coordinadora/.test(rol))return true;
   if(/secretari[oa](?:\/a)?\s+tecnic[oa](?:\/a)?/.test(rol))return true;
   return typeof basePuedeGestionar==='function'?basePuedeGestionar(m):false;
 };

 // 2) No perder el texto escrito si el bloqueo visual local se renueva o desaparece
 // antes de que syncWorkFromUI lea el editor. Mientras el editor está realmente
 // habilitado para escribir, se considera propiedad del usuario actual para la
 // captura local; la autorización remota sigue siendo validada por Supabase.
 const baseGetLock=window.getLock;
 if(typeof baseGetLock==='function'){
   window.getLock=function(m,s){
     const x=baseGetLock(m,s);
     if(x)return x;
     try{
       if(!window.currentUser||m!==window.currentDocMesa)return null;
       const id=typeof sectionEditorId==='function'?sectionEditorId(s):null;
       const ed=id?document.getElementById(id):null;
       if(ed&&(ed.isContentEditable||ed.getAttribute('contenteditable')==='true')){
         return {email:currentUser.correo,nombre:currentUser.nombre,ts:Date.now(),synthetic:true};
       }
     }catch(e){}
     return null;
   };
 }

 // 3) Refuerzo adicional al guardar una versión: capturar primero cualquier
 // sección que siga abierta en edición antes de ejecutar la sincronización cloud.
 const baseGuardarVersion=window.guardarVersion;
 if(typeof baseGuardarVersion==='function'){
   window.guardarVersion=async function(){
     try{if(typeof syncWorkFromUI==='function')syncWorkFromUI(true);}catch(e){console.warn('No se pudo precapturar el editor:',e)}
     return baseGuardarVersion.apply(this,arguments);
   };
 }

 // 4) Si existe una copia local de recuperación y el documento compartido está
 // vacío, hacer visible el aviso sin importar en forma automática ni sobrescribir.
 const baseRenderEspacio=window.renderEspacio;
 if(typeof baseRenderEspacio==='function'){
   window.renderEspacio=function(c){
     const out=baseRenderEspacio.apply(this,arguments);
     try{
       if(!currentUser?.supabaseId||!window.currentDocMesa)return out;
       const d=typeof getWork==='function'?getWork(currentDocMesa):null;
       const hasContent=!!d&&Object.values(d.contenido||{}).some(v=>typeof v==='string'&&v.replace(/<[^>]*>/g,'').replace(/&nbsp;/g,' ').trim());
       const prefix='frentePT_backup_'+currentDocMesa+'_';
       const hasBackup=Object.keys(localStorage).some(k=>k.startsWith(prefix));
       if(!hasContent&&hasBackup){
         const panel=document.getElementById('cloudSyncPanel');
         if(panel&&!document.getElementById('workspaceRecoveryWarning')){
           const n=document.createElement('div');
           n.id='workspaceRecoveryWarning';n.className='notice';n.style.marginTop='10px';
           n.innerHTML='<b>Existe una copia local anterior de este documento.</b><br>El documento compartido está sin contenido. Use «Importar una copia local anterior» para recuperar las secciones guardadas en este computador antes de crear una nueva versión.';
           panel.appendChild(n);
         }
       }
     }catch(e){console.warn('No se pudo revisar la copia de recuperación:',e)}
     return out;
   };
 }
})();
