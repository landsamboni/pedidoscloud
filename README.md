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
│       │   ├── api/health/       # Health check (liveness + readiness de BD)
│       │   ├── layout.tsx        # Layout raíz + fuente Inter (next/font)
│       │   └── globals.css       # Sistema de estilos (tokens .card/.input/.button-*)
│       ├── components/           # Componentes React (formularios, tablero, etc.)
│       ├── lib/                  # auth, authz, validation, subscription, prisma,
│       │                         #   storage, file-url, runtime-env, data, format, menu
│       ├── prisma/               # Schema, migraciones y seed
│       ├── middleware.ts         # Auth de sesión (JWT) para /admin y /restaurant
│       ├── next.config.ts        # Cabeceras de seguridad, límites de Server Actions
│       └── .env.example
├── infra/
│   └── terraform/
│       ├── envs/
│       │   ├── staging/          # Entorno de staging (rama staging-aws)
│       │   ├── feature-menu/     # Entorno de feature efímero (recursos separados)
│       │   └── prod/             # Entorno de producción (rama main)
│       └── modules/
│           ├── rds-postgres/     # RDS PostgreSQL + parámetros + alarmas CloudWatch
│           ├── monitoring/       # Dashboard, alarma Amplify 5xx, presupuesto de costos
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

**Dos modos de menú** — cada negocio elige cómo vende:
- **Combo** (almuerzos): categorías fijas (sopa, proteína, principio, bebida) con
  recargos opcionales por opción y un precio base por almuerzo.
- **Catálogo** (reposterías, panaderías, etc.): **categorías dinámicas** con nombre
  libre, **precio por producto**, **cantidades libres**, y **fichas de producto**
  con descripción y foto en un popup para el cliente.

**Cliente final (público)**
- **Pedido por enlace**: el negocio comparte `pedidoscloud.com/r/mi-restaurante` por WhatsApp.
- **Formulario de pedido**: arma su pedido según el modo del negocio (combo o catálogo),
  con validación compartida de nombre, celular colombiano y dirección.
- **Domicilio o recogida**: domicilio gratis, fijo o pagado aparte; o recoger en el local.
- **Comprobante de pago**: sube foto/PDF del pago (Nequi/Daviplata/cuenta bancaria) para revisión.
- **Seguimiento en tiempo real**: la página del pedido se actualiza mientras el negocio revisa el pago
  (pausada cuando la pestaña está en segundo plano para no recargar el servidor).
- **WhatsApp Click-to-Chat** y **guardar enlace** del pedido.

**Operador del restaurante (🔒 autenticado)**
- **Tablero de pedidos del día**: agrupado por estado, con resaltado de urgencia y refresco automático.
- **Revisión de pagos**: ver el comprobante en un modal, confirmar, rechazar o cancelar.
- **Consola**: configura el menú del día (combo o catálogo), precio base / precios por producto,
  métodos de pago (Nequi/Daviplata/banco) con QR, logo, y opciones de entrega.
- **Imagen de menú para WhatsApp**: genera un PNG del menú sobre una plantilla para compartir.
- **Clientes**: estadísticas por cliente (podio del top 3, total gastado, pedidos, ticket
  promedio, última compra), marcar **favoritos** y contacto directo por WhatsApp.
- **Analítica**: ventas, ingredientes (combo) o productos más vendidos (catálogo) por mes.
- **Historial**: pedidos por fecha. **Cambio de contraseña** del propio restaurante.

