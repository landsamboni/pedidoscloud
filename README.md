# PedidosCloud

SaaS de gestión de pedidos para negocios pequeños que reciben pedidos por WhatsApp (restaurantes, lavanderías, desayunos sorpresa, floristerías, etc.). El negocio comparte un enlace como `https://pedidoscloud.com/r/la-esquina`; el cliente hace el pedido, sube el comprobante de pago (Nequi) y el negocio ve todo en un tablero web.

> Por ahora **no** hay integración con WhatsApp Cloud API ni pasarela de pagos: el negocio sigue usando su WhatsApp normal y comparte el enlace manualmente.

## Estructura del repositorio (monorepo)

```
pedidoscloud/
├── apps/
│   └── web/                 # Aplicación Next.js (App Router + Server Actions)
│       ├── app/             # Rutas (cliente, restaurante, admin, /api/files)
│       ├── components/
│       ├── lib/             # prisma, storage, file-url, format, data
│       ├── prisma/          # schema + migraciones + seed
│       ├── middleware.ts    # Basic Auth para /admin y /restaurant
│       └── .env.example
├── infra/
│   └── terraform/           # Infraestructura AWS (módulos + envs staging/prod)
├── docker-compose.yml       # PostgreSQL local
├── amplify.yml              # Build de AWS Amplify (monorepo, appRoot=apps/web)
├── DEPLOYMENT.md            # Guía de despliegue en AWS
└── README.md
```

## Stack

- Next.js 15 (App Router) + TypeScript + Server Actions
- PostgreSQL 16 + Prisma 6
- Tailwind CSS
- Almacenamiento de archivos conmutable: disco local (dev) o **S3 privado** (cloud)
- AWS: Amplify Hosting + RDS PostgreSQL + S3, infra con Terraform; Cloudflare como DNS/CDN/WAF

## Desarrollo local

Requisitos: Node.js 20+, npm, Docker.

Todos los comandos de la app se ejecutan dentro de `apps/web`.

```bash
cd apps/web

# 1. Dependencias
npm install

# 2. Variables de entorno
cp .env.example .env        # los valores por defecto ya apuntan al Postgres local

# 3. PostgreSQL local (desde la raíz del repo)
(cd .. && cd .. && docker compose up -d)   # o simplemente: docker compose up -d en la raíz

# 4. Migraciones + datos de ejemplo
npm run db:migrate
npm run db:seed

# 5. Servidor de desarrollo
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

> En local, `STORAGE_DRIVER=local` guarda los archivos en `apps/web/public/uploads`. No necesitas AWS para desarrollar.

### Scripts (`apps/web`)

| Script | Acción |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | `prisma generate && next build` |
| `npm run start` | Servidor de producción |
| `npm run db:migrate` | Crea/aplica migraciones en dev (`prisma migrate dev`) |
| `npm run db:deploy` | Aplica migraciones en cloud (`prisma migrate deploy`) |
| `npm run db:seed` | Carga restaurantes y menús de ejemplo |
| `npm run db:studio` | Prisma Studio |

## Rutas principales

- Cliente: `/r/{slug}` (ej. `/r/martica-la-bonita`)
- Seguimiento de pedido: `/r/{slug}/orders/{publicToken}`
- Tablero del restaurante: `/restaurant/{slug}/orders` 🔒
- Consola del restaurante: `/restaurant/{slug}` 🔒
- Admin de la plataforma: `/admin` 🔒
- Proxy de archivos (solo modo S3): `/api/files/{key}`

🔒 = protegido con HTTP Basic Auth (ver `middleware.ts`).

## Autenticación (MVP)

`apps/web/middleware.ts` protege `/admin` y `/restaurant/*` con HTTP Basic Auth usando variables de entorno:

- `/admin` → `ADMIN_USER` / `ADMIN_PASSWORD`
- `/restaurant/*` → `RESTAURANT_USER` / `RESTAURANT_PASSWORD`

Si la contraseña del área no está definida, esa área queda **abierta** (comodidad en local). **Siempre define contraseñas fuertes en staging/prod.** Es un puente hacia auth real (NextAuth / Cognito) más adelante.

## Almacenamiento de archivos

`apps/web/lib/storage.ts` abstrae los uploads:

- `STORAGE_DRIVER=local` → escribe en `public/uploads`, sirve estático (dev).
- `STORAGE_DRIVER=s3` → sube a un bucket S3 **privado**; las imágenes se sirven same-origin vía `/api/files/...` para que el bucket nunca sea público y `next/image` siga funcionando.

`lib/file-url.ts` convierte el valor guardado en la BD a una URL del navegador, así filas creadas con un driver siguen funcionando si cambias de driver.

## Despliegue en AWS

Ver [DEPLOYMENT.md](DEPLOYMENT.md): Terraform (staging) → Amplify → variables de entorno → migraciones contra RDS → DNS en Cloudflare.

## Límites conocidos del MVP

- Auth básica compartida (no hay cuentas por restaurante todavía).
- Sin WhatsApp Cloud API ni pasarela de pagos (comprobantes manuales de Nequi).
- Sin pipeline de CI/CD para Terraform (se despliega manualmente desde el laptop).
