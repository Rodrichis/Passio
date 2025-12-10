# Passio - Instrucciones rápidas

## Requisitos
- Node.js y npm instalados
- Expo CLI (se usa con `npx` directamente)

## Pasos para levantar el proyecto
1. Clona el repositorio.
2. Copia el archivo `.env` en la raíz del proyecto (junto a `package.json`).
3. Instala dependencias:
   ```bash
   npm install
   ```
4. Inicia el proyecto con cache limpio:
   ```bash
   npx expo start -c
   luego preciona w para abrir la web
   ```
5. Elige la plataforma desde la interfaz de Expo (Android/iOS/Web) o escanea el QR con Expo Go.

## Notas
- Asegúrate de tener configuradas las variables de entorno del `.env` (Firebase, Wallet, etc.).
- Para builds Android/iOS, revisa las configuraciones en `app.json`.
