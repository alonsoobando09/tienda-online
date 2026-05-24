# Despliegue en Vercel

## Variables obligatorias

Configura estas variables en Vercel, dentro de Project Settings > Environment Variables:

```env
NEXT_PUBLIC_APP_URL=https://tu-dominio.vercel.app
MERCADOPAGO_ACCESS_TOKEN=APP_USR_o_TEST_token_de_mercado_pago
FB_PROJECT_ID=central-mayorista-ccf65
FB_CLIENT_EMAIL=firebase-adminsdk-xxxx@central-mayorista-ccf65.iam.gserviceaccount.com
FB_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nTU_LLAVE_PRIVADA\n-----END PRIVATE KEY-----\n"
```

## Seguridad

- No subas `.env.local`.
- No subas `serviceAccountKey.json`.
- En Vercel usa las variables `FB_*` en vez del archivo JSON.
- Para Mercado Pago en produccion usa una URL HTTPS en `NEXT_PUBLIC_APP_URL`.

## Flujo recomendado

1. Ejecuta `npm run lint`.
2. Ejecuta `npm run build`.
3. Sube cambios a GitHub.
4. Vercel desplegara automaticamente si el proyecto esta conectado al repositorio.

## Comandos utiles

```bash
npm.cmd run lint
npm.cmd run build
npm.cmd run dev
```
