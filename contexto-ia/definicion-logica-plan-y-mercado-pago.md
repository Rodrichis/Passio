# Definicion logica plan y Mercado Pago

Fecha: 2026-07-21

Estado: propuesta acordada para revisar con backend antes de implementar completamente en produccion.

## Objetivo

Ordenar la logica de planes, suscripciones y pagos para que exista una sola fuente de verdad en Firestore.

La fuente de verdad sera:

```txt
Empresas/{empresaId}.suscripcion
```

La app y el backend deben dejar de depender de campos raiz para la logica nueva:

```txt
Empresas/{empresaId}.plan
Empresas/{empresaId}.estadoSuscripcion
Empresas/{empresaId}.expiraEl
Empresas/{empresaId}.tipoPagoPlan
```

Compatibilidad temporal en la app:

- Si `Empresas/{empresaId}.suscripcion` no existe o viene incompleta, la app puede completar datos desde los campos raiz legacy para no romper empresas antiguas.
- Esa compatibilidad es solo de lectura/normalizacion.
- Las escrituras nuevas deben ir al objeto `suscripcion`.
- Despues de migrar las empresas existentes, este fallback puede eliminarse.

## Estructura final en Empresa

```ts
suscripcion: {
  nombrePlan: "free" | "pro" | "premium",
  estadoSuscripcion: "active" | "pending" | "past_due" | "expired" | "trialing",
  renovacionAutomatica: boolean,
  expiraEl: Timestamp | null,
  trialTerminaEl: Timestamp | null,
  tipoPagoPlan: "none" | "trial" | "pro_monthly" | "pro_yearly" | null,
  suscripcionOrigen: "mercadopago" | "manual" | "none",
  mercadoPagoPreapprovalId: string | null,
  mercadoPagoPlanId: string | null,
  mercadoPagoPreferenceId: string | null,
  mercadoPagoPaymentId: string | null,
  ultimaSyncSuscripcion: Timestamp | null
}
```

## Empresa nueva

Al registrar una empresa desde la app:

```ts
suscripcion: {
  nombrePlan: "free",
  estadoSuscripcion: "active",
  renovacionAutomatica: false,
  expiraEl: null,
  trialTerminaEl: null,
  tipoPagoPlan: "none",
  suscripcionOrigen: "none",
  mercadoPagoPreapprovalId: null,
  mercadoPagoPlanId: null,
  mercadoPagoPreferenceId: null,
  mercadoPagoPaymentId: null,
  ultimaSyncSuscripcion: null
}
```

## Coleccion Planes

La coleccion `Planes` se mantiene con IDs automaticos como ahora.

No se agrega `planCodigo`.

La relacion sera por el campo `nombrePlan`, que debe quedar en minuscula:

```ts
Planes/{idAuto} {
  nombrePlan: "free",
  limiteCorreo: 10,
  limiteNotificacion: 10,
  limiteUsuarios: 40,
  precio: 0
}
```

```ts
Planes/{idAuto} {
  nombrePlan: "pro",
  limiteCorreo: 100,
  limiteNotificacion: 100,
  limiteUsuarios: 300,
  precio: 30000
}
```

## Relacion Empresa -> Plan

La relacion sera:

```txt
Empresas/{empresaId}.suscripcion.nombrePlan
```

contra:

```txt
Planes.nombrePlan
```

Ejemplo:

```ts
empresa.suscripcion.nombrePlan = "pro"
```

La app consulta:

```ts
query(
  collection(db, "Planes"),
  where("nombrePlan", "==", empresa.suscripcion.nombrePlan)
)
```

## Visual

En base de datos se usara minuscula:

```txt
free
pro
premium
```

La interfaz puede mostrarlo como:

```txt
Free
Pro
Premium
```

## Backend

El backend sera responsable de actualizar `Empresas/{empresaId}.suscripcion`.

La app nunca debe activar Pro por su cuenta.

### Mensual aprobado

```ts
suscripcion: {
  nombrePlan: "pro",
  estadoSuscripcion: "active",
  renovacionAutomatica: true,
  tipoPagoPlan: "pro_monthly",
  suscripcionOrigen: "mercadopago",
  expiraEl: fechaVigente,
  mercadoPagoPreapprovalId: "...",
  mercadoPagoPlanId: null,
  mercadoPagoPreferenceId: null,
  mercadoPagoPaymentId: null,
  ultimaSyncSuscripcion: serverTimestamp()
}
```

