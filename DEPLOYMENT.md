# Despliegue en AWS — PedidosCloud

## Arquitectura

```
Cloudflare (DNS + CDN + WAF + SSL)
         │  CNAME → pedidoscloud.com
         ▼
AWS Amplify Hosting (WEB_COMPUTE — Next.js SSR)
         │  construye desde GitHub (rama por entorno)
         ├──► Amazon RDS PostgreSQL   (base de datos)
         └──► Amazon S3 privado       (uploads: QR Nequi + comprobantes)
```

- **Infra**: Terraform, aplicado manualmente desde el laptop (sin pipeline por ahora).
- **App**: Amplify conectado a GitHub — cada push a la rama del entorno hace build y deploya.
- **Migraciones**: `prisma migrate deploy` corre automáticamente en cada build (no hay paso manual).
- **Secretos**: variables de entorno en la rama de Amplify (las configura Terraform).

---

## Particularidades de Amplify WEB_COMPUTE

Dos decisiones de diseño importantes, documentadas aquí para no perder contexto:

### Variables de entorno — dos niveles

Amplify tiene dos niveles de env vars con comportamientos distintos:

| Nivel | Quién lo lee | Cómo se configura |
|---|---|---|
| **App** | Build (CodeBuild) + detección temprana del monorepo | `aws_amplify_app.environment_variables` en Terraform |
| **Branch** | Build (CodeBuild) **pero NO el Lambda SSR** en runtime | `aws_amplify_branch.environment_variables` en Terraform |

Por este motivo:
- `AMPLIFY_MONOREPO_APP_ROOT=apps/web` está en el nivel **app** (Terraform lo gestiona).
  Amplify lo lee antes de clonar el repo para localizar el `package.json`.
- Todas las demás vars (DATABASE_URL, S3, auth) están en el nivel **branch**.

### Workaround runtime (lib/runtime-env.ts)

El Lambda SSR de Amplify WEB_COMPUTE **no recibe** las branch-level env vars en `process.env`.
Como workaround, el build escribe las vars a `.next/.env.runtime` (se deploya con el artefacto),
y `lib/runtime-env.ts` las carga al iniciar el servidor (`lib/prisma.ts` la llama antes de crear PrismaClient).

Si en el futuro Amplify soluciona este comportamiento, basta eliminar el paso del `amplify.yml`
y el import en `lib/prisma.ts`.

---

## 0. Requisitos previos

- Cuenta AWS y CLI configurado: `aws configure` o `aws sso login` (verifica con `aws sts get-caller-identity`).
- Terraform ≥ 1.5 (`terraform version`).
- GitHub PAT (classic con scope `repo` o fine-grained con Contents + Webhooks) para que Amplify haga checkout.
- Repo en GitHub con las ramas `staging-aws` y `main`.

---

## 1. Desplegar infraestructura de staging

```bash
cd infra/terraform/envs/staging

# Prepara variables (copia el ejemplo y rellena los valores marcados)
cp terraform.tfvars.example terraform.tfvars
# Edita terraform.tfvars:
#   - github_access_token   (tu PAT)
#   - db_password           (contraseña fuerte para RDS — sin / @ " ni espacios)
#   - admin_password / restaurant_password
#   - db_allowed_cidr_blocks (tu IP pública: `curl -s https://checkip.amazonaws.com`)

