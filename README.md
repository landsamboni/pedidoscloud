# PedidosCloud

SaaS de gestión de pedidos para negocios pequeños que reciben pedidos por WhatsApp
(restaurantes, lavanderías, desayunos sorpresa, floristerías, etc.).
El negocio comparte un enlace como `https://pedidoscloud.com/r/la-esquina`;
el cliente arma su pedido, sube el comprobante Nequi, y el negocio lo revisa en
un tablero web que se actualiza solo.

> Por ahora **no** hay integración con WhatsApp Cloud API ni pasarela de pagos:
> el negocio sigue usando su número normal de WhatsApp y comparte el enlace manualmente.
> Los comprobantes Nequi/Daviplata se revisan a mano desde el tablero.

---

## Estructura del repositorio

```
pedidoscloud/
├── apps/
│   └── web/                      # Aplicación Next.js
│       ├── app/                  # Rutas App Router
│       │   ├── login/            # Acceso de operadores (admin / restaurante)
│       │   ├── r/                # Cliente final (pedido, seguimiento)
│       │   ├── restaurant/       # Tablero, consola, analítica e historial 🔒
│       │   ├── admin/            # Panel de administración de plataforma 🔒
│       │   ├── api/files/        # Proxy same-origin para archivos S3 privados
│       │   ├── layout.tsx        # Layout raíz + fuente Inter (next/font)
│       │   └── globals.css       # Sistema de estilos (tokens .card/.input/.button-*)
│       ├── components/           # Componentes React (formularios, tablero, etc.)
│       ├── lib/                  # auth, subscription, prisma, storage, file-url,
│       │                         #   runtime-env, data, format, menu
│       ├── prisma/               # Schema, migraciones y seed
│       ├── middleware.ts         # Auth de sesión (JWT) para /admin y /restaurant
│       ├── next.config.ts        # Cabeceras de seguridad, límites de Server Actions
│       └── .env.example
├── infra/
│   └── terraform/
│       ├── envs/
│       │   ├── staging/          # Entorno de staging (rama staging-aws)
│       │   └── prod/             # Entorno de producción (rama main)
│       └── modules/
│           ├── rds-postgres/     # RDS PostgreSQL + alarmas CloudWatch
│           ├── s3-uploads/       # Bucket privado + ciclo de vida
│           ├── amplify-app/      # Amplify Hosting (WEB_COMPUTE / SSR)
│           ├── iam/              # Usuario IAM con acceso mínimo al bucket
│           └── secrets/          # (Opcional) AWS Secrets Manager
├── docker-compose.yml            # PostgreSQL local para desarrollo
├── amplify.yml                   # Build de AWS Amplify (monorepo)
├── DEPLOYMENT.md                 # Guía de despliegue paso a paso
└── README.md
```

## Stack

| Capa | Tecnología |
|---|---|
| Framework | Next.js 15 (App Router, Server Actions, React 19) |
| Base de datos | PostgreSQL 16 + Prisma 6 |
| Estilos | Tailwind CSS 3 + fuente Inter (`next/font`, auto-hospedada) |
| Auth de operadores | Sesión JWT firmada (`jose`) en cookie HttpOnly + `bcryptjs` |
| Almacenamiento de archivos | Disco local (dev) / S3 privado + proxy (cloud) |
| Infraestructura | AWS Amplify Hosting + RDS + S3, Terraform |
| DNS / CDN / WAF | Cloudflare |

## Funcionalidades

**Cliente final (público)**
- **Pedido por enlace**: el negocio comparte `pedidoscloud.com/r/mi-restaurante` por WhatsApp.
- **Formulario de pedido**: el cliente elige del menú del día (sopa, proteína, principio, bebida),
  con validación de nombre, celular colombiano y dirección, y soporte para varios almuerzos.
