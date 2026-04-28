# Emulación de empresas

## Objetivo
Implementar una **emulación completa de empresa** para soporte/admin, sin cambiar el usuario autenticado de Firebase.

La idea correcta no es "robar sesión", sino definir una **empresa efectiva** distinta al `auth.currentUser.uid` cuando un admin active la emulación.

## UX deseada
1. Desde `Admin > Empresas`, el admin elige una empresa.
2. Se abre confirmación:
   - `¿Desea emular a la empresa XXX?`
   - botones `Confirmar` / `Cancelar`
3. Al confirmar, toda la app pasa a operar sobre la empresa emulada.
4. Debe aparecer un banner rojo permanente arriba:
   - `Está en modo emulación`
   - nombre empresa
   - idealmente UID o correo
   - botón `Salir de la emulación`
5. Al salir, la app vuelve a usar la empresa real del admin.

## Alcance esperado
La emulación debe ser **completa**, no solo lectura:
- Clientes
- Historial de notificaciones
- Ajustes
- Configuración wallet
- Escaneo
- Contadores
- Cualquier acción de negocio que hoy use el UID de la empresa logueada

## Enfoque técnico recomendado
Crear una noción central de:
- `realCompanyUid = auth.currentUser.uid`
- `emulatedCompanyUid: string | null`
- `effectiveCompanyUid = emulatedCompanyUid ?? realCompanyUid`

La app no debe seguir leyendo `auth.currentUser.uid` directo en pantallas de negocio. Debe leer `effectiveCompanyUid` desde un contexto global.

## Arquitectura sugerida
### 1. Contexto global
Crear algo tipo:
- `src/context/AdminEmulationContext.tsx`

Estado mínimo:
- `emulatedCompanyUid: string | null`
- `emulatedCompanyName: string | null`
- `isEmulating: boolean`
- `startEmulation(company)`
- `stopEmulation()`
- `effectiveCompanyUid`

### 2. Provider en nivel alto
Montarlo cerca del árbol principal de navegación/app, para que todas las pantallas puedan leer el estado de emulación.

### 3. Banner global
Crear un componente reutilizable tipo:
- `src/components/admin/EmulationBanner.tsx`

Debe mostrarse siempre que `isEmulating === true`.

## Pantallas/servicios que hoy dependen del UID real
Estas piezas hoy están acopladas al `auth.currentUser.uid` o a la empresa autenticada y deben refactorizarse a `effectiveCompanyUid`.

### Dashboard / entrada
- `src/screens/Dashboard/DashboardScreen.tsx`
- `src/screens/CompanyGateScreen.tsx`
- `src/services/walletOnboarding/getWalletConfig.ts`

### Clientes / notificaciones
- `src/screens/Dashboard/content/DashboardContentClientes.tsx`
- `src/screens/notifications/NotificationHistoryScreen.tsx`

### Escaneo
- `src/screens/Dashboard/content/DashboardContentEscanear.tsx`

### Ajustes / wallet
- `src/screens/Dashboard/content/DashboardContentAjustes.tsx`
- `src/screens/WalletOnboarding/WalletOnboardingSetupScreen.tsx`

### Otros lugares a revisar
- `src/screens/Dashboard/content/DashboardContentPrincipal.tsx`
- cualquier llamada a Firestore con:
  - `collection(db, "Empresas", uid, ...)`
  - `doc(db, "Empresas", uid, ...)`

## Reglas Firestore
Hoy las reglas probablemente están orientadas a:
- la empresa solo lee/escribe su propio documento/subcolecciones
- `request.auth.uid == empresaId`

Para emulación completa, habrá que abrir reglas para admin.

### Estrategia sugerida
Usar el documento de empresa del admin para validar:
- `esAdmin == true`

Y luego permitir lectura/escritura cross-company a admins en rutas necesarias.

Ejemplo conceptual:
- empresa normal: solo su propia empresa
- admin: puede leer/escribir otras empresas

Importante:
- esto afecta seguridad real
- debe implementarse con mucho cuidado

## Auditoría recomendada
Si se habilita emulación completa con escritura, conviene registrar:
- admin que inició emulación
- empresa emulada
- fecha/hora inicio
- fecha/hora salida
- acciones sensibles hechas durante emulación

No es obligatorio en V1, pero sí recomendable después.

## Riesgos
1. Confusión de contexto
- si no hay banner fijo, el admin puede olvidar que está emulando

2. Escrituras accidentales
- un admin puede enviar notificaciones, modificar ajustes o escanear sobre una empresa equivocada

3. Reglas incompletas
- algunas pantallas pueden funcionar y otras fallar por permisos

4. Mezcla parcial
- parte de la app leyendo `auth.currentUser.uid` y otra parte usando `effectiveCompanyUid`
- eso produciría comportamientos inconsistentes

## Recomendación de implementación futura
### Fase 1
- crear contexto de emulación
- crear banner global
- migrar primero lectura de:
  - Clientes
  - Historial notificaciones
  - Ajustes
  - Wallet config

### Fase 2
- habilitar escritura
- migrar:
  - envío de notificaciones
  - edición ajustes
  - escaneo
  - wallet onboarding/config

### Fase 3
- endurecer reglas
- agregar auditoría de emulación

## Estado actual en código
Actualmente existe solo un placeholder visual en:
- `src/screens/admin/AdminCompaniesScreen.tsx`

Botón presente:
- `Emular empresa`

Comportamiento actual:
- abre popup con mensaje:
  - `Desarrollar en el futuro la función de emular.`

No existe aún:
- contexto global de emulación
- banner de emulación
- cambio de empresa efectiva
- reglas Firestore para admin cross-company

## Decisión funcional ya tomada
El producto quiere una **emulación completa**, no solo modo lectura.

Eso significa que la implementación final debe permitir operar la app como si se estuviera dentro de la empresa seleccionada, manteniendo siempre visible el estado de emulación.
