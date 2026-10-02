/* Corrección 2026-10-02: formulario único para invitación directa.
   Evita confundir nombre y correo mostrando ambos campos al mismo tiempo,
   valida los datos y conserva el flujo de envío y registro. */
(function(){
  'use strict';

  function normalizeInviteEmail(value){
    return String(value || '')
      .normalize('NFKC')
      .replace(/[\s\u200B-\u200D\uFEFF]+/g, '')
      .toLowerCase();
  }

  function isValidInviteEmail(email){
    const parts=email.split('@');
    if(parts.length!==2 || !parts[0] || !parts[1]) return false;
    const localOk=/^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(parts[0]);
    const domainOk=/^[A-Z0-9-]+(?:\.[A-Z0-9-]+)+$/i.test(parts[1]);
    return localOk && domainOk;
  }

  function inviteDialog(){
    return new Promise((resolve)=>{
      const overlay=document.createElement('div');
      overlay.style.cssText='position:fixed;inset:0;background:rgba(24,28,52,.45);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;';

      const box=document.createElement('div');
      box.style.cssText='width:min(520px,100%);background:#fff;border-radius:14px;box-shadow:0 18px 50px rgba(0,0,0,.25);padding:22px;font-family:Arial,sans-serif;color:#222;';
      box.innerHTML=`
        <div style="font-size:21px;font-weight:700;color:#253b7b;margin-bottom:6px">Invitar profesional</div>
        <div style="font-size:14px;color:#5b6472;margin-bottom:18px">Ingrese el nombre completo y el correo electrónico de la persona.</div>
        <label style="display:block;font-size:14px;font-weight:700;margin-bottom:6px">Nombre completo</label>
        <input id="directInviteName" type="text" autocomplete="name" placeholder="Ej.: María Pérez González" style="box-sizing:border-box;width:100%;padding:11px 12px;border:1px solid #b7bdc9;border-radius:8px;font-size:15px;margin-bottom:14px">
        <label style="display:block;font-size:14px;font-weight:700;margin-bottom:6px">Correo electrónico</label>
        <input id="directInviteEmail" type="email" autocomplete="email" placeholder="Ej.: nombre@correo.cl" style="box-sizing:border-box;width:100%;padding:11px 12px;border:1px solid #b7bdc9;border-radius:8px;font-size:15px">
        <div id="directInviteError" style="min-height:20px;margin-top:8px;color:#b42318;font-size:13px"></div>
        <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:16px">
          <button id="directInviteCancel" type="button" style="padding:10px 16px;border:1px solid #b7bdc9;border-radius:8px;background:#fff;cursor:pointer">Cancelar</button>
          <button id="directInviteSend" type="button" style="padding:10px 16px;border:0;border-radius:8px;background:#253b7b;color:white;font-weight:700;cursor:pointer">Enviar invitación</button>
        </div>`;

      overlay.appendChild(box);
      document.body.appendChild(overlay);

      const nameInput=box.querySelector('#directInviteName');
      const emailInput=box.querySelector('#directInviteEmail');
      const errorEl=box.querySelector('#directInviteError');
      const sendBtn=box.querySelector('#directInviteSend');

      function close(result){
        overlay.remove();
        resolve(result);
      }

      box.querySelector('#directInviteCancel').onclick=()=>close(null);
      overlay.addEventListener('click',(e)=>{ if(e.target===overlay) close(null); });

      function submit(){
        const fullName=String(nameInput.value || '').trim();
        const clean=normalizeInviteEmail(emailInput.value);

        if(!fullName){
          errorEl.textContent='Ingrese el nombre completo de la persona.';
          nameInput.focus();
          return;
        }
        if(fullName.includes('@')){
          errorEl.textContent='En “Nombre completo” debe ingresar el nombre de la persona, no su correo.';
          nameInput.focus();
          return;
        }
        if(!isValidInviteEmail(clean)){
          errorEl.textContent='Ingrese un correo electrónico válido.';
          emailInput.focus();
          return;
        }
        close({fullName,email:clean});
      }

      sendBtn.onclick=submit;
      box.addEventListener('keydown',(e)=>{
        if(e.key==='Enter') submit();
        if(e.key==='Escape') close(null);
      });
      setTimeout(()=>nameInput.focus(),0);
    });
  }

  window.adminInvitacionDirecta=async function(){
    const values=await inviteDialog();
    if(!values) return;

    try{
      const {data,error}=await sbAuth.functions.invoke('member-invitation',{
        body:{action:'direct_invite',email:values.email,full_name:values.fullName}
      });
      if(error) throw error;
      if(!data?.ok) throw new Error(data?.error || 'No fue posible enviar la invitación.');

      alert(
        data.status==='Registro completado'
          ? 'Este correo ya tiene el registro completado.'
          : 'Invitación enviada correctamente a '+values.fullName+'. El correo quedó registrado en la lista de invitaciones.'
      );
      await window.adminInvitaciones();
    }catch(err){
      console.error('Error al enviar invitación:',err);
      alert(err?.message || 'No fue posible enviar la invitación. Intente nuevamente.');
    }
  };
})();