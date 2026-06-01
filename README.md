# Demo de pedidos para restaurantes

Aplicación web local para que restaurantes pequeños compartan un enlace por WhatsApp y reciban pedidos de almuerzo organizados. Incluye página móvil del cliente, tablero operativo del restaurante y panel admin sin autenticación.

## Stack

- Next.js con App Router y TypeScript
- PostgreSQL
- Prisma ORM
- Tailwind CSS
- Server Actions de Next.js

## Requisitos

- Node.js 20 o superior
- npm
- PostgreSQL local o Docker

## Configuración local

1. Instala dependencias:

   ```bash
   npm install
   ```

2. Crea el archivo de variables de entorno:

   ```bash
   cp .env.example .env
   ```

3. Levanta PostgreSQL con Docker:

   ```bash
   docker compose up -d
   ```

   Si ya tienes PostgreSQL instalado, crea una base de datos y ajusta `DATABASE_URL` en `.env`.

4. Aplica las migraciones:

   ```bash
   npm run db:migrate
   ```

5. Carga los dos restaurantes y los menús de ejemplo:

   ```bash
   npm run db:seed
   ```

6. Inicia el servidor:

   ```bash
   npm run dev
   ```

Abre [http://localhost:3000](http://localhost:3000).

## Rutas principales

- Cliente Martica la Bonita: [http://localhost:3000/r/martica-la-bonita](http://localhost:3000/r/martica-la-bonita)
- Cliente Sazón de Casa: [http://localhost:3000/r/sazon-de-casa](http://localhost:3000/r/sazon-de-casa)
- Tablero Martica la Bonita: [http://localhost:3000/restaurant/martica-la-bonita/orders](http://localhost:3000/restaurant/martica-la-bonita/orders)
- Consola aislada del restaurante: [http://localhost:3000/restaurant/martica-la-bonita](http://localhost:3000/restaurant/martica-la-bonita)
- Admin: [http://localhost:3000/admin](http://localhost:3000/admin)

## Notas del demo

- El número de orden se incrementa por restaurante y por día mediante `DailyOrderCounter`.
- Los clientes se reutilizan por teléfono dentro de cada restaurante.
- Cada pedido tiene un enlace público de seguimiento con un token aleatorio.
- El admin permite configurar titular, celular o llave y QR Nequi por restaurante.
- Cada restaurante tiene una consola separada en `/restaurant/[restaurantSlug]` para administrar solamente su menú, método de pago y tablero.
- `/admin` conserva la vista global para el propietario de la plataforma. El demo todavía no incluye login: antes de publicarlo se debe agregar autenticación y autorización.
- Los comprobantes se almacenan localmente en `public/uploads` para este demo. En producción deben moverse a almacenamiento privado en nube.
- No hay login, integración con WhatsApp ni pasarela de pagos.
- El tablero del restaurante refresca los pedidos cada 10 segundos.
