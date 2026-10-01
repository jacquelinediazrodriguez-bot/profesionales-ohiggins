(function(){
  'use strict';

  const STEPS=[
    {
      title:'1. Apertura',
      page:'inicio',
      time:'1 min',
      say:'Esta plataforma organiza el trabajo del Frente de Profesionales y Técnicos de O’Higgins y transforma la participación profesional en propuestas, documentos y una memoria técnica permanente.',
      key:'Presente primero el propósito; no empiece explicando funciones.'
    },
    {
      title:'2. Estructura pública',
      page:'quienes',
      time:'1 min',
      say:'La plataforma tiene un área pública para explicar quiénes somos, cómo trabajamos y cómo se relaciona el trabajo técnico con la ciudadanía y la organización.',
      key:'Muestre que no es solo un sitio informativo: es la puerta de entrada al sistema de trabajo.'
    },
    {
      title:'3. Mesas Técnicas',
      page:'mesas',
      time:'1 min',
      say:'El trabajo se organiza por Mesas Técnicas. El acceso es privado y cada persona ingresa con su propia cuenta; el sistema reconoce las mesas y los roles asignados.',
      key:'Explique que una persona puede participar en más de una mesa y tener un rol distinto en cada una.'
    },
    {
      title:'4. Mi Trabajo',
      privateTab:'panel',
      time:'1 min',
      say:'Al ingresar, cada profesional tiene un espacio propio. Aquí ve sus mesas, sus roles, el documento en curso, el estado y la última actualización.',
      key:'Esta pantalla demuestra la personalización del trabajo por usuario.'
    },
    {
      title:'5. Cambio entre Mesas',
      privateTab:'espacio',
      time:'1 min',
      say:'Desde el menú lateral se puede cambiar rápidamente entre las mesas a las que pertenece la persona, sin cerrar sesión ni perder el contexto de trabajo.',
      key:'Muestre el listado Mis Mesas y el rol que aparece bajo cada una.'
    },
    {
      title:'6. Elaboración del informe',
      privateTab:'espacio',
      time:'2 min',
      say:'El documento se construye por secciones metodológicas. Cada sección tiene una guía, control de edición, referencias y guardado de versiones para ordenar el trabajo colaborativo.',
      key:'Abra una sección del informe y muestre la metodología, no es necesario editar durante la reunión.'
    },
    {
      title:'7. Revisión y validación',
      privateTab:'espacio',
      time:'2 min',
      say:'Antes de publicar, los integrantes pueden revisar, dejar observaciones y registrar su visto bueno. La coordinación conduce el cierre y solicita la publicación a Administración.',
      key:'Desplace la pantalla hasta Revisión del documento y Versiones y aprobación.'
    },
    {
      title:'8. Biblioteca',
      page:'biblioteca',
      time:'1 min',
      say:'Los documentos aprobados pasan a la Biblioteca pública. Así el conocimiento producido por las mesas queda ordenado, consultable y disponible como documento final.',
      key:'Muestre filtros, documentos publicados y la opción de solicitar copia.'
    },
    {
      title:'9. Directorio y vinculación',
      action:'directorio',
      time:'1 min',
      say:'La plataforma también concentra información institucional y facilita la vinculación con autoridades, representantes y actores relevantes para el trabajo regional.',
      key:'Si el Directorio requiere acceso administrativo, muéstrelo brevemente y vuelva al recorrido.'
    },
    {
      title:'10. Administración y seguridad',
      action:'admin',
      time:'1 min',
      say:'La Administración está separada del trabajo de las mesas. Desde aquí se gestionan usuarios, invitaciones, asignaciones, publicaciones, correo, galería, directorio y estado de la plataforma.',
      key:'No abra información personal sensible durante una presentación pública.'
    },
    {
      title:'11. Cierre',
      page:'inicio',
      time:'1 min',
      say:'La plataforma busca que el conocimiento profesional no quede disperso en reuniones o correos, sino que se transforme en trabajo organizado, propuestas concretas y memoria técnica para la Región de O’Higgins.',
      key:'Cierre aquí y abra el espacio de preguntas.'
    }
  ];

  let idx=0;
  let startedAt=0;
  let timerId=null;
  let notesVisible=true;

  function css(){
    const s=document.createElement('style');
    s.id='zoomDemoStyle';
    s.textContent=`
      #zoomDemoLaunch{position:fixed;right:18px;bottom:18px;z-index:120;border:0;border-radius:999px;padding:11px 16px;background:#123b67;color:#fff;font-weight:800;box-shadow:0 10px 28px rgba(18,59,103,.28);cursor:pointer;display:none}
      #zoomDemoPanel{position:fixed;right:18px;bottom:18px;width:min(380px,calc(100vw - 28px));z-index:121;background:#fff;border:1px solid #dfe7ef;border-radius:18px;box-shadow:0 20px 60px rgba(10,35,60,.28);overflow:hidden;display:none;font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif}
      #zoomDemoPanel .zd-head{background:#123b67;color:#fff;padding:14px 16px;display:flex;align-items:center;justify-content:space-between;gap:10px}
      #zoomDemoPanel .zd-head b{font-size:15px}#zoomDemoPanel .zd-head small{opacity:.82}
      #zoomDemoPanel .zd-close{border:0;background:rgba(255,255,255,.14);color:#fff;border-radius:8px;padding:6px 9px;cursor:pointer}
      #zoomDemoPanel .zd-progress{height:5px;background:#e8eef4}#zoomDemoPanel .zd-progress span{display:block;height:100%;background:#1e5d91;transition:width .25s ease}
      #zoomDemoPanel .zd-body{padding:15px 16px 12px}#zoomDemoPanel h3{margin:0 0 6px;color:#123b67;font-size:19px}#zoomDemoPanel p{margin:8px 0;line-height:1.45;color:#405064;font-size:14px}
      #zoomDemoPanel .zd-meta{display:flex;justify-content:space-between;gap:10px;margin:0 0 10px;font-size:12px;color:#657487;font-weight:700}
      #zoomDemoPanel .zd-note{background:#f1f6fb;border-left:4px solid #1e5d91;padding:10px 11px;border-radius:8px;margin-top:10px}
      #zoomDemoPanel .zd-key{background:#fff8e8;border:1px solid #f0dfab;padding:9px 10px;border-radius:8px;margin-top:9px;font-size:13px;color:#6a5722;line-height:1.4}
      #zoomDemoPanel .zd-actions{display:flex;gap:8px;flex-wrap:wrap;padding:0 16px 15px}#zoomDemoPanel .zd-actions button{border:0;border-radius:9px;padding:9px 11px;cursor:pointer;font-weight:750}
      #zoomDemoPanel .zd-primary{background:#123b67;color:#fff}#zoomDemoPanel .zd-soft{background:#eaf1f7;color:#123b67}#zoomDemoPanel .zd-light{background:#f5f7fa;color:#405064}
      #zoomDemoBar{position:fixed;left:50%;transform:translateX(-50%);bottom:14px;z-index:119;background:rgba(18,59,103,.96);color:#fff;border-radius:999px;padding:8px 13px;box-shadow:0 8px 22px rgba(10,35,60,.22);font-size:12px;font-weight:800;display:none;max-width:calc(100vw - 30px);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      body.zoom-demo-active header{box-shadow:0 4px 16px rgba(18,59,103,.10)}
      @media(max-width:700px){#zoomDemoPanel{right:10px;bottom:10px;width:calc(100vw - 20px)}#zoomDemoLaunch{right:12px;bottom:12px}}
      @media print{#zoomDemoPanel,#zoomDemoLaunch,#zoomDemoBar{display:none!important}}
    `;
    document.head.appendChild(s);
  }

  function canLaunch(){
    try{return typeof window.isAnyAdmin==='function' && window.isAnyAdmin()}catch(e){return false}
  }

  function el(tag,attrs={},html=''){
    const n=document.createElement(tag);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,v));n.innerHTML=html;return n;
  }

  function build(){
    if(document.getElementById('zoomDemoLaunch'))return;
    css();
    const launch=el('button',{id:'zoomDemoLaunch',type:'button','aria-label':'Iniciar modo presentación Zoom'},'🎥 Presentar en Zoom');
    launch.onclick=start;
    document.body.appendChild(launch);

    const bar=el('div',{id:'zoomDemoBar','aria-live':'polite'},'');document.body.appendChild(bar);
    const panel=el('aside',{id:'zoomDemoPanel','aria-label':'Asistente de presentación Zoom'},`
      <div class="zd-head"><div><b>🎥 Modo Presentación Zoom</b><br><small id="zdCounter"></small></div><button class="zd-close" id="zdClose">Salir</button></div>
      <div class="zd-progress"><span id="zdProgress"></span></div>
      <div class="zd-body">
        <div class="zd-meta"><span id="zdTime"></span><span id="zdTimer">00:00</span></div>
        <h3 id="zdTitle"></h3>
        <div id="zdNotes"><p id="zdSay"></p><div class="zd-key" id="zdKey"></div></div>
      </div>
      <div class="zd-actions">
        <button class="zd-soft" id="zdPrev">← Anterior</button>
        <button class="zd-primary" id="zdOpen">Mostrar sección</button>
        <button class="zd-primary" id="zdNext">Siguiente →</button>
        <button class="zd-light" id="zdToggle">Ocultar guion</button>
      </div>`);
    document.body.appendChild(panel);
    document.getElementById('zdClose').onclick=stop;
    document.getElementById('zdPrev').onclick=()=>move(-1);
    document.getElementById('zdNext').onclick=()=>move(1);
    document.getElementById('zdOpen').onclick=()=>openStep(STEPS[idx]);
    document.getElementById('zdToggle').onclick=toggleNotes;
    document.addEventListener('keydown',e=>{
      if(!document.body.classList.contains('zoom-demo-active'))return;
      if(e.key==='ArrowRight'){e.preventDefault();move(1)}
      if(e.key==='ArrowLeft'){e.preventDefault();move(-1)}
      if(e.key==='Escape'){e.preventDefault();stop()}
    });
    refreshLaunch();
  }

  function refreshLaunch(){
    const b=document.getElementById('zoomDemoLaunch');if(!b)return;
    b.style.display=canLaunch()&&!document.body.classList.contains('zoom-demo-active')?'block':'none';
  }

  function start(){
    if(!canLaunch()){alert('El Modo Presentación está disponible para Administración General y Administración de Plataforma.');return}
    idx=0;startedAt=Date.now();notesVisible=true;
    document.body.classList.add('zoom-demo-active');
    document.getElementById('zoomDemoLaunch').style.display='none';
    document.getElementById('zoomDemoPanel').style.display='block';
    document.getElementById('zoomDemoBar').style.display='block';
    document.getElementById('zdNotes').style.display='block';
    document.getElementById('zdToggle').textContent='Ocultar guion';
    render();openStep(STEPS[idx]);
    clearInterval(timerId);timerId=setInterval(updateTimer,1000);updateTimer();
  }

  function stop(){
    document.body.classList.remove('zoom-demo-active');
    const p=document.getElementById('zoomDemoPanel'),bar=document.getElementById('zoomDemoBar');
    if(p)p.style.display='none';if(bar)bar.style.display='none';clearInterval(timerId);timerId=null;refreshLaunch();
  }

  function move(delta){
    idx=Math.max(0,Math.min(STEPS.length-1,idx+delta));render();openStep(STEPS[idx]);
  }

  function render(){
    const s=STEPS[idx];
    document.getElementById('zdCounter').textContent=`Paso ${idx+1} de ${STEPS.length}`;
    document.getElementById('zdProgress').style.width=`${((idx+1)/STEPS.length)*100}%`;
    document.getElementById('zdTime').textContent='Tiempo sugerido: '+s.time;
    document.getElementById('zdTitle').textContent=s.title;
    document.getElementById('zdSay').innerHTML='<b>Qué decir:</b> '+s.say;
    document.getElementById('zdKey').innerHTML='<b>Qué mostrar:</b> '+s.key;
    document.getElementById('zdPrev').disabled=idx===0;
    document.getElementById('zdNext').textContent=idx===STEPS.length-1?'Finalizar':'Siguiente →';
    document.getElementById('zdNext').onclick=idx===STEPS.length-1?stop:()=>move(1);
    document.getElementById('zoomDemoBar').textContent=`${idx+1}/${STEPS.length} · ${s.title.replace(/^\d+\.\s*/,'')} · ${s.time} · ← → para avanzar`;
  }

  function updateTimer(){
    if(!startedAt)return;const sec=Math.floor((Date.now()-startedAt)/1000),m=String(Math.floor(sec/60)).padStart(2,'0'),s=String(sec%60).padStart(2,'0');
    const t=document.getElementById('zdTimer');if(t)t.textContent=m+':'+s;
  }

  function toggleNotes(){
    notesVisible=!notesVisible;const n=document.getElementById('zdNotes');if(n)n.style.display=notesVisible?'block':'none';
    document.getElementById('zdToggle').textContent=notesVisible?'Ocultar guion':'Mostrar guion';
  }

  function privateReady(){return !!(window.currentUser||typeof currentUser!=='undefined'&&currentUser)}

  function openPrivate(tab){
    try{
      if(typeof go==='function')go('mifrente');
      if(typeof privateTab==='function')privateTab(tab);
      setTimeout(()=>{
        if(tab==='espacio'){
          const h=[...document.querySelectorAll('h2')].find(x=>/Revisión del documento|Metodología de estudio/i.test(x.textContent||''));
          if(h&&idx===6)h.scrollIntoView({behavior:'smooth',block:'start'});
        }
      },220);
    }catch(e){console.error('Zoom demo private step',e)}
  }

  function openStep(step){
    try{
      if(step.page&&typeof go==='function'){go(step.page);return}
      if(step.privateTab){
        if(!privateReady()){
          if(typeof go==='function')go('mesas');
          alert('Para mostrar este paso, ingrese primero con su cuenta administrativa. Luego vuelva a iniciar o continúe el Modo Presentación.');
          return;
        }
        openPrivate(step.privateTab);return;
      }
      if(step.action==='directorio'){
        if(privateReady()&&typeof go==='function'&&typeof renderAdminShell==='function'&&typeof adminRepresentantes==='function'&&typeof isAnyAdmin==='function'&&isAnyAdmin()){
          go('adminarea');renderAdminShell();adminRepresentantes();
        }else if(typeof go==='function')go('quienes');
        return;
      }
      if(step.action==='admin'){
        if(privateReady()&&typeof isAnyAdmin==='function'&&isAnyAdmin()&&typeof go==='function'){
          go('adminarea');if(typeof renderAdminShell==='function')renderAdminShell();if(typeof adminHome==='function')adminHome();
        }else if(typeof go==='function')go('mesas');
      }
    }catch(e){console.error('Zoom demo step',e)}
  }

  function watch(){refreshLaunch()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',build);else build();
  setInterval(watch,1600);
})();