**Admin de plataforma (🔒 autenticado)**
- **Multi-tenant aislado**: alta, edición y baja de restaurantes — cada uno totalmente
  independiente (ver [Aislamiento multi-tenant](#aislamiento-multi-tenant)).
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
| `npm test` | Tests unitarios (vitest, una pasada) |
| `npm run test:watch` | Tests en modo watch |
| `npm run db:migrate` | Crea/aplica migraciones en dev |
| `npm run db:deploy` | Aplica migraciones en producción (no crea nuevas) |
| `npm run db:seed` | Carga restaurantes y menús de ejemplo |
| `npm run db:studio` | Prisma Studio (explorador visual de BD) |

### Tests

`npm test` corre los tests unitarios (vitest) de la lógica crítica: aislamiento
multi-tenant ([lib/authz.ts](apps/web/lib/authz.ts)), validación de inputs,
parsing de precios/recargos, suscripciones y rate limiting. Los archivos `*.test.ts`
se excluyen del build de Next (vitest los ejecuta vía esbuild).

### Variables de entorno

En local los valores por defecto de `.env.example` bastan. En la nube se inyectan
por Amplify (vía Terraform). Las principales:

| Variable | Requerida | Descripción |
|---|---|---|
| `DATABASE_URL` | sí | Cadena Postgres de Prisma. En la nube incluye `sslmode=require` + `connection_limit` (pooling serverless). |
| `AUTH_SECRET` | sí (prod) | Clave para firmar el JWT de sesión (`openssl rand -base64 32`). La app falla en prod sin ella. |
| `ADMIN_USER` / `ADMIN_PASSWORD` | sí | Credenciales del admin de plataforma. Si la clave está vacía, el login admin queda deshabilitado. |
| `ADMIN_TOTP_SECRET` | no | Secreto TOTP para MFA del admin. Vacío = MFA off. |
| `STORAGE_DRIVER` | no | `local` (dev) o `s3` (nube). |
| `S3_REGION` / `S3_BUCKET` / `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | con `s3` | Bucket privado de uploads (nombres `S3_` porque Amplify prohíbe el prefijo `AWS`). |
| `LOG_LEVEL` | no | `debug` \| `info` \| `warn` \| `error`. Default: `info` en prod, `debug` en dev. |

> Los secretos reales viven en `terraform.tfvars` (gitignored) y en las variables de
> entorno de Amplify — **nunca** en el repo. Ver [Seguridad](#seguridad).

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
| `/restaurant/{slug}/customers` | Operador — estadísticas de clientes | 🔒 Sesión |
| `/admin` | Propietario de plataforma | 🔒 Sesión (admin) |
| `/api/files/{key}` | Proxy S3 (solo con `STORAGE_DRIVER=s3`) | Interno |
| `/api/health` | Monitor de uptime / balanceador | Pública |

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

## Aislamiento multi-tenant

Cada restaurante es un **inquilino (tenant) totalmente independiente**: sus pedidos,
clientes, menús y configuración nunca se cruzan con los de otro. **Solo el admin de
plataforma** puede gestionar todos los restaurantes. La garantía se aplica en **dos
capas**, porque cubren superficies de ataque distintas:

1. **Lecturas — middleware** ([middleware.ts](apps/web/middleware.ts), Edge Runtime).
   Una sesión de restaurante solo puede abrir `/restaurant/<su-propio-slug>/*`;
   cualquier otro slug redirige al login. El admin puede ver cualquiera.

2. **Escrituras — capa de autorización** ([lib/authz.ts](apps/web/lib/authz.ts)).
   Las Server Actions son endpoints POST que **no** están atados a la ruta: reciben
   un `restaurantId` / `slug` / `customerId` / `itemId` en el formulario. Cada acción
   con alcance de restaurante empieza verificando la propiedad con
   `canManageRestaurantById` / `canManageRestaurantBySlug` / `canManageCustomer` /
   `canManageMenuItem`, que resuelven el restaurante dueño y comprueban que el
   solicitante sea **el admin o el operador de ese mismo restaurante**. Las acciones
   de plataforma (borrar restaurante, suscripciones, datos demo, contraseñas) exigen
   `requireAdmin()`. Sin esa comprobación, un operador podría pasar el id de otro
   negocio y modificar sus datos — eso queda bloqueado.

`lib/authz.ts` es código exclusivo de servidor (lee la cookie de sesión y consulta la
BD) y **nunca** se importa en el middleware (Edge) ni en componentes de cliente, para
no filtrar Prisma al bundle del Edge.

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

- **Aislamiento multi-tenant** garantizado en dos capas (ver
  [Aislamiento multi-tenant](#aislamiento-multi-tenant)): middleware para lecturas
  + `lib/authz.ts` para cada Server Action.
- **Autorización en Server Actions**: toda acción con alcance de restaurante verifica
  propiedad; las de plataforma exigen rol admin.
- **Login del admin** con comparación en **tiempo constante** (`timingSafeEqual`) para
  no filtrar la contraseña por temporización; queda deshabilitado si `ADMIN_PASSWORD`
  está vacío. MFA TOTP opcional (`ADMIN_TOTP_SECRET`).
- **Validación de entradas** centralizada en [lib/validation.ts](apps/web/lib/validation.ts)
  (cliente y servidor comparten reglas) y **límites de longitud** en textos del menú,
  descripciones y datos del cliente para acotar abuso/almacenamiento.
- **Subidas de archivos**: validación de tipo MIME **y magic bytes**, límite de 12 MB,
  y el proxy `/api/files` solo sirve prefijos conocidos y rechaza path traversal.
- **Cabeceras HTTP** en `next.config.ts`: `X-Frame-Options`, `X-Content-Type-Options`,
  `Referrer-Policy`, `Permissions-Policy`, y `noindex` en las páginas `/r/*`.
  (HSTS lo aplica Cloudflare; el CSP queda pendiente de auditar.)
- **S3 privado**: todo acceso público bloqueado, cifrado en reposo (AES-256),
  versionado y ciclo de vida que limpia uploads multipart incompletos y versiones antiguas.
- **IAM de mínimo privilegio**: el usuario de la app solo puede operar sobre el bucket de uploads.
- **RDS**: cifrado en reposo, **TLS forzado a nivel de motor** (`rds.force_ssl`, además
  del `sslmode=require` del cliente), `statement_timeout` e
  `idle_in_transaction_session_timeout` para que una consulta colgada no bloquee una
  conexión, autoescalado de almacenamiento y `deletion_protection` en staging/prod.
  El acceso al puerto 5432 se controla por security group. **Nota**: como el SSR de
  Amplify (WEB_COMPUTE) no se puede conectar a la VPC en esta cuenta, el Lambda llega
  a RDS por el **endpoint público** desde IPs de AWS no fijas; por eso
  `db_allowed_cidr_blocks` **debe** incluir `0.0.0.0/0` (la app deja de conectar si se
  quita). El riesgo se mitiga con contraseña fuerte + SSL obligatorio.
- **Rate limiting**: se recomienda activar **Cloudflare Rate Limiting** sobre `/login`
  (y los POST de Server Actions) como control de fuerza bruta a nivel de borde, ya que
  el SSR serverless no mantiene estado entre invocaciones.

## Escalabilidad

Diseñado para sostener **decenas de restaurantes (20–50+) concurrentes** sobre Amplify
SSR (Lambda) + RDS PostgreSQL:

- **Pooling de conexiones (Prisma)**: el `DATABASE_URL` incluye
  `connection_limit`, `pool_timeout` y `connect_timeout`. En serverless, cada instancia
  de Lambda abre su propio pool, así que el total de conexiones ≈
  `connection_limit × Lambdas calientes concurrentes`, acotado por el `max_connections`
  de la instancia (~112 en `db.t3.micro`, ~225 en `db.t3.small`). `connection_limit` se
  configura por entorno (`db_connection_limit`); `pool_timeout` hace que las ráfagas
  cortas **esperen** en vez de fallar.
  > RDS Proxy sería el pooler ideal para Lambda, pero es solo-VPC y el SSR de Amplify
  > no está en la VPC en esta cuenta; por eso se usa el pooling de Prisma + tuning de RDS.
- **Polling consciente de visibilidad**: el tablero de pedidos y la página de
  seguimiento **pausan el refresco cuando la pestaña está en segundo plano** y refrescan
  al volver. Como los operadores suelen tener la pestaña de fondo, esto mantiene la carga
  de BD plana al crecer el número de restaurantes, sin cambiar la experiencia en primer plano.
- **Índices**: además de las claves únicas por tenant, hay índices en
  `OrderItem(orderId)`, `Order(customerId)` y `Order(restaurantId, status)` para que los
  listados de pedidos, las estadísticas de clientes y la analítica no hagan *scans*
  (migración `20260610000000_add_performance_indexes`).
- **Tuning de RDS**: `log_min_duration_statement` registra consultas lentas y
  **Performance Insights** (gratis, 7 días) permite diagnosticar carga a medida que crece.
- **Cómo escalar más**: subir `db_instance_class` (p. ej. `db.t3.small`/`medium`) eleva
  `max_connections` y memoria; ajustar `db_connection_limit` en consecuencia. La alarma
  de `DatabaseConnections` avisa cuando el pool se acerca al límite.

## Monitoreo (CloudWatch)

Observabilidad por entorno, con notificaciones por correo vía SNS (`alert_email`):

- **Alarmas de RDS** (módulo `rds-postgres`): CPU, memoria libre, conexiones,
  **espacio libre en disco**, y **latencia de lectura/escritura**.
- **Alarma de Amplify** (módulo `monitoring`): respuestas `5xxErrors` del front-end SSR.
- **Dashboard de CloudWatch**: un tablero por entorno con CPU/conexiones, memoria/disco,
  latencias de RDS y tráfico/errores de Amplify, todo en una vista.
- **Presupuesto de costos** (AWS Budgets): alerta al 80% (real) y 100% (proyectado) del
  `monthly_budget_usd` configurado por entorno.
- **Retención de logs**: los grupos `postgresql` y `upgrade` de RDS tienen retención
  acotada (`log_retention_days`) para que el costo de logs no crezca sin límite.
- **Health check**: `GET /api/health` devuelve `200`/`503` según la conectividad a la BD
  — apto para monitores de uptime externos y health checks de balanceador.

> **Al aplicar en un RDS ya existente** (p. ej. staging) Terraform creará los grupos de
> logs y el grupo de parámetros nuevos; si los grupos de logs ya existen, impórtalos una
> vez (el comando está documentado en el módulo `rds-postgres/main.tf`). El grupo de
> parámetros con `rds.force_ssl` puede requerir un reinicio de la instancia.

## Despliegue en AWS

Ver [DEPLOYMENT.md](DEPLOYMENT.md): Terraform → Amplify → Cloudflare DNS.

- Infra como código con Terraform (`infra/terraform/envs/{staging,prod}`).
- El build de Amplify (`amplify.yml`) corre `prisma generate && next build`.
- Las **migraciones se ejecutan manualmente desde el laptop** antes de desplegar
  un cambio de esquema (CodeBuild no las corre):
  `cd apps/web && export DATABASE_URL=$(terraform output -raw database_url) && npm run db:deploy`.

## Límites conocidos del MVP

- Login de admin con un único usuario/clave por variables de entorno (no por persona).
  Se recomienda activar Cloudflare Rate Limiting sobre `/login` (ver [Seguridad](#seguridad)).
- Sin WhatsApp Cloud API ni pasarela de pagos (comprobantes Nequi/Daviplata manuales).
- El SSR de Amplify (WEB_COMPUTE) no soporta conectividad VPC en esta cuenta, así
  que RDS debe quedar accesible desde `0.0.0.0/0` (protegido por contraseña + SSL forzado).
  Por la misma razón no se usa RDS Proxy; el pooling se hace con Prisma
  (`connection_limit`) — ver [Escalabilidad](#escalabilidad). Los recursos de VPC/SG
  creados quedan listos por si en el futuro se habilita la conectividad VPC.
- Sin pipeline CI/CD para Terraform (se aplica manualmente desde el laptop).

## Changelog

### Auditoría integral (2026-06)

Mejora transversal organizada por fases. Ninguna rompe funcionalidad existente.

**Seguridad**
- 🔒 **Aislamiento multi-tenant garantizado**: nueva capa [lib/authz.ts](apps/web/lib/authz.ts);
  toda Server Action con alcance de restaurante verifica propiedad
  (`canManageRestaurant*`/`canManageCustomer`/`canManageMenuItem`) y las de
  plataforma exigen `requireAdmin()`. Se cerraron `setRestaurantPassword` y
  `createRestaurant`, que no tenían control.
- 🔑 **Secreto removido del repo**: `apps/web/.env.rds-backup` (contenía el
  `DATABASE_URL` con la contraseña de RDS) se dejó de trackear y se amplió el
  `.gitignore` a `.env.*`. *(Pendiente: rotar la contraseña maestra de RDS, que
  sigue en el historial.)*
- Login admin con comparación en **tiempo constante**; **rate limiting** de login
  (best-effort en memoria) en [lib/rate-limit.ts](apps/web/lib/rate-limit.ts).
- `rds.force_ssl` a nivel de motor, `statement_timeout`/`idle_in_transaction_timeout`,
  guard de path-traversal en `/api/files`, límites de longitud en inputs.

**Correcciones / refactor**
- Validación de inputs unificada en [lib/validation.ts](apps/web/lib/validation.ts)
  (antes triplicada).
- Bugs: recargos de demo omitían principio/bebida; aritmética `Decimal` en totales
  de catálogo; casts inseguros `as never` → `OrderStatus`.

**Rendimiento / escala (20–50+ restaurantes)**
- Índices: `OrderItem(orderId)`, `Order(customerId)`, `Order(restaurantId, status)`.
- Pooling de conexiones Prisma (`connection_limit`) en `DATABASE_URL`.
- Polling del tablero/seguimiento pausado en pestañas en segundo plano.

**Observabilidad**
- Logging estructurado JSON con niveles ([lib/logger.ts](apps/web/lib/logger.ts), `LOG_LEVEL`).
- CloudWatch: alarmas de disco y latencia de RDS, alarma 5xx de Amplify, dashboard,
  presupuesto de costos (AWS Budgets), retención de logs, SNS en prod.
- Health check `GET /api/health`.

**Calidad**
- Tests unitarios con vitest (31) sobre la lógica crítica; `npm test`.
- Dependencias: patches seguros (next 15.5.19, react 19.2.7, aws-sdk); majors diferidos.