- **Comprobante Nequi**: el cliente sube foto/PDF del pago para que el negocio lo revise.
- **Seguimiento en tiempo real**: la página del pedido se refresca sola cada 20 s mientras el negocio revisa el pago.
- **WhatsApp Click-to-Chat**: botón para consultar el estado directamente con el restaurante.
- **Guardar enlace de pedido**: el cliente puede copiar o enviarse el link de seguimiento.

**Operador del restaurante (🔒 autenticado)**
- **Tablero de pedidos del día**: agrupado por estado, con resaltado de urgencia y refresco cada 10 s.
- **Revisión de pagos**: ver el comprobante en un modal, confirmar, rechazar o cancelar.
- **Consola**: configura menú del día, precio base, métodos de pago (Nequi/Daviplata/etc.) y QR.
- **Analítica**: ventas e ingredientes más pedidos por mes.
- **Historial**: pedidos por fecha.
- **Cambio de contraseña** del propio restaurante.

**Admin de plataforma (🔒 autenticado)**
- **Multi-tenant**: alta, edición y baja de restaurantes.
- **Suscripciones**: registrar pago (renueva 30 días), suspender, ver estado (activa/por vencer/suspendida).
- **Contraseñas**: asignar/restablecer la contraseña de cada restaurante.
- **Generador de datos demo** y limpieza de pedidos por restaurante o por fecha.

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
# Los valores por defecto apuntan al Postgres local — no necesitas cambiar nada.
# Para probar /admin define al menos ADMIN_PASSWORD.

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

