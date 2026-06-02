# PedidosCloud

SaaS de gestión de pedidos para negocios pequeños que reciben pedidos por WhatsApp
(restaurantes, lavanderías, desayunos sorpresa, floristerías, etc.).
El negocio comparte un enlace como `https://pedidoscloud.com/r/la-esquina`;
el cliente hace el pedido, sube el comprobante Nequi, y el negocio ve todo en
un tablero web que se actualiza solo.

> Por ahora **no** hay integración con WhatsApp Cloud API ni pasarela de pagos:
> el negocio sigue usando su número normal de WhatsApp y comparte el enlace manualmente.

---

## Estructura del repositorio

```
pedidoscloud/
├── apps/
│   └── web/                      # Aplicación Next.js
│       ├── app/                  # Rutas App Router
│       │   ├── r/                # Cliente final (pedido, seguimiento)
│       │   ├── restaurant/       # Tablero y consola del restaurante 🔒
│       │   ├── admin/            # Panel de administración de plataforma 🔒
│       │   └── api/files/        # Proxy same-origin para archivos S3
│       ├── components/           # Componentes React
│       ├── lib/                  # prisma, storage, file-url, runtime-env, format, data
│       ├── prisma/               # Schema, migraciones y seed
│       ├── middleware.ts         # HTTP Basic Auth para /admin y /restaurant
│       ├── next.config.ts
│       └── .env.example
├── infra/
│   └── terraform/
│       ├── envs/
│       │   ├── staging/          # Entorno de staging (rama staging-aws)
│       │   └── prod/             # Entorno de producción (rama main)
│       └── modules/
│           ├── rds-postgres/
│           ├── s3-uploads/
│           ├── amplify-app/
│           ├── iam/
│           └── secrets/
├── docker-compose.yml            # PostgreSQL local para desarrollo
├── amplify.yml                   # Build de AWS Amplify
└── README.md
```

## Stack

| Capa | Tecnología |
|---|---|
| Framework | Next.js 15 (App Router, Server Actions) |
| Base de datos | PostgreSQL 16 + Prisma 6 |
| Estilos | Tailwind CSS 3 |
| Almacenamiento de archivos | Disco local (dev) / S3 privado + proxy (cloud) |
| Infraestructura | AWS Amplify Hosting + RDS + S3, Terraform |
| DNS / CDN / WAF | Cloudflare |

## Funcionalidades

- **Pedido por enlace**: el restaurante comparte `pedidoscloud.com/r/mi-restaurante` por WhatsApp
- **Formulario de pedido**: el cliente elige del menú del día configurado por el restaurante
- **Comprobante Nequi**: el cliente sube foto/PDF del pago; el restaurante lo revisa
- **Seguimiento en tiempo real**: la página de pedido se refresca automáticamente cada 20 s cuando el restaurante está revisando el pago
- **WhatsApp Click to Chat**: botón para consultar el estado directamente con el restaurante si no hay novedades
- **Guardar enlace de pedido**: el cliente puede copiar o enviarse el link de seguimiento a su propio WhatsApp
- **Tablero del restaurante**: lista de pedidos del día con actualización cada 10 s
- **Consola del restaurante**: configura menú, precio base, datos Nequi y QR
- **Admin de plataforma**: gestión multi-tenant de restaurantes
- **Auth de operadores**: HTTP Basic Auth por variables de entorno (MVP), protege `/admin` y `/restaurant`
- **Multi-tenant**: arquitectura lista para múltiples restaurantes/negocios en una instancia

---

## Desarrollo local

**Requisitos**: Node.js 20+, npm, Docker.

```bash
# 1. Entra a la carpeta de la app
cd apps/web

# 2. Instala dependencias
npm install

# 3. Copia variables de entorno
cp .env.example .env
# Los valores por defecto apuntan al Postgres local — no necesitas cambiar nada

# 4. Levanta PostgreSQL (desde la raíz del repo)
cd ../..
docker compose up -d

# 5. Aplica migraciones
cd apps/web
npm run db:migrate

# 6. Carga restaurantes y menú de ejemplo
npm run db:seed

# 7. Inicia el servidor de desarrollo
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

> En local, `STORAGE_DRIVER=local` guarda archivos en `apps/web/public/uploads/`.
> No necesitas AWS para desarrollar.

### Scripts (`apps/web`)

| Script | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | `prisma generate && next build` |
| `npm run start` | Servidor de producción |
| `npm run db:migrate` | Crea/aplica migraciones en dev |
| `npm run db:deploy` | Aplica migraciones en producción (no crea nuevas) |
| `npm run db:seed` | Carga restaurantes y menús de ejemplo |
| `npm run db:studio` | Prisma Studio (explorador visual de BD) |

## Rutas principales

| Ruta | Quién la usa | Auth |
|---|---|---|
| `/r/{slug}` | Cliente final — formulario de pedido | Pública |
| `/r/{slug}/orders/{token}` | Cliente final — seguimiento de pedido | Pública |
| `/restaurant/{slug}` | Operador — consola del restaurante | 🔒 Basic Auth |
| `/restaurant/{slug}/orders` | Operador — tablero de pedidos del día | 🔒 Basic Auth |
| `/admin` | Propietario de plataforma | 🔒 Basic Auth |
| `/api/files/{key}` | Proxy S3 (solo con `STORAGE_DRIVER=s3`) | Interno |

## Almacenamiento de archivos

`lib/storage.ts` abstrae los uploads:

- `STORAGE_DRIVER=local` → escribe en `public/uploads/`, sirve estático (dev)
- `STORAGE_DRIVER=s3` → sube a un bucket S3 **privado**; las imágenes se sirven
  same-origin vía `/api/files/...` (compatible con `next/image`, bucket nunca público)

`lib/file-url.ts` convierte el valor guardado en BD a una URL del browser, permitiendo
migrar entre drivers sin romper registros existentes.

## Auth de operadores (MVP)

`middleware.ts` protege `/admin` y `/restaurant/*` con HTTP Basic Auth.
Credenciales por variables de entorno (`ADMIN_USER/PASSWORD`, `RESTAURANT_USER/PASSWORD`).
Si la contraseña no está definida, el área queda abierta (conveniente para dev local).

Los prefetches de Next.js a rutas protegidas devuelven `401` sin `WWW-Authenticate`
para evitar que el browser muestre el diálogo de login en páginas públicas.

**Próximo paso de auth**: NextAuth o Amazon Cognito con cuentas por restaurante.

## Despliegue en AWS

Ver [DEPLOYMENT.md](DEPLOYMENT.md): Terraform → Amplify → Cloudflare DNS.
Un `terraform destroy + apply` desde cero funciona sin pasos manuales de migración:
el `amplify.yml` corre `prisma migrate deploy` automáticamente en el build.

## Límites conocidos del MVP

- Auth compartida (un usuario/clave por área, no por restaurante)
- Sin WhatsApp Cloud API ni pasarela de pagos (comprobantes Nequi manuales)
- RDS accesible desde `0.0.0.0/0` en staging (ver §seguridad en DEPLOYMENT.md)
- Sin pipeline CI/CD para Terraform (se aplica manualmente desde el laptop)
