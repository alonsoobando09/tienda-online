# Despliegue en Vercel

## Variables obligatorias

Configura estas variables en Vercel, dentro de Project Settings > Environment Variables:

```env
NEXT_PUBLIC_APP_URL=https://tu-dominio.vercel.app
NEXT_PUBLIC_DEFAULT_EMPRESA_ID=proveedor-central
MERCADOPAGO_ACCESS_TOKEN=APP_USR_o_TEST_token_de_mercado_pago
FB_PROJECT_ID=central-mayorista-ccf65
FB_CLIENT_EMAIL=firebase-adminsdk-xxxx@central-mayorista-ccf65.iam.gserviceaccount.com
FB_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nTU_LLAVE_PRIVADA\n-----END PRIVATE KEY-----\n"
```

## Ambiente de pruebas

Usa Vercel Preview o un segundo proyecto Vercel con otro Firebase:

```env
NEXT_PUBLIC_APP_ENV=test
NEXT_PUBLIC_APP_URL=https://tu-preview.vercel.app
NEXT_PUBLIC_DEFAULT_EMPRESA_ID=proveedor-central-test
MERCADOPAGO_ACCESS_TOKEN=TEST-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
FB_PROJECT_ID=central-mayorista-test
FB_CLIENT_EMAIL=firebase-adminsdk-xxxx@central-mayorista-test.iam.gserviceaccount.com
FB_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nTU_LLAVE_PRIVADA_TEST\n-----END PRIVATE KEY-----\n"
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
5. Si cambiaste reglas, ejecuta `firebase deploy --only firestore:rules`.
6. Antes de cambios fuertes de datos, ejecuta `npm run backup`.

## Comandos utiles

```bash
npm.cmd run lint
npm.cmd run build
npm.cmd run dev
npm.cmd run backup
npm.cmd run restore -- --backup=backups/FECHA --empresa=proveedor-central
firebase deploy --only firestore:rules
```

## Backups

- Los backups locales quedan en `backups/`.
- `backups/` esta ignorado por Git.
- Para automatizar en Windows:

```powershell
npm run backup:install-task -- -Time 23:30 -Empresa proveedor-central
```
