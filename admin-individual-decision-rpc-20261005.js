/* Decisión atómica de Administración para aportes individuales — 05-10-2026 */
(function(){
  'use strict';
  async function decide(id,action,observation){
    if(typeof sbAuth==='undefined'||!sbAuth)throw new Error('Servicio de datos no disponible');
    const {data,error}=await sbAuth.rpc('admin_decide_individual_contribution',{
      p_request_id:id,
      p_action:action,
      p_observation:observation||null
    });
    if(error)throw error;
    return data;
  }

  window.devolverAporteIndividualAdmin=async function(id){
    const obs=prompt('Indique la observación que recibirá el autor para corregir el aporte:','');
    if(obs===null)return;
    if(!obs.trim()){alert('Debe escribir una observación antes de devolver el aporte.');return}
    if(!confirm('¿Devolver este aporte al autor para corrección?'))return;
    try{
      await decide(id,'devolver',obs.trim());
      alert('Aporte devuelto correctamente. La observación quedó registrada y el autor puede corregirlo.');
      await window.adminPublicaciones();
    }catch(err){
      console.error(err);
      alert('No fue posible devolver el aporte: '+(err?.message||'error desconocido'));
    }
  };

  window.publicarAporteIndividualAdmin=async function(id){
    if(!confirm('¿Publicar este aporte en la Biblioteca pública?'))return;
    try{
      await decide(id,'publicar',null);
      alert('Aporte publicado correctamente en la Biblioteca.');
      await window.adminPublicaciones();
    }catch(err){
      console.error(err);
      alert('No fue posible publicar el aporte: '+(err?.message||'error desconocido'));
    }
  };
})();
