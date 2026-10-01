(function(){
  // Corrige el cambio de Mesa desde el menú lateral de "Mi Trabajo".
  // El problema anterior era que, después de cambiar currentDocMesa,
  // privateTab('espacio') volvía a guardar el editor todavía visible y
  // terminaba escribiendo el contenido de la Mesa anterior en la nueva.
  window.cambiarMesaDesdeMenu = function(m){
    try{
      if(!m) return;
      if(typeof currentDocMesa !== 'undefined' && m === currentDocMesa){
        if(typeof privateTab === 'function') privateTab('espacio');
        return;
      }

      // Guardar la Mesa que realmente está visible ANTES de cambiar el contexto.
      if(typeof $ === 'function' && $('wsTitulo') && typeof syncWorkFromUI === 'function'){
        syncWorkFromUI(true);
      }
      if(typeof releaseMyLocks === 'function') releaseMyLocks();

      // Cambiar el contexto una sola vez y renderizar directamente.
      currentDocMesa = m;
      document.querySelectorAll('[data-ptab]').forEach(function(b){
        b.classList.toggle('active', b.dataset.ptab === 'espacio');
      });
      var c = typeof $ === 'function' ? $('privatecontent') : document.getElementById('privatecontent');
      if(c && typeof renderEspacio === 'function') renderEspacio(c);
      if(typeof renderSideMesas === 'function') renderSideMesas('espacio');
    }catch(err){
      console.error('Error al cambiar de Mesa desde el menú lateral', err);
    }
  };
})();
