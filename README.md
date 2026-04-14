# Buddy Balance App

Proyecto separado para la app de Buddy Balance.

## Desarrollo

```bash
npm install
npm run ios
```

## Google Play Billing

- La app Android usa `expo-iap` y espera `EXPO_PUBLIC_ANDROID_PREMIUM_SUBSCRIPTION_ID` para la suscripción anual y puede usar `EXPO_PUBLIC_ANDROID_PREMIUM_MONTHLY_SUBSCRIPTION_ID` para la mensual.
- Para builds Android de `production`, `app.config.js` falla temprano si ninguna de esas variables está definida.
- Los valores deben coincidir exactamente con las suscripciones creadas en Google Play Console.
- No guardes ese valor real en `eas.json`; súbelo al entorno remoto de EAS para `production`.
- Comando esperado en tu máquina con EAS CLI autenticado:

```bash
eas env:create --environment production --name EXPO_PUBLIC_ANDROID_PREMIUM_SUBSCRIPTION_ID --value <tu_subscription_id_de_google_play> --type string
eas env:create --environment production --name EXPO_PUBLIC_ANDROID_PREMIUM_MONTHLY_SUBSCRIPTION_ID --value <tu_subscription_id_mensual_de_google_play> --type string
```

- Verificación rápida antes de compilar:

```bash
eas env:list --environment production
```

- Antes de publicar, confirma también que la función de Supabase `google-play-sync` esté desplegada y con las credenciales de Google Play configuradas.

## Android Release Checklist

1. Crear o confirmar la suscripción anual en Google Play Console y, si aplica, la mensual; copiar exactamente cada subscription ID.
2. Cargar `EXPO_PUBLIC_ANDROID_PREMIUM_SUBSCRIPTION_ID` y opcionalmente `EXPO_PUBLIC_ANDROID_PREMIUM_MONTHLY_SUBSCRIPTION_ID` en EAS para `production`.
3. Verificar que `APP_ANDROID_PACKAGE` y el package final de Expo coincidan con el package registrado en Google Play.
4. Confirmar que `google-play-sync` esté desplegada en Supabase.
5. Confirmar que los secretos de Google Play para `google-play-sync` estén presentes en Supabase.
6. Ejecutar `npm run test:release` y `npm run typecheck`.
7. Ejecutar `npx expo-doctor` en una máquina con EAS/Expo CLI disponible.
8. Lanzar la build Android de producción con EAS.
9. Instalar la build en un tester de Google Play y validar el flujo completo de compra.
10. Confirmar en la app que Premium se activa solo después de que `google-play-sync` valide el purchase token.
11. Probar también restauración o relectura de compra existente en una cuenta ya premium.
12. Verificar que el icono adaptativo, nombre de app, package y versión sean los esperados antes de enviar a revisión.
13. Publicar la URL pública de la política de privacidad en Google Play Console y confirmar que describa explícitamente el acceso, uso, almacenamiento y eliminación de fotos/imágenes.

## Notas

- Esta carpeta contiene la app móvil.
- El frontend web quedó en `/Users/jreynoso/I Got You`.
