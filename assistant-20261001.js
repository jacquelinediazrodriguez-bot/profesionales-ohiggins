/* Asistente de la Plataforma — visible solo en Mi Trabajo */
(function(){
 'use strict';
 const ID='frenteAssistant';
 const BTN='frenteAssistantBtn';

 const answers={
  guardar:'Para guardar su avance, trabaje dentro de Mi Trabajo y pulse “Guardar versión” cuando quiera dejar un registro formal. Mientras edita, la plataforma también conserva los cambios de trabajo. Antes de salir, verifique que aparezca el mensaje de guardado en la nube.',
  version:'Para recuperar una versión anterior, vaya a Mi Trabajo → Versiones y aprobación. Si su rol tiene permiso, verá “Restaurar para editar”. La versión recuperada vuelve al editor, pero no crea una versión nueva hasta que pulse “Guardar versión”.',
  externo:'Para incorporar antecedentes de un documento externo, abra la sección metodológica correspondiente y use “Editar sección”. Pegue o redacte el contenido que corresponda y registre la fuente con “Insertar fuente / referencia”. Así el antecedente queda integrado al documento y respaldado por su referencia.',
  comentar:'Para dejar un comentario u observación, vaya a Mi Trabajo → Revisión del documento. Escriba el mensaje y pulse “Guardar mensaje”. Las observaciones formales de Administración permanecen en el historial y, una vez atendidas, deben marcarse como resueltas.',
  coordinador:'El Coordinador o Coordinadora puede trabajar en el documento, revisar aportes, dar visto bueno y solicitar la publicación cuando el documento esté listo. Si Administración lo devuelve con observaciones, debe corregirse el documento, resolver las observaciones pendientes y volver a solicitar publicación.',
  fuentes:'Para registrar una fuente, pulse “Insertar fuente / referencia” dentro de Mi Trabajo. Complete tipo de fuente, autor o institución, año, título, medio y URL cuando corresponda. La plataforma genera la referencia y la incorpora al documento.',
  mesas:'Si pertenece a más de una Mesa, puede cambiar de Mesa desde el selector de Mesa Técnica o desde el listado de Mesas del menú lateral de Mi Trabajo. Su rol se muestra de manera independiente para cada Mesa.',
  publicar:'El ciclo de publicación es: guardar versión, revisar el documento, resolver observaciones pendientes, registrar los vistos buenos necesarios y solicitar publicación. Administración puede publicar o devolver el documento con una observación. Si se devuelve, se corrige, se guarda una nueva versión y se envía nuevamente.',
  ayuda:'Puedo orientarle sobre guardar avances, recuperar versiones, incorporar antecedentes externos, comentarios y observaciones, roles, fuentes, cambio entre Mesas y publicación de documentos.'
 };

 function normalize(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()}
 function answerFor(q){
   const x=normalize(q);
   if(!x)return answers.ayuda;
   if(/guardar|avance|version nueva/.test(x))return answers.guardar;
   if(/recuper|restaur|version anterior|historial/.test(x))return answers.version;
   if(/extern|word|documento de afuera|incorporar antecedente/.test(x))return answers.externo;
   if(/coment|observacion|mensaje|resuelt/.test(x))return answers.comentar;
   if(/coordinador|coordinadora|rol|permiso/.test(x))return answers.coordinador;
   if(/fuente|referencia|citar|apa/.test(x))return answers.fuentes;
   if(/mesa|cambiar.*mesa|mis mesas/.test(x))return answers.mesas;
   if(/public|biblioteca|enviar.*admin|devolver/.test(x))return answers.publicar;
   return 'No encontré una respuesta específica para esa consulta. Puede preguntarme por guardar avances, recuperar versiones, incorporar antecedentes externos, comentarios u observaciones, roles, fuentes, Mesas Técnicas o publicación de documentos.';
 }
 function inMiTrabajo(){
   const pc=document.getElementById('privatecontent');
   if(!pc)return false;
   const title=[...pc.querySelectorAll('h1,h2')].some(x=>normalize(x.textContent).includes('espacio de trabajo'));
   const visible=!!(pc.offsetWidth||pc.offsetHeight||pc.getClientRects().length);
   return title&&visible;
 }
 function addStyle(){
   if(document.getElementById('frenteAssistantStyle'))return;
   const s=document.createElement('style');s.id='frenteAssistantStyle';
   s.textContent=`#${BTN}{position:fixed;right:22px;bottom:22px;z-index:95;width:58px;height:58px;border:0;border-radius:50%;background:#123b67;color:#fff;font-size:25px;cursor:pointer;box-shadow:0 8px 24px rgba(18,59,103,.28);display:none}#${ID}{position:fixed;right:22px;bottom:92px;z-index:96;width:min(380px,calc(100vw - 28px));max-height:70vh;background:#fff;border:1px solid #dfe7ef;border-radius:16px;box-shadow:0 18px 48px rgba(18,36,55,.24);display:none;overflow:hidden;font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif}#${ID}.open{display:block}#${ID} .fa-head{display:flex;justify-content:space-between;align-items:center;padding:13px 15px;background:#123b67;color:#fff}#${ID} .fa-head b{font-size:15px}#${ID} .fa-close{border:0;background:transparent;color:#fff;font-size:21px;cursor:pointer}#${ID} .fa-body{padding:14px;overflow:auto;max-height:calc(70vh - 52px)}#${ID} .fa-intro{font-size:13px;line-height:1.45;color:#526579;margin:0 0 10px}#${ID} .fa-quick{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0 12px}#${ID} .fa-q{border:1px solid #dfe7ef;background:#f7fafc;color:#123b67;border-radius:999px;padding:7px 9px;font-size:12px;cursor:pointer}#${ID} .fa-line{padding:9px 10px;border-radius:10px;margin:7px 0;white-space:pre-wrap;line-height:1.45;font-size:13px}#${ID} .fa-user{background:#eaf1f7;color:#172536}#${ID} .fa-assistant{background:#f7fafc;color:#405064;border:1px solid #e6edf3}#${ID} .fa-form{display:flex;gap:7px;margin-top:10px}#${ID} input{min-width:0;flex:1;padding:10px 11px;border:1px solid #cfd9e3;border-radius:9px;font:inherit}#${ID} .fa-send{border:0;background:#123b67;color:#fff;border-radius:9px;padding:9px 12px;font-weight:700;cursor:pointer}@media(max-width:520px){#${BTN}{right:14px;bottom:14px}#${ID}{right:14px;bottom:82px}}`;
   document.head.appendChild(s);
 }
 function make(){
   if(document.getElementById(BTN))return;
   addStyle();
   const b=document.createElement('button');b.id=BTN;b.type='button';b.setAttribute('aria-label','Abrir Asistente de la Plataforma');b.textContent='💬';
   const p=document.createElement('section');p.id=ID;p.setAttribute('aria-label','Asistente de la Plataforma');
   const head=document.createElement('div');head.className='fa-head';
   const title=document.createElement('b');title.textContent='Asistente de la Plataforma';
   const close=document.createElement('button');close.type='button';close.className='fa-close';close.setAttribute('aria-label','Cerrar asistente');close.textContent='×';
   head.append(title,close);
   const body=document.createElement('div');body.className='fa-body';
   const intro=document.createElement('p');intro.className='fa-intro';intro.textContent='Estoy aquí para orientarle en el uso de Mi Trabajo. Puede elegir una consulta rápida o escribir su pregunta.';
   const quick=document.createElement('div');quick.className='fa-quick';
   [['Guardar avance','guardar'],['Recuperar versión','version'],['Agregar fuente','fuentes'],['Observaciones','comentar'],['Cambiar de Mesa','mesas'],['Publicar documento','publicar']].forEach(([label,key])=>{const q=document.createElement('button');q.type='button';q.className='fa-q';q.textContent=label;q.onclick=()=>showAnswer(label,answers[key]);quick.appendChild(q)});
   const chat=document.createElement('div');chat.id='faChat';
   const form=document.createElement('div');form.className='fa-form';
   const input=document.createElement('input');input.id='faInput';input.type='text';input.placeholder='Escriba su consulta…';input.autocomplete='off';
   const send=document.createElement('button');send.type='button';send.className='fa-send';send.textContent='Consultar';
   form.append(input,send);body.append(intro,quick,chat,form);p.append(head,body);document.body.append(b,p);
   b.onclick=()=>{p.classList.toggle('open');if(p.classList.contains('open'))setTimeout(()=>input.focus(),50)};
   close.onclick=()=>p.classList.remove('open');
   send.onclick=()=>submit();
   input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();submit()}});
   function submit(){const q=input.value.trim();if(!q)return;showAnswer(q,answerFor(q));input.value='';input.focus()}
 }
 function showAnswer(q,a){
   const chat=document.getElementById('faChat');if(!chat)return;
   const u=document.createElement('div');u.className='fa-line fa-user';u.textContent=q;
   const r=document.createElement('div');r.className='fa-line fa-assistant';r.textContent=a;
   chat.append(u,r);r.scrollIntoView({block:'nearest'});
 }
 function sync(){make();const ok=inMiTrabajo(),b=document.getElementById(BTN),p=document.getElementById(ID);if(b)b.style.display=ok?'block':'none';if(!ok&&p)p.classList.remove('open')}
 const obs=new MutationObserver(()=>setTimeout(sync,20));
 if(document.readyState==='loading'){
   document.addEventListener('DOMContentLoaded',()=>{
     sync();
     obs.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style']});
   });
 }else{
   sync();
   obs.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style']});
 }
})();