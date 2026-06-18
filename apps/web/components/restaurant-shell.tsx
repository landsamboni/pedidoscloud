"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { LogoutButton } from "@/components/logout-button";

// ── Inline SVG icons ─────────────────────────────────────────────────────────

function IconOrders() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <rect height="18" rx="2" width="14" x="5" y="3" /><path d="M9 7h6M9 11h6M9 15h4" strokeLinecap="round" />
    </svg>
  );
}
function IconHome() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path d="M3 12l9-9 9 9M5 10v9a1 1 0 001 1h4v-5h4v5h4a1 1 0 001-1v-9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconHistory() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconChart() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path d="M4 20h16M4 20V10l4-4 4 4 4-6v16" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconUsers() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <circle cx="9" cy="7" r="4" /><path d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2" strokeLinecap="round" />
      <path d="M16 3.13a4 4 0 010 7.75M21 21v-2a4 4 0 00-3-3.87" strokeLinecap="round" />
    </svg>
  );
}
function IconSearch() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" strokeLinecap="round" />
    </svg>
  );
}
function IconBell() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Nav config ────────────────────────────────────────────────────────────────

const navItems = (slug: string) => [
  { label: "Consola",        href: `/restaurant/${slug}`,           icon: <IconHome /> },
  { label: "Pedidos de hoy", href: `/restaurant/${slug}/orders`,    icon: <IconOrders /> },
  { label: "Historial",      href: `/restaurant/${slug}/history`,   icon: <IconHistory /> },
  { label: "Analíticas",     href: `/restaurant/${slug}/analytics`, icon: <IconChart /> },
  { label: "Clientes",       href: `/restaurant/${slug}/customers`, icon: <IconUsers /> },
];

// ── Initials helper ──────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0] ?? "").join("").toUpperCase() || "R";
}

// ── Shell ─────────────────────────────────────────────────────────────────────

interface Props {
  children: React.ReactNode;
  restaurantName: string;
  restaurantSlug: string;
  pendingCount: number;
}

export function RestaurantShell({ children, restaurantName, restaurantSlug, pendingCount }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const nav = navItems(restaurantSlug);
  const [query, setQuery] = useState("");

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    const dest = `/restaurant/${restaurantSlug}/orders`;
    router.push(q ? `${dest}?q=${encodeURIComponent(q)}` : dest);
  }

  return (
    // On mobile: no height constraint, sidebar/topbar hidden — page scrolls normally.
    // On desktop (lg+): full-viewport shell, sidebar + topbar fixed, content scrolls.
    <div className="lg:flex lg:h-screen lg:overflow-hidden">

      {/* ── Left sidebar (desktop only) ────────────────────────────────── */}
      <aside className="hidden lg:flex lg:w-56 lg:flex-col lg:shrink-0 bg-slate-900 text-slate-100">

        {/* Logo */}
        <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-slate-700/60 px-4">
          <svg className="h-8 w-8 shrink-0" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="cloud-gradient" x1="0%" x2="100%" y1="0%" y2="100%">
                <stop offset="0%" stopColor="#c026d3" />
                <stop offset="50%" stopColor="#818cf8" />
                <stop offset="100%" stopColor="#2575FC" />
              </linearGradient>
            </defs>
            <path
              d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"
              stroke="url(#cloud-gradient)"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.75"
              fill="none"
            />
          </svg>
          <span className="text-sm font-bold tracking-tight">
            <span className="text-white">Pedidos</span><span style={{ color: "#2575FC" }}>Cloud</span>
          </span>
        </div>

        {/* Restaurant name */}
        <div className="border-b border-slate-700/60 px-5 py-3">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Restaurante</p>
          <p className="mt-0.5 truncate text-sm font-semibold text-slate-200">{restaurantName}</p>
        </div>

        {/* Nav items */}
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
          {nav.map(({ label, href, icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-brand-blue text-white"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                }`}
                href={href}
              >
                <span className={active ? "text-white" : "text-slate-500"}>{icon}</span>
                {label}
              </Link>
            );
          })}
        </nav>

        {/* User / logout */}
        <div className="border-t border-slate-700/60 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-700 text-xs font-bold text-slate-200">
              {initials(restaurantName)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-slate-300">{restaurantName}</p>
            </div>
          </div>
          <div className="mt-2">
            <LogoutButton
              className="w-full rounded-lg bg-slate-800 px-3 py-2 text-xs font-medium text-slate-400 transition hover:bg-red-900/50 hover:text-red-300 text-left"
              vertical
            />
          </div>
        </div>
      </aside>

      {/* ── Right side: topbar + content ───────────────────────────────── */}
      <div className="lg:flex lg:flex-1 lg:flex-col lg:overflow-hidden">

        {/* Topbar (desktop only) */}
        <header className="hidden lg:flex h-14 shrink-0 items-center gap-4 border-b border-slate-200 bg-white px-6">
          {/* Search bar */}
          <form className="flex flex-1 max-w-md items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 focus-within:border-brand-blue focus-within:ring-2 focus-within:ring-brand-blue/20 transition" onSubmit={handleSearch}>
            <IconSearch />
            <input
              className="flex-1 bg-transparent text-sm text-slate-700 placeholder-slate-400 outline-none"
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar por nombre, teléfono, #pedido…"
              type="search"
              value={query}
            />
          </form>

          <div className="flex items-center gap-3 ml-auto">
            {/* Bell with pending badge */}
            <Link
              className="relative flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100"
              href={`/restaurant/${restaurantSlug}/orders`}
              title={pendingCount > 0 ? `${pendingCount} pedidos pendientes` : "Sin pedidos pendientes"}
            >
              <IconBell />
              {pendingCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white leading-none">
                  {pendingCount > 99 ? "99+" : pendingCount}
                </span>
              )}
            </Link>

            {/* Avatar */}
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-blue text-sm font-bold text-white select-none">
              {initials(restaurantName)}
            </div>
          </div>
        </header>

        {/* Scrollable content */}
        <div className="lg:flex-1 lg:overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
