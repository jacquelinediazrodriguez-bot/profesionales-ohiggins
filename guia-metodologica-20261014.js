/* Guía metodológica: incorporación aditiva sin alterar el flujo documental. */
(function(){
  function addGuideEntry(){
    var source=document.querySelector('#privateNav [data-ptab="fuentes"], [data-ptab="fuentes"]');
    if(!source || document.querySelector('[data-ptab="guia-metodologica"]'))return;
    var button=document.createElement('button');
    button.setAttribute('data-ptab','guia-metodologica');
    button.textContent='📘 Guía Metodológica';
    button.addEventListener('click',function(){
      if(typeof window.privateTab==='function')window.privateTab('fuentes');
      var content=document.getElementById('privatecontent');
      if(!content)return;
      content.innerHTML=`
        <div class="kicker">Mesas Técnicas · Material de apoyo</div>
        <h1 class="section-title">Guía Metodológica</h1>
        <div class="notice"><b>Instrumento orientador, no obligatorio.</b> Esta guía complementa el esquema de trabajo vigente de las mesas técnicas, sin modificar las responsabilidades, la edición por secciones, la revisión del coordinador ni el procedimiento de publicación.</div>
        <div class="card" style="margin-top:16px"><h2>Cómo utilizar estas orientaciones</h2>
        <p>Identifique el tipo de propuesta que está desarrollando su mesa. Consulte los métodos sugeridos y aplique únicamente los instrumentos que resulten pertinentes. El documento oficial continúa elaborándose y validándose mediante el procedimiento habitual de Mi Trabajo.</p></div>
        <div class="grid2" style="margin-top:16px">
          <article class="card"><h3>Diagnósticos y estudios regionales</h3><p><b>Etapas:</b> definir el problema, recopilar evidencia territorial, analizar causas, contrastar alternativas y formular conclusiones.</p><p><b>Herramientas:</b> estadísticas, entrevistas, análisis comparativo, árbol de problemas y matriz de hallazgos.</p></article>
          <article class="card"><h3>Políticas públicas</h3><p><b>Etapas:</b> delimitar el problema público, identificar actores y población afectada, analizar opciones, formular medidas y estimar sus efectos.</p><p><b>Herramientas:</b> mapa de actores, análisis de alternativas, criterios de implementación e indicadores.</p></article>
          <article class="card"><h3>Proyectos y programas sociales</h3><p><b>Etapas:</b> diagnóstico, población beneficiaria, objetivos, intervención, recursos, factibilidad y evaluación preliminar.</p><p><b>Herramientas:</b> árbol de problemas y objetivos, matriz de Marco Lógico, presupuesto, indicadores y riesgos, según corresponda.</p></article>
          <article class="card"><h3>Desarrollo productivo</h3><p><b>Etapas:</b> identificar oportunidad o brecha, evaluar demanda, definir beneficiarios, recursos e inversión, analizar viabilidad y resultados.</p><p><b>Herramientas:</b> análisis de mercado, evaluación de factibilidad, costos y cronograma.</p></article>
          <article class="card"><h3>Propuestas normativas</h3><p><b>Etapas:</b> definir el problema regulatorio, revisar normas vigentes, formular alternativas, analizar efectos y recomendar ajustes.</p><p><b>Herramientas:</b> análisis jurídico, matriz comparativa e identificación de impactos.</p></article>
          <article class="card"><h3>Informes técnicos y de contingencia</h3><p><b>Etapas:</b> recopilar antecedentes, analizar hechos y evidencia, identificar implicancias y formular recomendaciones.</p><p><b>Herramientas:</b> línea de tiempo, análisis documental, matriz de riesgos y conclusiones.</p></article>
        </div>
        <div class="card" style="margin-top:16px"><h2>Criterios comunes de calidad</h2><p>Fundamentar afirmaciones en fuentes identificables, distinguir hechos de opiniones, explicitar beneficiarios y resultados cuando corresponda, reconocer límites de información y presentar recomendaciones concretas.</p>
        <p><b>Importante:</b> los métodos de esta sección son recursos de consulta. Ninguno reemplaza el circuito institucional de elaboración, revisión, validación y publicación.</p></div>`;
      document.querySelectorAll('[data-ptab]').forEach(function(el){el.classList.remove('active')});
      button.classList.add('active');
    });
    source.insertAdjacentElement('afterend',button);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',addGuideEntry);
  else addGuideEntry();
})();
