import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl p-6">
      <section className="card mt-10">
        <p className="text-sm font-semibold uppercase tracking-wide text-rose-600">Demo local</p>
        <h1 className="mt-2 text-3xl font-bold">Pedidos de almuerzo</h1>
        <p className="mt-3 text-stone-600">
          Un flujo simple para enviar un enlace por WhatsApp y recibir pedidos ordenados.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link className="button-primary" href="/r/martica-la-bonita">
            Pedir en Martica la Bonita
          </Link>
          <Link className="button-secondary" href="/restaurant/martica-la-bonita/orders" prefetch={false}>
            Ver tablero
          </Link>
          <Link className="button-secondary" href="/admin" prefetch={false}>
            Abrir admin
          </Link>
        </div>
      </section>
    </main>
  );
}
