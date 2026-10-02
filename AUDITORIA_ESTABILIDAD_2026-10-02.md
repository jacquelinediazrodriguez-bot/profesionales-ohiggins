# Auditoría de estabilidad — 02-10-2026

## Objetivo
Reducir regresiones funcionales al incorporar nuevas correcciones en la Plataforma Digital Frente PT O’Higgins.

## Hallazgos confirmados

1. **Sobrescritura de funciones por archivos cargados en secuencia.**
   La plataforma carga `sync.js` desde la aplicación base y luego varios archivos de corrección desde `loader-20261001.js`. Varios de esos archivos redefinen funciones globales (`window.*`). La última definición cargada reemplaza a la anterior.

2. **Flujo de invitaciones afectado por una corrección posterior.**
   El flujo completo ya solicitaba nombre + correo y enviaba `full_name` a `member-invitation`. Una corrección posterior de validación de correo redefinió `adminInvitacionDirecta` y dejó solo el correo. Se corrigió nuevamente para conservar el ciclo completo: nombre → correo → envío → registro de invitación → activación de cuenta → asignación de Mesa y rol.

3. **Error de sintaxis en el Asistente de la Plataforma.**
   `assistant-20261001.js` tenía una estructura incompleta en el bloque `DOMContentLoaded`, lo que podía impedir la ejecución del asistente. Corregido.

4. **Riesgo de duplicación del botón “Mi Trabajo”.**
   `roles-20261001.js` y `admin-work-button-20261001.js` podían insertar controles equivalentes. Se agregó una validación para impedir la duplicación.

5. **Funciones globales redefinidas en más de un archivo.**
   Se detectan, entre otras, redefiniciones de `adminUsuarios`, `renderAdminShell`, `goAccess` y `adminInvitacionDirecta`. Algunas son intencionales, pero constituyen un riesgo estructural porque el resultado final depende del orden de carga.

## Punto estable
Se creó la rama `stable-2026-10-02` como punto de recuperación de la versión auditada.

## Módulos críticos protegidos
Antes de publicar cualquier cambio futuro debe comprobarse que sigan funcionando:

- Acceso e identificación.
- Recuperación de contraseña.
- Invitación directa de profesionales.
- Recepción del correo de invitación.
- Creación de contraseña y activación de cuenta.
- Estado del correo / estado del registro.
- Asignación de Mesa Técnica y rol.
- Roles globales Administrador General / Administrador de Plataforma.
- Cambio entre Mesas desde el menú lateral.
- Mi Trabajo: edición, guardado y sincronización.
- Versiones y restauración.
- Comentarios y observaciones.
- Resolución de observaciones.
- Solicitud de publicación.
- Devolución con observaciones.
- Publicación final.
- Biblioteca y visualización del documento final.
- Contacto y envío de mensajes.
- Galería.

## Checklist obligatorio de regresión

### A. Acceso
- [ ] Abrir “Acceso” desde inicio.
- [ ] Ingresar con usuario válido.
- [ ] Recuperar contraseña.
- [ ] Verificar permisos según rol global y rol por Mesa.

### B. Invitaciones
- [ ] Ingresar nombre completo.
- [ ] Ingresar correo válido.
- [ ] Confirmar envío.
- [ ] Confirmar aparición en registro de invitaciones.
- [ ] Confirmar estado de correo.
- [ ] Confirmar activación del enlace recibido.
- [ ] Crear contraseña.
- [ ] Confirmar “Registro completado”.
- [ ] Asignar Mesa y rol.

### C. Mesas y roles
- [ ] Usuario con una Mesa.
- [ ] Usuario con varias Mesas.
- [ ] Cambio entre Mesas sin mezclar contenido.
- [ ] Administrador General con roles de Mesa.
- [ ] Administrador de Plataforma con roles de Mesa.
- [ ] Límite de 3 Mesas para cuentas administrativas.

### D. Documento de trabajo
- [ ] Editar una sección.
- [ ] Guardar cambios.
- [ ] Verificar sincronización en nube.
- [ ] Guardar versión.
- [ ] Restaurar versión.
- [ ] Insertar referencia.
- [ ] Agregar comentario.
- [ ] Resolver comentario/observación.

### E. Publicación
- [ ] Solicitar publicación.
- [ ] Revisar desde Administración.
- [ ] Devolver con observaciones.
- [ ] Corregir y reenviar.
- [ ] Publicar.
- [ ] Ver documento final en Biblioteca.

## Regla de mantenimiento desde esta auditoría

1. No modificar una función crítica completa para corregir un detalle menor si puede hacerse de forma localizada.
2. Toda corrección nueva debe revisar qué archivos ya redefinen esa misma función.
3. No agregar un nuevo parche que elimine parámetros o pasos del flujo existente.
4. Mantener una rama estable antes de cambios de riesgo.
5. Ejecutar el checklist de regresión de los módulos afectados antes de considerar una corrección cerrada.
6. Avanzar progresivamente hacia una consolidación: menos archivos-parche y una sola definición por función crítica.
