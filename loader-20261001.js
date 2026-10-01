(async function(){
 try{
  const r=await fetch('./app-20261001.html?v=2',{cache:'no-store'});
  if(!r.ok)throw new Error('No se pudo cargar la plataforma');
  let t=await r.text();
  t=t.replace('</body>','<script src="./fixes-20261001.js?v=2"><\/script><script src="./roles-20261001.js?v=3"><\/script><script src="./access-fix-20261001.js?v=1"><\/script><script src="./admin-work-button-20261001.js?v=1"><\/script></body>');
  document.open();document.write(t);document.close();
 }catch(e){
  document.body.innerHTML='<p style="font-family:Arial;padding:30px">No fue posible cargar la plataforma. Recargue la página.</p>';
  console.error(e);
 }
})();