### Mensual con renovacion cancelada, pero aun vigente

Cancelar la renovacion mensual no debe quitar acceso Pro inmediatamente.

```ts
suscripcion: {
  nombrePlan: "pro",
  estadoSuscripcion: "active",
  renovacionAutomatica: false,
  tipoPagoPlan: "pro_monthly",
  suscripcionOrigen: "mercadopago",
  expiraEl: fechaFinPeriodo,
  mercadoPagoPreapprovalId: "...",
  mercadoPagoPlanId: null,
  mercadoPagoPreferenceId: null,
  mercadoPagoPaymentId: null,
  ultimaSyncSuscripcion: serverTimestamp()
}
```

### Anual aprobado

```ts
suscripcion: {
  nombrePlan: "pro",
  estadoSuscripcion: "active",
  renovacionAutomatica: false,
  tipoPagoPlan: "pro_yearly",
  suscripcionOrigen: "mercadopago",
  expiraEl: fechaActual + 12 meses,
  mercadoPagoPreapprovalId: null,
  mercadoPagoPlanId: null,
  mercadoPagoPreferenceId: "...",
  mercadoPagoPaymentId: "...",
  ultimaSyncSuscripcion: serverTimestamp()
}
```

### Pago pendiente

```ts
suscripcion: {
  nombrePlan: "pro",
  estadoSuscripcion: "pending",
  renovacionAutomatica: false,
  tipoPagoPlan: "pro_monthly" | "pro_yearly",
  suscripcionOrigen: "mercadopago",
  expiraEl: null,
  trialTerminaEl: null,
  mercadoPagoPreapprovalId: string | null,
  mercadoPagoPlanId: null,
  mercadoPagoPreferenceId: string | null,
  mercadoPagoPaymentId: null,
  ultimaSyncSuscripcion: serverTimestamp()
}
```

### Pago vencido o acceso vencido

```ts
suscripcion: {
  nombrePlan: "free",
  estadoSuscripcion: "expired",
  renovacionAutomatica: false,
  expiraEl: null,
  trialTerminaEl: null,
  tipoPagoPlan: "none",
  suscripcionOrigen: "none",
  mercadoPagoPreapprovalId: null,
  mercadoPagoPlanId: null,
  mercadoPagoPreferenceId: null,
  mercadoPagoPaymentId: null,
  ultimaSyncSuscripcion: serverTimestamp()
}
```

## Regla de acceso Pro

La app considera Pro activo solo si:

```ts
suscripcion.nombrePlan === "pro" &&
suscripcion.estadoSuscripcion === "active" &&
suscripcion.expiraEl > ahora
```

Free activo:

```ts
suscripcion.nombrePlan === "free" &&
suscripcion.estadoSuscripcion === "active"
```

## UI de pagos

- Si esta `free`, `expired`, sin Pro vigente o el backend permite crear checkout: mostrar botones de pago.
- Si esta `pro` con `active` vigente: no mostrar botones de pago.
- Si esta `pro_monthly` con `active` y `renovacionAutomatica: true`: mostrar opcion de cancelar renovacion.
- Si esta `pro_monthly` con `active` y `renovacionAutomatica: false`: informar que la renovacion mensual fue cancelada y mantiene acceso hasta `expiraEl`.
- Si esta `pro_yearly` con `active`: no mostrar cancelar renovacion.
- Para anual activo, informar que es pago unico por 12 meses y que debe pagarse nuevamente al vencer.
- La app solo redirige a Mercado Pago usando `checkoutUrl`.
- La app no habilita acceso al recibir `checkoutUrl`; espera Firestore actualizado por backend/webhook.

## Migracion

- Las empresas existentes se pueden actualizar manualmente agregando `suscripcion`.
- Los campos raiz legacy pueden eliminarse de la logica nueva despues de migrar.
- Tambien se debe bajar `Planes.nombrePlan` a minuscula en test/prod cuando corresponda.

## Decision final

`Empresas/{empresaId}.suscripcion` manda todo lo relacionado a pagos, plan y vigencia.

`suscripcion.nombrePlan` debe coincidir con `Planes.nombrePlan`.

La coleccion `Planes` no cambia de estructura, salvo usar `nombrePlan` en minuscula para la logica.

`estadoSuscripcion` no debe usar `canceled` como estado principal. Cancelar renovacion se representa con:

```ts
estadoSuscripcion: "active"
renovacionAutomatica: false
```
