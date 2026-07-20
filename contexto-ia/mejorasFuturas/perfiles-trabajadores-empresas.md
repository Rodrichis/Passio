# Perfiles y trabajadores por empresa

Fecha de registro del contexto: 2026-07-19

Estado: pendiente, no desarrollado.

## Objetivo

Agregar soporte para trabajadores asociados a empresas sin romper el flujo actual de registro e inicio de sesión de empresas.

La empresa registrada actual seguirá siendo el administrador principal. Los trabajadores serán usuarios separados, asociados a una o varias empresas con permisos limitados.

## Modelo base acordado

```txt
Empresa/admin principal:
Empresas/{empresaId}

Trabajador:
Usuarios/{usuarioUid}

Relación trabajador-empresa:
Empresas/{empresaId}/Trabajadores/{usuarioUid}
```

`usuarioUid` debe ser el mismo `uid` de Firebase Auth del trabajador.

No existirá `trabajadorUid` separado. El trabajador es el usuario.

## Empresa/admin principal

La empresa actual se representa en:

```txt
Empresas/{empresaId}
```

La cuenta empresa/admin principal mantiene permisos totales sobre su empresa.

No se debe duplicar la empresa/admin principal en `Usuarios`, porque actualmente ya vive en `Empresas/{empresaId}` y ese modelo debe mantenerse para no romper lo existente.

## Usuarios trabajadores

Colección propuesta:

```txt
Usuarios/{usuarioUid}
```

Campos propuestos:

```txt
email
nombre
apellido
telefono
activoGlobal
empresas: [empresaId]
creadoEn
actualizadoEn
```

El array `empresas` permite saber rápidamente en qué empresas participa un trabajador.

Ejemplo:

```txt
Usuarios/raul456
  email: "raul@correo.com"
  nombre: "Raul"
  apellido: "Perez"
  empresas: ["loligo123", "otraEmpresa456"]
```

## Relación trabajador-empresa

Subcolección propuesta:

```txt
Empresas/{empresaId}/Trabajadores/{usuarioUid}
```

Campos propuestos:

```txt
uid
email
nombre
apellido
rol: "operador" | "lector"
activo: true | false
creadoEn
actualizadoEn
creadoPor
```

Ejemplo:

```txt
Empresas/loligo123/Trabajadores/raul456
  uid: "raul456"
  email: "raul@correo.com"
  nombre: "Raul"
  apellido: "Perez"
  rol: "operador"
  activo: true
```

## Roles acordados

### Empresa/admin principal

No es un trabajador. Es la cuenta empresa registrada actual.

Permisos:

- Acceso completo a la empresa.
- Ajustes sensibles.
- Gestión de trabajadores.
- Pagos y suscripción.
- Clientes.
- Escaneo.
- Estadísticas.
- Notificaciones.
- Información del wallet.

### Operador

Trabajador operativo.

Permisos esperados:

- Escanear visitas.
- Canjear premios.
- Buscar y ver clientes.
- Ejecutar funciones operativas del día a día.

Restricciones esperadas:

- No puede administrar pagos.
- No puede editar ajustes sensibles de empresa.
- No puede gestionar trabajadores.

### Lector

Trabajador de solo consulta.

Permisos esperados:

- Ver información.
- Consultar clientes, estadísticas e historiales según se defina.

Restricciones esperadas:

- No puede modificar datos.
- No puede escanear.
- No puede enviar notificaciones.
- No puede cambiar configuración.

## Flujo de login acordado

1. Usuario inicia sesión con Firebase Auth.
2. Si `auth.uid` existe como `Empresas/{auth.uid}`, entra como empresa/admin principal.
3. Si no existe como empresa, se busca `Usuarios/{auth.uid}`.
4. Si `Usuarios/{uid}.empresas` tiene una sola empresa activa, entra directo a esa empresa.
5. Si tiene varias empresas activas, se muestra selector de empresa.
6. Al elegir empresa, se lee `Empresas/{empresaId}/Trabajadores/{uid}` para obtener `rol` y `activo`.
7. Si el trabajador está desactivado en esa empresa, no puede entrar.

## Backend requerido

Crear trabajadores debe hacerse desde backend con Firebase Admin SDK, no directo desde frontend.

Motivo:

- Evita cerrar la sesión actual del admin al crear otro usuario con Firebase Auth.
- Centraliza acciones sensibles.
- Permite validar permisos antes de crear o modificar trabajadores.

Backend sugerido:

- Usar el backend Express existente de configuración/wallet.
- Más adelante también puede alojar Mercado Pago, Resend y otros procesos administrativos.

Endpoints mínimos:

```txt
crearTrabajador
listarTrabajadores
actualizarRolTrabajador
desactivarTrabajador
reactivarTrabajador
```

## Pantalla futura en la app

Agregar una pantalla o sección de trabajadores, probablemente dentro de Ajustes.

Funciones esperadas:

- Registrar trabajador.
- Listar trabajadores.
- Cambiar rol.
- Desactivar trabajador.
- Reactivar trabajador.

Campos de registro:

- Nombre.
- Apellido.
- Correo.
- Teléfono.
- Rol.
- Contraseña temporal.

El trabajador podrá cambiar su contraseña posteriormente.

## Trazabilidad futura

Cuando existan trabajadores, los eventos operativos deberán registrar quién hizo cada acción.

Campos futuros para `HistorialEventos`:

```txt
actorUid
actorNombre
actorRol
```

También se puede agregar más adelante:

```txt
sucursalId
sucursalNombre
```

Esto permitirá saber qué operador dio una visita o canjeó un premio.

## Decisiones importantes

- No existirá trabajador con rol `admin`.
- Admin es solo la empresa principal.
- `usuarioUid` y `trabajadorUid` no son conceptos separados.
- `Usuarios/{uid}.empresas` será un array simple para mantener el modelo fácil de entender.
- La relación real y el rol viven en `Empresas/{empresaId}/Trabajadores/{usuarioUid}`.
- Si un trabajador se va, no se borra: se marca `activo: false`.
- Esta implementación queda pendiente mientras se avanza primero con pagos de Mercado Pago.
