# Despliegue en AWS — PedidosCloud

Arquitectura del MVP:

```
Cloudflare (DNS + CDN + WAF + SSL)
        │  CNAME
        ▼
AWS Amplify Hosting  ──►  build desde GitHub (rama por entorno)
   (Next.js SSR)
        │
        ├──►  Amazon RDS PostgreSQL   (datos)
        └──►  Amazon S3 (privado)     (comprobantes + QR, vía /api/files)
```

- **Infraestructura**: Terraform, aplicado **manualmente desde tu laptop** (sin pipeline por ahora).
- **App**: AWS Amplify conectado a GitHub; cada push a la rama del entorno dispara un build.
- **Secretos**: variables de entorno en Amplify (las setea Terraform). Secrets Manager es opcional.

> El repo está preparado para añadir un pipeline de Terraform más adelante (estado remoto en `backend.tf`), pero no se implementa ahora.

---

## 0. Requisitos previos

- Cuenta de AWS y **AWS CLI** configurado: `aws configure` (o `aws sso login`).
- **Terraform** ≥ 1.5 (`terraform version`).
- **GitHub Personal Access Token (PAT)** con acceso al repo `landsamboni/pedidoscloud`
  (classic: scope `repo`; o fine-grained con permiso de *Contents/Webhooks*). Amplify lo
  usa para conectarse y crear el webhook.
- El repo en GitHub con las ramas `staging` y `main`.
- Cliente de Postgres para migraciones: basta con Node + Prisma (ya en `apps/web`).

---

## 1. Desplegar infraestructura de staging con Terraform

```bash
cd infra/terraform/envs/staging

# 1. Prepara las variables
cp terraform.tfvars.example terraform.tfvars
#   Edita terraform.tfvars y completa:
#   - github_access_token   (tu PAT)
#   - db_password           (contraseña fuerte para RDS)
#   - admin_password / restaurant_password
#   - db_allowed_cidr_blocks (ver nota de conectividad más abajo)

# 2. Inicializa (descarga el provider de AWS; estado LOCAL por defecto)
terraform init

# 3. Revisa el plan
terraform plan

# 4. Aplica
terraform apply
```

Esto crea: bucket S3 privado, usuario IAM con acceso al bucket, instancia RDS PostgreSQL,
app de Amplify + rama `staging` con todas las variables de entorno ya configuradas.

Al terminar, mira los outputs:

```bash
terraform output                       # valores no sensibles
terraform output -raw database_url     # connection string para migraciones
terraform output amplify_branch_url    # URL pública de Amplify (para Cloudflare)
```

> El `terraform.tfstate` queda local y **contiene secretos**; está en `.gitignore`. Guárdalo
> a buen recaudo. Para estado remoto/compartido, ver `backend.tf`.

### Nota de conectividad RDS ⚠️

Amplify (SSR) no tiene IPs de salida fijas, así que el *security group* de RDS no puede
limitarse solo a tu laptop si quieres que la app conecte. Para el MVP hay dos caminos:

- **Demo rápido**: pon `db_allowed_cidr_blocks = ["0.0.0.0/0"]`. La instancia es pública
  pero el `DATABASE_URL` exige `sslmode=require` y la contraseña es fuerte. Es el patrón
  típico para una demo; endurécelo después.
- **Más estricto**: deja solo tu IP para correr migraciones y, para la app, integra Amplify
  con una VPC más adelante (fuera del alcance del MVP).

---

## 2. Configurar / verificar Amplify

Terraform ya crea la app y la rama, pero la **primera conexión a GitHub** necesita que el
PAT sea válido. Tras `apply`:

1. Abre la consola de **AWS Amplify** → tu app `pedidoscloud-staging`.
2. Confirma que la rama `staging` aparece conectada y que detecta el `amplify.yml` del repo
   (monorepo, `appRoot: apps/web`, plataforma **WEB_COMPUTE** para SSR).
3. Lanza el primer build: **Run build** (o haz un push a `staging`).
4. Si el build no arranca solo, en *App settings → General* revisa que el repositorio y el
   token estén OK.

El `amplify.yml` (en la raíz del repo) hace `npm ci` y `npm run build`
(`prisma generate && next build`). **No corre migraciones** a propósito (ver paso 4).

