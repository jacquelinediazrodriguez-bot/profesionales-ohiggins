/* Corrección de resolución de Mesa en nube — 06-10-2026 */
(function(){
  'use strict';

  const IDS={
    salud:1,
    educacion:2,
    economia:3,
    trabajo:4,
    agricultura:5
  };

  function normalizarMesa(v){
    return String(v||'')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g,'')
      .trim()
      .toLowerCase();
  }

  /*
   * sync.js mantiene su mapa de ids dentro de un cierre privado.
   * Las funciones globales de guardar/restaurar versiones necesitan un
   * resolvedor visible. Exponemos uno estable para las Mesas oficiales.
   */
  window.mesaId=function(nombre){
    return IDS[normalizarMesa(nombre)]||null;
  };
})();
