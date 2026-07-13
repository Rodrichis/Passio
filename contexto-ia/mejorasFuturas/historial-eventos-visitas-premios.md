# Historial de eventos de visitas y premios

Fecha de contexto: 10/07/2026

## Objetivo

Registrar eventos operativos de visitas y premios para construir analítica real y trazabilidad futura.

La idea es comenzar guardando eventos desde el flujo de escaneo, sin esperar a implementar perfiles de trabajadores. Más adelante, cuando existan roles, trabajadores y sucursales, se agregan campos al mismo modelo sin romper la estructura base.

## Colección propuesta

```text
Empresas/{empresaId}/HistorialEventos/{eventoId}
```

Se guarda a nivel de empresa porque las estadísticas serán globales para el negocio:

- Visitas por día.
- Premios canjeados por día.
- Horas más activas.
- Días de la semana con más actividad.
- Ranking de clientes por período.
- Auditoría de acciones realizadas.

## Campos base del evento

```ts
{
  tipo: "visita" | "premio",
  origen: "scanner",

  clienteId: string,
  clienteNombre: string,
  clienteSo: "ios" | "android" | string,

  fecha: serverTimestamp(),

  visitasTotalesAntes: number,
  visitasTotalesDespues: number,

  cicloAntes: number,
  cicloDespues: number,

  premiosDisponiblesAntes: number,
  premiosDisponiblesDespues: number,

  premiosCanjeadosAntes: number,
  premiosCanjeadosDespues: number,

  actorUid: string,
  actorTipo: "empresa"
}
```

## Razón para guardar antes y después

Guardar los valores antes y después permite auditoría, no solo estadística.

Ejemplos:

- Saber si una visita generó un premio.
- Saber cuántos premios tenía un cliente antes de un canje.
- Revisar cambios en caso de reclamos.
- Preparar trazabilidad para trabajadores sin rediseñar el historial.

## Mejoras futuras

Cuando se implementen trabajadores, roles y sucursales, se pueden agregar campos opcionales al mismo documento:

```ts
{
  actorNombre: "Raulito",
  actorRol: "cajero",
  sucursalId: "...",
  sucursalNombre: "Sucursal Centro"
}
```

Esto permitirá responder preguntas como:

- Quién dio una visita.
- Quién canjeó un premio.
- Qué trabajador realizó más acciones.
- Qué sucursal tuvo más actividad.
- Si hubo abuso o uso incorrecto del sistema.

## Decisión actual

Primero se implementará el registro de eventos desde escaneo para `visita` y `premio`.

La pantalla de estadísticas se construirá después, cuando ya existan datos reales en `HistorialEventos`.
