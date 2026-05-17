# Admin Firestore y permisos

Fecha: 17/05/2026

## Estado actual
Ya existe UI en:
- `src/screens/admin/AdminCompaniesScreen.tsx`

La pantalla admin ya permite:
- editar `plan`
- editar `estadoSuscripcion`
- editar `expiraEl`
- ver clientes por empresa
- ver historial de notificaciones por empresa

Pero hoy eso no funciona sobre empresas ajenas por reglas de Firestore.

## Problema real
Las reglas actuales permiten:
- lectura publica del documento de empresa
- escritura solo al dueño: `request.auth.uid == empresaId`
- lectura de `Clientes` solo al dueño
- lectura de `HistorialNotificaciones` solo al dueño

Por eso el admin puede ver la lista general de empresas, pero no puede:
- guardar cambios de suscripcion en otra empresa
- leer clientes de otra empresa
- leer historial de notificaciones de otra empresa

## Decision tomada
NO resolver esto ahora directamente sobre la base de datos de produccion.

Antes de tocar reglas reales:
1. crear un proyecto de pruebas en Firebase
2. probar ahi el flujo admin completo
3. validar permisos, claims y refresco de token
4. recien despues llevarlo a produccion

## Enfoque correcto
No usar el campo `esAdmin` del documento de empresa como fuente de verdad para reglas.

Motivo:
- hoy cada empresa puede escribir su propio documento
- si las reglas confiaran en `esAdmin` dentro de Firestore, una empresa podria intentar marcarse como admin

La forma correcta es usar **custom claims** de Firebase Auth:
- `request.auth.token.admin == true`

Referencia oficial:
- Firebase Rules + auth claims
- Firebase custom claims con Admin SDK

## Regla recomendada
La idea futura es usar helpers tipo:

```firestore
function signedIn() {
  return request.auth != null;
}

function isAdmin() {
  return signedIn() && request.auth.token.admin == true;
}

function isOwner(empresaId) {
  return signedIn() && request.auth.uid == empresaId;
}

function isOwnerOrAdmin(empresaId) {
  return isOwner(empresaId) || isAdmin();
}
```

Y despues abrir solo las rutas necesarias:
- `Empresas/{empresaId}` write: `isOwnerOrAdmin(empresaId)`
- `Clientes` read: `isOwnerOrAdmin(empresaId)`
- `HistorialNotificaciones` read: `isOwnerOrAdmin(empresaId)`

Mantener mas restrictivo:
- update/delete de clientes por ahora solo dueño, salvo que despues se quiera admin con escritura completa

## Claim admin
El claim debe asignarse desde backend/Admin SDK, por ejemplo:

```ts
getAuth().setCustomUserClaims(uid, { admin: true });
```

Despues de eso, la cuenta admin debe:
- cerrar sesion y volver a entrar
- o refrescar el token

## Relacion con emulacion
Esto tambien se cruza con:
- `contexto-ia/mejorasFuturas/emulacion-empresas.md`

Si en el futuro se implementa emulacion completa, estas reglas tambien seran base para permitir acceso cross-company de admin.

## Cuando retomarlo
Retomar este tema solo cuando:
- exista proyecto Firebase de pruebas
- se quiera habilitar admin real sobre otras empresas
- se prueben cambios primero fuera de produccion

## Recordatorio importante
No parchear esto rapido en produccion con reglas abiertas tipo:
- `allow read, write: if true`
- o confiando en un campo editable por cliente

Eso resolveria el panel admin de forma insegura.
