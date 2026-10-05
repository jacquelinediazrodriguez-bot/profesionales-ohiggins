// Recuperación de contraseña — producción — 2026-10-05
(function(){
  const PROD_URL = 'https://www.profesionalesohiggins.cl/';

  function setStatus(msg){
    const s = document.getElementById('recoveryStatus');
    if(s) s.textContent = msg;
  }

  window.solicitarRecuperacionClave = async function(){
    const input = document.getElementById('recoveryEmail');
    const btn = document.getElementById('recoverySubmit');
    if(!input) return;

    const e = String(input.value || '').trim().toLowerCase();
    input.value = e;

    const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
    if(!emailValido){
      setStatus('Ingrese un correo electrónico válido.');
      input.focus();
      return;
    }

    if(typeof sbAuth === 'undefined' || !sbAuth || !sbAuth.auth){
      setStatus('El servicio de recuperación no está disponible en este momento.');
      return;
    }

    if(btn){
      btn.disabled = true;
      btn.textContent = 'Enviando…';
    }
    setStatus('Enviando enlace de recuperación…');

    try{
      // IMPORTANTE: nunca usar localhost en producción.
      // La URL debe coincidir con una Redirect URL autorizada en Supabase.
      const { error } = await sbAuth.auth.resetPasswordForEmail(e, {
        redirectTo: PROD_URL
      });
      if(error) throw error;
      setStatus('Enlace solicitado. Si el correo pertenece a una cuenta registrada, recibirá un mensaje para crear una nueva contraseña. Revise también Spam o No deseado.');
    }catch(err){
      console.error('Error recuperación de contraseña:', err);
      const msg = String((err && err.message) || '');
      setStatus(/rate limit|too many/i.test(msg)
        ? 'Se alcanzó temporalmente el límite de envíos. Espere unos minutos y vuelva a intentarlo.'
        : 'No fue posible enviar el enlace. Inténtelo nuevamente en unos minutos.');
    }finally{
      if(btn){
        btn.disabled = false;
        btn.textContent = 'Enviar enlace de recuperación';
      }
    }
  };

  function abrirCambioClave(){
    if(document.getElementById('pt-reset-password-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'pt-reset-password-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:20px;font-family:Arial,sans-serif';
    overlay.innerHTML = `
      <div style="background:#fff;width:min(460px,100%);border-radius:14px;padding:24px;box-shadow:0 18px 60px rgba(0,0,0,.3)">
        <h2 style="margin:0 0 8px;color:#17345b;font-size:22px">Crear nueva contraseña</h2>
        <p style="margin:0 0 18px;color:#555;line-height:1.4">Ingrese una nueva contraseña para su cuenta.</p>
        <label style="display:block;margin:0 0 6px;font-weight:700">Nueva contraseña</label>
        <input id="pt-reset-pass1" type="password" autocomplete="new-password" style="box-sizing:border-box;width:100%;padding:11px;border:1px solid #bbb;border-radius:8px;margin-bottom:12px">
        <label style="display:block;margin:0 0 6px;font-weight:700">Confirmar contraseña</label>
        <input id="pt-reset-pass2" type="password" autocomplete="new-password" style="box-sizing:border-box;width:100%;padding:11px;border:1px solid #bbb;border-radius:8px;margin-bottom:12px">
        <div id="pt-reset-msg" style="min-height:20px;margin-bottom:12px;color:#a22;font-size:14px"></div>
        <button id="pt-reset-save" type="button" style="width:100%;border:0;border-radius:8px;padding:11px 14px;background:#17345b;color:#fff;font-weight:700;cursor:pointer">Guardar nueva contraseña</button>
      </div>`;
    document.body.appendChild(overlay);

    const p1 = overlay.querySelector('#pt-reset-pass1');
    const p2 = overlay.querySelector('#pt-reset-pass2');
    const msg = overlay.querySelector('#pt-reset-msg');
    const save = overlay.querySelector('#pt-reset-save');

    save.addEventListener('click', async function(){
      const a = String(p1.value || '');
      const b = String(p2.value || '');
      if(a.length < 8){ msg.textContent = 'La contraseña debe tener al menos 8 caracteres.'; return; }
      if(a !== b){ msg.textContent = 'Las contraseñas no coinciden.'; return; }
      if(typeof sbAuth === 'undefined' || !sbAuth || !sbAuth.auth){ msg.textContent = 'Servicio no disponible.'; return; }

      save.disabled = true;
      save.textContent = 'Guardando…';
      msg.textContent = '';
      try{
        const { error } = await sbAuth.auth.updateUser({ password: a });
        if(error) throw error;
        msg.style.color = '#18713b';
        msg.textContent = 'Contraseña actualizada correctamente. Redirigiendo al inicio…';
        try{ await sbAuth.auth.signOut(); }catch(_e){}
        setTimeout(function(){ window.location.replace(PROD_URL); }, 1200);
      }catch(err){
        console.error('Error al actualizar contraseña:', err);
        msg.style.color = '#a22';
        msg.textContent = 'No fue posible actualizar la contraseña. Solicite un nuevo enlace e inténtelo nuevamente.';
        save.disabled = false;
        save.textContent = 'Guardar nueva contraseña';
      }
    });
    setTimeout(function(){ p1.focus(); }, 50);
  }

  function detectarRecuperacionDesdeUrl(){
    const h = new URLSearchParams((window.location.hash || '').replace(/^#/,''));
    if(h.get('type') === 'recovery' && h.get('access_token')) abrirCambioClave();
  }

  // Supabase JS también emite PASSWORD_RECOVERY al procesar el enlace.
  function enlazarEventoRecuperacion(){
    if(typeof sbAuth === 'undefined' || !sbAuth || !sbAuth.auth || typeof sbAuth.auth.onAuthStateChange !== 'function') return;
    sbAuth.auth.onAuthStateChange(function(event){
      if(event === 'PASSWORD_RECOVERY') abrirCambioClave();
    });
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){
      detectarRecuperacionDesdeUrl();
      enlazarEventoRecuperacion();
    }, {once:true});
  }else{
    detectarRecuperacionDesdeUrl();
    enlazarEventoRecuperacion();
  }
})();
