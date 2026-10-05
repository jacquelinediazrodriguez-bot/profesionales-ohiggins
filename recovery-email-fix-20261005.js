// Corrección de validación y envío de recuperación de contraseña — 2026-10-05
(function(){
  window.solicitarRecuperacionClave = async function(){
    const input = document.getElementById('recoveryEmail');
    const s = document.getElementById('recoveryStatus');
    const btn = document.getElementById('recoverySubmit');
    if(!input || !s) return;

    const e = String(input.value || '').trim().toLowerCase();
    input.value = e;

    // Validación simple y correcta para correos habituales (incluido Gmail).
    const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
    if(!emailValido){
      s.textContent = 'Ingrese un correo electrónico válido.';
      input.focus();
      return;
    }

    if(typeof sbAuth === 'undefined' || !sbAuth || !sbAuth.auth){
      s.textContent = 'El servicio de recuperación no está disponible en este momento.';
      return;
    }

    if(btn){
      btn.disabled = true;
      btn.textContent = 'Enviando…';
    }
    s.textContent = 'Enviando enlace de recuperación…';

    try{
      const redirectTo = location.origin + location.pathname;
      const { error } = await sbAuth.auth.resetPasswordForEmail(e, { redirectTo });
      if(error) throw error;
      s.textContent = 'Enlace solicitado. Si el correo pertenece a una cuenta registrada, recibirá un mensaje para crear una nueva contraseña. Revise también Spam o No deseado.';
    }catch(err){
      console.error('Error recuperación de contraseña:', err);
      const msg = String((err && err.message) || '');
      s.textContent = /rate limit|too many/i.test(msg)
        ? 'Se alcanzó temporalmente el límite de envíos. Espere unos minutos y vuelva a intentarlo.'
        : 'No fue posible enviar el enlace. Inténtelo nuevamente en unos minutos.';
    }finally{
      if(btn){
        btn.disabled = false;
        btn.textContent = 'Enviar enlace de recuperación';
      }
    }
  };
})();