terraform init
terraform plan      # revisa qué se creará
terraform apply     # acepta con "yes"
```

Terraform crea:
- **S3**: bucket privado `pedidoscloud-staging-uploads` (cifrado, sin acceso público)
- **IAM**: usuario `pedidoscloud-staging-app` con acceso mínimo al bucket
- **RDS**: instancia PostgreSQL `pedidoscloud-staging` (db.t3.micro, cifrada)
- **Amplify**: app `pedidoscloud-staging` + rama `staging-aws` con todas las env vars configuradas

Outputs importantes:
```bash
terraform output                        # valores no sensibles
terraform output -raw database_url      # connection string (para db:seed)
terraform output amplify_branch_url     # URL pública de Amplify
```

> El `terraform.tfstate` queda local y **contiene secretos** — está gitignoreado.
> Guárdalo de forma segura. Ver `backend.tf` para habilitar estado remoto en S3.

### Nota de seguridad: conectividad RDS ⚠️

**Decisión conocida del MVP**: el security group de RDS permite `0.0.0.0/0` en el puerto 5432
para que Amplify SSR pueda conectarse (Amplify no tiene IPs de salida fijas).
Mitigaciones activas: `sslmode=require` en `DATABASE_URL` y contraseña fuerte.

**Mejora futura** (obligatoria antes de prod): subredes privadas + `vpc_config` en Amplify.
Ver sección §7 checklist.

---

## 2. Configurar la app en Amplify

Tras `terraform apply`, Amplify ya tiene la app y la rama creadas. Para verificar:

1. Abre la consola de Amplify → app `pedidoscloud-staging`.
2. Confirma que la rama `staging-aws` está conectada a GitHub y detecta el `amplify.yml`.
3. Lanza el primer build: **Run build** (o haz push a `staging-aws`).

El primer build correrá automáticamente:
```
npm ci
npx prisma migrate deploy   ← crea el schema en RDS
npm run build               ← prisma generate + next build
node -e "..."               ← escribe .next/.env.runtime
```

**No necesitas correr migraciones manualmente** — el build las aplica.

Si el build no arranca: verifica en Amplify → App settings que el PAT de GitHub sea válido.
Si caducó, renuévalo en GitHub y actualiza con:
```bash
aws amplify update-app \
  --app-id TU_APP_ID \
  --access-token ghp_nuevo_token
```

---

## 3. Variables de entorno en Amplify

Terraform las configura automáticamente. Aquí la tabla de referencia:

| Variable | Nivel | Valor de origen |
|---|---|---|
| `AMPLIFY_MONOREPO_APP_ROOT` | App | `"apps/web"` (hardcoded en el módulo Terraform) |
| `DATABASE_URL` | Branch | Output del módulo RDS (incluye `sslmode=require`) |
| `STORAGE_DRIVER` | Branch | `"s3"` |
| `S3_REGION` | Branch | Variable `aws_region` del env |
| `S3_BUCKET` | Branch | Output del módulo S3 |
| `S3_ACCESS_KEY_ID` | Branch | Output del módulo IAM |
| `S3_SECRET_ACCESS_KEY` | Branch | Output del módulo IAM (sensible) |
| `ADMIN_USER` | Branch | `var.admin_user` (default: `"admin"`) |
| `ADMIN_PASSWORD` | Branch | `var.admin_password` del tfvars |
| `RESTAURANT_USER` | Branch | `var.restaurant_user` (default: `"restaurante"`) |
| `RESTAURANT_PASSWORD` | Branch | `var.restaurant_password` del tfvars |

> Amplify prohíbe variables que empiecen con `AWS`. Por eso las credenciales S3 usan `S3_*`.
> La app las lee en `lib/storage.ts`.

Para verificar qué tiene Amplify actualmente:
```bash
# App level
aws amplify get-app --app-id TU_APP_ID --query 'app.environmentVariables'
# Branch level
aws amplify get-branch --app-id TU_APP_ID --branch-name staging-aws \
  --query 'branch.environmentVariables'