---

## 3. Variables de entorno

Las variables las define Terraform en Amplify (a nivel de app, heredadas por la rama):

| Variable | Origen |
| --- | --- |
| `DATABASE_URL` | output del módulo RDS (con `sslmode=require`) |
| `STORAGE_DRIVER` | `s3` |
| `S3_REGION`, `S3_BUCKET` | módulo S3 / región |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | módulo IAM |
| `ADMIN_USER`, `ADMIN_PASSWORD` | tfvars |
| `RESTAURANT_USER`, `RESTAURANT_PASSWORD` | tfvars |

> **Importante**: AWS Amplify **prohíbe** variables que empiecen con `AWS`. Por eso las
> credenciales usan nombres `S3_*` y la app las lee en `lib/storage.ts`.

Para verlas/editarlas manualmente: Amplify → *Hosting → Environment variables*. Si cambias
algo ahí, vuelve a desplegar la rama para que tome efecto.

---

## 4. Migraciones de Prisma contra RDS

Las migraciones se corren **manualmente** desde tu laptop (tu IP debe estar en
`db_allowed_cidr_blocks`). Desde la raíz del repo:

```bash
cd apps/web

# Toma el DATABASE_URL del output de Terraform
export DATABASE_URL="$(cd ../../infra/terraform/envs/staging && terraform output -raw database_url)"

# Aplica las migraciones existentes (NO crea nuevas)
npm run db:deploy        # = prisma migrate deploy

# (Opcional) carga datos de ejemplo en staging
npm run db:seed
```

Repite este paso cada vez que agregues una migración nueva (créala en local con
`npm run db:migrate`, súbela al repo y luego `db:deploy` contra cada entorno).

---

## 5. Conectar el dominio en Cloudflare

El dominio `pedidoscloud.com` está en Cloudflare. Lo más simple para el MVP es apuntar un
registro a la URL de Amplify:

1. En Terraform: `terraform output amplify_branch_url`
   (ej. `https://staging.d1abcd2efghij.amplifyapp.com`).
2. En Cloudflare → DNS, crea un **CNAME**:
   - Staging: `staging` → `staging.d1abcd2efghij.amplifyapp.com` (Proxy: naranja ON).
   - Prod: `@` o `www` → `main.dXXXX.amplifyapp.com`.
3. SSL/TLS en Cloudflare en modo **Full**.

> Alternativa más robusta (opcional): asociar el dominio en Amplify (*Custom domains*) y
> crear en Cloudflare los registros de verificación que Amplify indique. Para una demo, el
> CNAME directo es suficiente.

Cloudflare queda como DNS/CDN/WAF/SSL frente a Amplify, tal como se diseñó.

---

## 6. Staging vs Prod

Están separados por carpeta de Terraform y por rama de Git:

| | Staging | Prod |
| --- | --- | --- |
| Carpeta Terraform | `infra/terraform/envs/staging` | `infra/terraform/envs/prod` |
| Rama de Amplify | `staging` | `main` |
| Recursos | sufijo `-staging` | sufijo `-prod` |
| RDS | `db.t3.micro`, sin protección | `db.t3.small`, `deletion_protection`, snapshot final, backups 14 días |
| S3 | `force_destroy = true` | `force_destroy = false` |

Para desplegar prod, repite el paso 1 en `infra/terraform/envs/prod` con su propio
`terraform.tfvars`, luego los pasos 2–5 apuntando a `main`.

---

## 7. Checklist de salida a producción (post-MVP)

- [ ] Reemplazar Basic Auth por auth real con cuentas por restaurante (NextAuth/Cognito).
- [ ] Mover RDS a subredes privadas + integración VPC de Amplify (cerrar el `0.0.0.0/0`).
- [ ] Estado remoto de Terraform (S3 + DynamoDB lock) — ver `backend.tf`.
- [ ] Rotar las llaves del usuario IAM o migrar al rol de cómputo de Amplify.
- [ ] Activar logs/alarmas en CloudWatch (RDS, Amplify) y backups verificados.
- [ ] Considerar URLs prefirmadas con expiración para comprobantes muy sensibles.