Abre [http://localhost:3000](http://localhost:3000) → te redirige a `/login`.

> En local, `STORAGE_DRIVER=local` guarda archivos en `apps/web/public/uploads/`.
> No necesitas AWS para desarrollar.

### Scripts (`apps/web`)

| Script | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | `prisma generate && next build` |
| `npm run start` | Servidor de producción |
| `npm run lint` | ESLint (next lint) |
| `npm run db:migrate` | Crea/aplica migraciones en dev |
| `npm run db:deploy` | Aplica migraciones en producción (no crea nuevas) |
| `npm run db:seed` | Carga restaurantes y menús de ejemplo |
| `npm run db:studio` | Prisma Studio (explorador visual de BD) |

## Rutas principales

| Ruta | Quién la usa | Auth |
|---|---|---|
| `/login` | Operadores (admin y restaurante) | Pública |
| `/r/{slug}` | Cliente final — formulario de pedido | Pública |
| `/r/{slug}/orders/{token}` | Cliente final — seguimiento de pedido | Pública (token) |
| `/restaurant/{slug}` | Operador — consola del restaurante | 🔒 Sesión |
| `/restaurant/{slug}/orders` | Operador — tablero de pedidos del día | 🔒 Sesión |
| `/restaurant/{slug}/analytics` | Operador — analítica | 🔒 Sesión |
| `/restaurant/{slug}/history[/date]` | Operador — historial | 🔒 Sesión |
| `/admin` | Propietario de plataforma | 🔒 Sesión (admin) |
| `/api/files/{key}` | Proxy S3 (solo con `STORAGE_DRIVER=s3`) | Interno |

## Auth de operadores

La autenticación usa una **sesión JWT firmada** (`jose`) guardada en una cookie
HttpOnly (`pcloud_session`, TTL 12 h). Ver [lib/auth.ts](apps/web/lib/auth.ts) y
[middleware.ts](apps/web/middleware.ts).

- **Admin**: inicia sesión con `ADMIN_USER` / `ADMIN_PASSWORD` (variables de entorno).
  Si `ADMIN_PASSWORD` está vacío, el login de admin queda deshabilitado.
- **Restaurante**: inicia sesión con su **slug como usuario** y una **contraseña
  bcrypt almacenada en la base de datos** (la asigna el admin desde `/admin`).
- `middleware.ts` (Edge Runtime) verifica el JWT en `/admin` y `/restaurant/*`,
  comprueba el rol y, para restaurantes, el estado de la **suscripción**
  (redirige a `/restaurant/{slug}/suspended` si venció — sin periodo de gracia).
- Los prefetches de Next.js a rutas protegidas devuelven `401` para no disparar
  diálogos del browser en páginas públicas.
- `AUTH_SECRET` debe ser una cadena aleatoria de 32+ caracteres
  (`openssl rand -base64 32`); en producción la app falla si no está definida.

**Próximo paso de auth**: NextAuth o Amazon Cognito con cuentas por restaurante.

## Ciclo de vida del pedido

`OrderStatus`: `NEW → PAYMENT_PENDING → PAYMENT_REVIEW → PAYMENT_CONFIRMED`,
con ramas `PAYMENT_REJECTED` y `CANCELLED`. El comprobante sube el estado a
`PAYMENT_REVIEW`; el operador confirma (exige comprobante o doble confirmación
explícita), rechaza o cancela. Los números de pedido son por restaurante y día
(`DailyOrderCounter`).

## Suscripciones

El estado se deriva de `subscriptionEndsAt` (ver [lib/subscription.ts](apps/web/lib/subscription.ts)):
`activa` (> 7 días), `por vencer` (1–7 días), `suspendida` (vencida, bloqueo inmediato)
o `sin suscripción`. Registrar un pago fija `endsAt = fecha de pago + 30 días`.

## Almacenamiento de archivos

[lib/storage.ts](apps/web/lib/storage.ts) abstrae los uploads (QR Nequi y comprobantes):

- `STORAGE_DRIVER=local` → escribe en `public/uploads/`, sirve estático (dev).
- `STORAGE_DRIVER=s3` → sube a un bucket S3 **privado**; las imágenes se sirven
  same-origin vía `/api/files/...` (compatible con `next/image`, bucket nunca público).

[lib/file-url.ts](apps/web/lib/file-url.ts) convierte el valor guardado en BD a una
URL del browser, permitiendo migrar entre drivers sin romper registros existentes.

## Seguridad

- **Cabeceras HTTP** en `next.config.ts`: `X-Frame-Options`, `X-Content-Type-Options`,
  `Referrer-Policy`, `Permissions-Policy`, y `noindex` en las páginas `/r/*`.
  (HSTS lo aplica Cloudflare; el CSP queda pendiente de auditar.)
- **S3 privado**: todo acceso público bloqueado, cifrado en reposo (AES-256),
  versionado y ciclo de vida que limpia uploads multipart incompletos y versiones antiguas.
- **IAM de mínimo privilegio**: el usuario de la app solo puede operar sobre el bucket de uploads.
- **RDS**: cifrado en reposo, SSL forzado (`sslmode=require`), ingreso restringido por
  security group (IP del laptop para migraciones + SG del Lambda de Amplify), autoescalado
  de almacenamiento y alarmas de CPU/memoria/conexiones en CloudWatch.

## Despliegue en AWS

Ver [DEPLOYMENT.md](DEPLOYMENT.md): Terraform → Amplify → Cloudflare DNS.

- Infra como código con Terraform (`infra/terraform/envs/{staging,prod}`).
- El build de Amplify (`amplify.yml`) corre `prisma generate && next build`.
- Las **migraciones se ejecutan manualmente desde el laptop** antes de desplegar
  un cambio de esquema, porque CodeBuild no alcanza RDS dentro de la VPC:
  `cd apps/web && export DATABASE_URL=$(terraform output -raw database_url) && npm run db:deploy`.

## Límites conocidos del MVP

- Login de admin con un único usuario/clave por variables de entorno (no por persona).
- Sin WhatsApp Cloud API ni pasarela de pagos (comprobantes Nequi manuales).
- Conectividad VPC del Lambda de Amplify se configura una vez a mano en la consola
  (el provider de Terraform aún no soporta `vpc_config` para Amplify).
- Sin pipeline CI/CD para Terraform (se aplica manualmente desde el laptop).