```

---

## 4. Cargar datos de ejemplo (opcional)

El schema se crea automáticamente en el build. Para cargar restaurantes y menús de demo:

```bash
cd apps/web
export DATABASE_URL="$(cd ../../infra/terraform/envs/staging && terraform output -raw database_url)"
npm run db:seed
```

Esto crea dos restaurantes de demo con `whatsappPhone: "3186673967"`.
En producción, configura los restaurantes y su WhatsApp desde `/admin`.

---

## 5. Conectar el dominio en Cloudflare

### Configurar custom domain en Amplify

1. Amplify → Hosting → Custom domains → **Add domain** → `pedidoscloud.com`
2. Configura subdominios:
   - `staging` → branch `staging-aws`
   - (Para prod) `@` y `www` → branch `main`
3. Selecciona **Amplify managed certificate** → **Add domain**
4. Amplify muestra los registros DNS a agregar.

### Agregar registros en Cloudflare

| Tipo | Nombre | Valor | Proxy |
|---|---|---|---|
| CNAME | `_xxxx` (verificación ACM) | `xxxx.acm-validations.aws` | **OFF** (gris) |
| CNAME | `staging` | `staging-aws.dXXXX.amplifyapp.com` | **ON** (naranja) |

> El registro de verificación ACM **debe** tener Proxy OFF. Si está en naranja, el certificado nunca se valida.

### SSL en Cloudflare

Cloudflare → SSL/TLS → Overview → modo **Full** (no Flexible, no Full Strict).

El dominio estará activo en ~10–20 minutos. Cuando los 3 pasos de Amplify estén en verde,
el proxy de Cloudflare puede quedar en naranja.

---

## 6. WhatsApp por restaurante

Cada restaurante tiene un campo `whatsappPhone` (separado del `nequiPhone` de Nequi).
Lo usa el botón "Preguntar por WhatsApp" en la página de seguimiento del cliente.

Configurar desde `/admin` → Consola del restaurante → campo **WhatsApp**.
Si no está configurado, el botón usa el `nequiPhone` como fallback.

Formato: número colombiano de 10 dígitos sin prefijo (ej. `3186673967`).
La app agrega automáticamente el prefijo `57`.

---

## 7. Staging vs Prod

| | Staging | Prod |
|---|---|---|
| Carpeta Terraform | `infra/terraform/envs/staging` | `infra/terraform/envs/prod` |
| Rama Amplify | `staging-aws` | `main` |
| RDS | `db.t3.micro`, sin deletion_protection | `db.t3.small`, deletion_protection ON, final snapshot, 14 días backup |
| S3 | `force_destroy = true` | `force_destroy = false` |
| Recursos AWS | sufijo `-staging` | sufijo `-prod` |

Para desplegar prod: repite los pasos 1–5 desde `infra/terraform/envs/prod` con su propio `terraform.tfvars`.

---

## 8. Ciclo terraform destroy + apply (desde cero)

Cuando destruyes y recreas la infra, todo funciona automáticamente:

```bash
# 1. Destruir
cd infra/terraform/envs/staging
terraform destroy   # escribe "yes"

# 2. Recrear
terraform apply

# 3. La primera vez que Amplify hace build, el amplify.yml corre:
#    - prisma migrate deploy  → crea el schema
#    - npm run build          → construye la app
#    → La app queda funcional sin ningún paso manual adicional

# 4. Opcional: cargar datos de demo
cd ../../../apps/web
export DATABASE_URL="$(cd ../../infra/terraform/envs/staging && terraform output -raw database_url)"
npm run db:seed

# 5. Opcional: trigger manual del build (si Amplify no lo hizo solo)
aws amplify start-job \
  --app-id $(cd ../../infra/terraform/envs/staging && terraform output -raw amplify_app_id) \
  --branch-name staging-aws \
  --job-type RELEASE
```

---

## 9. Estado remoto de Terraform (cuando colaboren o haya pipeline)

El estado local (`terraform.tfstate`) contiene secretos y es suficiente para un developer solo.
Para estado compartido, crea primero la infraestructura de backend (una sola vez):

```bash
# Crea el bucket de estado y la tabla de locks (fuera de Terraform, con CLI)
aws s3api create-bucket --bucket pedidoscloud-tfstate --region us-east-1
aws dynamodb create-table \
  --table-name pedidoscloud-tflock \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

Luego descomenta y rellena el bloque `terraform { backend "s3" { ... } }` en `backend.tf`
y corre `terraform init -migrate-state`.

---

## 10. Checklist de salida a producción (post-MVP)

- [ ] **VPC connectivity**: subredes privadas + `vpc_config` en Amplify → cerrar `0.0.0.0/0` en RDS.
- [ ] **Auth real**: reemplazar Basic Auth por cuentas por restaurante (NextAuth o Cognito).
- [ ] **Estado remoto de Terraform**: S3 + DynamoDB lock (ver §9).
- [ ] **Rotar llaves IAM**: o migrar al rol de cómputo de Amplify (eliminar usuario IAM).
- [ ] **CloudWatch alarmas**: en RDS (CPU, connections), Amplify (error rate).
- [ ] **Backups verificados**: probar restore desde snapshot de RDS.
- [ ] **Eliminar ruta `/api/health`**: ya eliminada del código actual ✓.
- [ ] **Pipeline Terraform**: si más de una persona despliega infra.
