# Despliegue

## 1. Subir el código a GitHub

```bash
git remote add origin https://github.com/jmm-21/ghost-radar.git
git push -u origin main
```

Después, sustituye `jmm-21` por tu usuario en los enlaces del README (las insignias de la CI).

## 2. Publicar en Vercel (gratis)

1. Entra en [vercel.com](https://vercel.com) con tu cuenta de GitHub.
2. Pulsa **Add New… → Project** e importa `ghost-radar`.
3. Vercel detecta Vite gracias a `vercel.json`. Pulsa **Deploy**.

En un minuto la web estará en `https://ghost-radar-<algo>.vercel.app`. Cada `git push` a `main` vuelve a publicarla automáticamente, y cada pull request genera su propia URL de vista previa.

> Sin Redis, la API funciona igualmente, pero en memoria: el contador y las opiniones se pierden cuando la función se reinicia.

## 3. Añadir Redis (gratis)

1. En el proyecto de Vercel: **Storage → Create Database → Upstash for Redis** (plan gratuito).
2. Conéctalo al proyecto. Vercel añade solas las variables `KV_REST_API_URL` y `KV_REST_API_TOKEN`.
3. Vuelve a desplegar (**Deployments → ⋯ → Redeploy**).

Comprueba que funciona: `https://tu-web/api/health` debe responder `"storage":"redis"`.

## 4. Variables de entorno

En **Settings → Environment Variables**:

| Variable | Para qué |
|---|---|
| `ADMIN_TOKEN` | Leer las opiniones. Usa una cadena larga y aleatoria. |
| `HASH_SALT` | Sal para anonimizar a los clientes. Usa otra cadena aleatoria. |

Para generarlas: `openssl rand -hex 32`

Para leer las opiniones:

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" https://tu-web/api/feedback
```

## 5. Dominio propio (cuando quieras)

1. Compra el dominio (por ejemplo `ghostradar.app`) en cualquier registrador.
2. En Vercel: **Settings → Domains → Add** y escribe el dominio.
3. Copia en tu registrador los registros DNS que te indique Vercel. El certificado HTTPS se genera solo.
