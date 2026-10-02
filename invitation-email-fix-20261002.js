/* Corrección 2026-10-02: validación robusta de correo sin perder el flujo completo de invitación.
   Conserva nombre completo + correo + registro del envío. */
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

  window.adminInvitacionDirecta=async function(){
    const name=prompt('Nombre completo de la persona:');
    if(name===null) return;
    const fullName=String(name).trim();
    if(!fullName) return alert('Ingrese el nombre completo.');

    const email=prompt('Correo electrónico:');
    if(email===null) return;
    const clean=normalizeInviteEmail(email);
    if(!isValidInviteEmail(clean)){
      return alert('Ingrese un correo electrónico válido.');
    }

    try{
      const {data,error}=await sbAuth.functions.invoke('member-invitation',{
        body:{action:'direct_invite',email:clean,full_name:fullName}
      });
      if(error) throw error;
      if(!data?.ok) throw new Error(data?.error || 'No fue posible enviar la invitación.');

      alert(
        data.status==='Registro completado'
          ? 'Este correo ya tiene el registro completado.'
          : 'Invitación enviada correctamente a '+fullName+'. El correo quedó registrado en la lista de invitaciones.'
      );
      await window.adminInvitaciones();
    }catch(err){
      console.error('Error al enviar invitación:',err);
      alert(err?.message || 'No fue posible enviar la invitación. Intente nuevamente.');
    }
  };
})();