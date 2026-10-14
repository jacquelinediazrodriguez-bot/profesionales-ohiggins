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
          <article class="card"><h3>Diagnósticos y estudios regionales</h3><p><b>Etapas:</b> definir el problema, recopilar evidencia territorial, analizar causas, contrastar alternativas y formular conclusiones.</p><p><b>Herramientas:</b> estadísticas, entrevistas, análisis comparativo, árbol de problemas y matriz de hallazgos.</p><p style="font-size:.88em"><b>Referencia orientadora:</b> <a href="https://www.cepal.org/es/publicaciones/5607-metodologia-marco-logico-la-planificacion-seguimiento-la-evaluacion-proyectos" target="_blank" rel="noopener noreferrer">CEPAL/ILPES, Ortegón, Pacheco y Prieto (2005), Metodología del marco lógico</a>.</p></article>
          <article class="card"><h3>Políticas públicas</h3><p><b>Etapas:</b> delimitar el problema público, identificar actores y población afectada, analizar opciones, formular medidas y estimar sus efectos.</p><p><b>Herramientas:</b> mapa de actores, análisis de alternativas, criterios de implementación e indicadores.</p><p style="font-size:.88em"><b>Referencia orientadora:</b> <a href="https://www.cepal.org/es/publicaciones/5507-formulacion-programas-la-metodologia-marco-logico" target="_blank" rel="noopener noreferrer">CEPAL/ILPES, Aldunate y Córdoba (2011), Formulación de programas con metodología de marco lógico</a>.</p></article>
          <article class="card"><h3>Proyectos y programas sociales</h3><p><b>Etapas:</b> diagnóstico, población beneficiaria, objetivos, intervención, recursos, factibilidad y evaluación preliminar.</p><p><b>Herramientas:</b> árbol de problemas y objetivos, matriz de Marco Lógico, presupuesto, indicadores y riesgos, según corresponda.</p><p style="font-size:.88em"><b>Referencia orientadora:</b> <a href="https://dds.cepal.org/redesoc/publicacion?id=141" target="_blank" rel="noopener noreferrer">CEPAL, Cohen y Martínez (2003), Manual de formulación, evaluación y monitoreo de proyectos sociales</a>.</p></article>
          <article class="card"><h3>Desarrollo productivo</h3><p><b>Etapas:</b> identificar oportunidad o brecha, evaluar demanda, definir beneficiarios, recursos e inversión, analizar viabilidad y resultados.</p><p><b>Herramientas:</b> análisis de mercado, evaluación de factibilidad, costos y cronograma.</p><p style="font-size:.88em"><b>Referencia orientadora:</b> <a href="https://www.cepal.org/es/publicaciones/5608-metodologia-general-identificacion-preparacion-evaluacion-proyectos-inversion" target="_blank" rel="noopener noreferrer">CEPAL/ILPES, Ortegón, Pacheco y Roura (2005), Metodología general de identificación, preparación y evaluación de proyectos de inversión pública</a>.</p></article>
          <article class="card"><h3>Propuestas normativas</h3><p><b>Etapas:</b> definir el problema regulatorio, revisar normas vigentes, formular alternativas, analizar efectos y recomendar ajustes.</p><p><b>Herramientas:</b> análisis jurídico, matriz comparativa e identificación de impactos.</p><p style="font-size:.88em"><b>Referencia orientadora:</b> <a href="https://www.oecd.org/en/publications/regulatory-impact-assessment_7a9638cb-en.html" target="_blank" rel="noopener noreferrer">OCDE (2020), Regulatory Impact Assessment, OECD Best Practice Principles</a>.</p></article>
          <article class="card"><h3>Informes técnicos y de contingencia</h3><p><b>Etapas:</b> recopilar antecedentes, analizar hechos y evidencia, identificar implicancias y formular recomendaciones.</p><p><b>Herramientas:</b> línea de tiempo, análisis documental, matriz de riesgos y conclusiones.</p><p style="font-size:.88em"><b>Referencia orientadora:</b> <a href="https://www.cepal.org/es/publicaciones/5607-metodologia-marco-logico-la-planificacion-seguimiento-la-evaluacion-proyectos" target="_blank" rel="noopener noreferrer">CEPAL/ILPES, Ortegón, Pacheco y Prieto (2005), Metodología del marco lógico</a>.</p></article>
        </div>

        <div class="card" style="margin-top:16px"><h2>Bibliografía y documentos de consulta</h2><p>Referencias metodológicas para consulta voluntaria. Cada mesa podrá seleccionar las herramientas apropiadas según el tipo de propuesta.</p><ol>
        <li>Cohen, E. y Martínez, R. (2003). <a href="https://dds.cepal.org/redesoc/publicacion?id=141" target="_blank" rel="noopener noreferrer">Manual de formulación, evaluación y monitoreo de proyectos sociales</a>. CEPAL.</li>
        <li>Ortegón, E., Pacheco, J. F. y Prieto, A. (2005). <a href="https://www.cepal.org/es/publicaciones/5607-metodologia-marco-logico-la-planificacion-seguimiento-la-evaluacion-proyectos" target="_blank" rel="noopener noreferrer">Metodología del marco lógico para la planificación, el seguimiento y la evaluación de proyectos y programas</a>. CEPAL/ILPES.</li>
        <li>Aldunate, E. y Córdoba, J. (2011). <a href="https://www.cepal.org/es/publicaciones/5507-formulacion-programas-la-metodologia-marco-logico" target="_blank" rel="noopener noreferrer">Formulación de programas con la metodología de marco lógico</a>. CEPAL/ILPES.</li>
        <li>Ortegón, E., Pacheco, J. F. y Roura, H. (2005). <a href="https://www.cepal.org/es/publicaciones/5608-metodologia-general-identificacion-preparacion-evaluacion-proyectos-inversion" target="_blank" rel="noopener noreferrer">Metodología general de identificación, preparación y evaluación de proyectos de inversión pública</a>. CEPAL/ILPES.</li>
        <li>Ministerio de Desarrollo Social y Familia (Chile). <a href="https://sni.gob.cl/formulacion-de-iniciativas/herramientas-metodologicas-transversales/" target="_blank" rel="noopener noreferrer">Sistema Nacional de Inversiones: herramientas metodológicas transversales</a>. Consulte la versión vigente.</li>
        <li>OCDE (2020). <a href="https://www.oecd.org/en/publications/regulatory-impact-assessment_7a9638cb-en.html" target="_blank" rel="noopener noreferrer">Regulatory Impact Assessment: OECD Best Practice Principles for Regulatory Policy</a>.</li>
        </ol><p><b>Diferencia importante:</b> esta bibliografía enseña métodos de trabajo; las fuentes de información de la plataforma aportan datos y evidencias sobre la realidad regional. Ninguna referencia crea nuevos requisitos de revisión o publicación.</p></div>
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
