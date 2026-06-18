"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";

// ── Icons ─────────────────────────────────────────────────────────────────────

function IconGrid() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <rect height="7" rx="1.5" width="7" x="3" y="3" /><rect height="7" rx="1.5" width="7" x="14" y="3" />
      <rect height="7" rx="1.5" width="7" x="3" y="14" /><rect height="7" rx="1.5" width="7" x="14" y="14" />
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
function IconSearch() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" strokeLinecap="round" />
    </svg>
  );
}

// ── Nav ───────────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { label: "Restaurantes", href: "/admin", icon: <IconGrid />, exact: true },
];

// ── Shell ─────────────────────────────────────────────────────────────────────

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  function isActive(href: string, exact: boolean) {
    return exact ? pathname === href : pathname.startsWith(href);
  }

  return (
    <div className="lg:flex lg:h-screen lg:overflow-hidden">

      {/* ── Sidebar (desktop only) — purple palette ────────────────────── */}
      <aside className="hidden lg:flex lg:w-56 lg:flex-col lg:shrink-0 bg-purple-950 text-purple-100">

        {/* Logo */}
        <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-purple-800/60 px-4">
          <svg className="h-8 w-8 shrink-0" fill="none" viewBox="0 0 24 24">
            <defs>
              <linearGradient id="cloud-g-admin" x1="0%" x2="100%" y1="0%" y2="100%">
                <stop offset="0%" stopColor="#c026d3" />
                <stop offset="50%" stopColor="#818cf8" />
                <stop offset="100%" stopColor="#2575FC" />
              </linearGradient>
            </defs>
            <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" fill="none" stroke="url(#cloud-g-admin)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" />
          </svg>
          <span className="text-sm font-bold tracking-tight">
            <span className="text-white">Pedidos</span><span style={{ color: "#2575FC" }}>Cloud</span>
          </span>
        </div>

        {/* Admin badge */}
        <div className="border-b border-purple-800/60 px-5 py-3">
          <p className="text-xs font-medium uppercase tracking-wider text-purple-400">Panel de</p>
          <p className="mt-0.5 text-sm font-bold text-purple-100">Administración</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
          {NAV_ITEMS.map(({ label, href, icon, exact }) => {
            const active = isActive(href, exact);
            return (
              <Link
                key={href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-purple-600 text-white"
                    : "text-purple-300 hover:bg-purple-800/60 hover:text-purple-100"
                }`}
                href={href}
              >
                <span className={active ? "text-white" : "text-purple-400"}>{icon}</span>
                {label}
              </Link>
            );
          })}
        </nav>

        {/* User / logout */}
        <div className="border-t border-purple-800/60 px-4 py-3">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-700 text-xs font-bold text-purple-200">
              A
            </div>
            <p className="text-xs font-medium text-purple-300">Administrador</p>
          </div>
          <LogoutButton
            className="w-full rounded-lg bg-purple-900 px-3 py-2 text-xs font-medium text-purple-400 transition hover:bg-red-900/50 hover:text-red-300 text-left"
            vertical
          />
        </div>
      </aside>

      {/* ── Right side: topbar + content ───────────────────────────────── */}
      <div className="lg:flex lg:flex-1 lg:flex-col lg:overflow-hidden">

        {/* Topbar */}
        <header className="hidden lg:flex h-14 shrink-0 items-center gap-4 border-b border-stone-200 bg-white px-6">
          <div className="flex flex-1 max-w-md items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 focus-within:border-purple-400 focus-within:ring-2 focus-within:ring-purple-200 transition">
            <IconSearch />
            <input
              className="flex-1 bg-transparent text-sm text-slate-700 placeholder-slate-400 outline-none"
              placeholder="Buscar restaurantes…"
              type="search"
            />
          </div>

          <div className="flex items-center gap-3 ml-auto">
            <button className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100" type="button">
              <IconBell />
            </button>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-600 text-sm font-bold text-white select-none">
              A
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="lg:flex-1 lg:overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
