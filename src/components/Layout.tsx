import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { useAuth } from '../auth/authContext.ts'
import { ConnectionBanner } from './ConnectionBanner.tsx'
import { NavIcon, type IconName } from './NavIcon.tsx'

// Shell layout adapted from the TailAdmin free template (MIT): collapsible sidebar that expands on
// hover, mobile drawer with backdrop, and a header with a toggle button and a user menu.

interface NavLinkItem {
  to: string
  label: string
  /** Heading shown in the header for this section. */
  title: string
  icon: IconName
}

interface NavGroup {
  title: string
  links: NavLinkItem[]
}

const groups: NavGroup[] = [
  {
    title: 'Día a día',
    links: [
      { to: '/', label: 'Inicio', title: 'Inicio', icon: 'home' },
      { to: '/ventas', label: 'Ventas', title: 'Ventas', icon: 'sales' },
      { to: '/eventos', label: 'Eventos', title: 'Eventos', icon: 'events' },
      { to: '/pedidos', label: 'Pedidos', title: 'Pedidos', icon: 'requests' },
    ],
  },
  {
    title: 'Catálogo',
    links: [
      { to: '/catalogo', label: 'Diseños', title: 'Diseños', icon: 'catalog' },
      { to: '/colecciones', label: 'Colecciones', title: 'Colecciones', icon: 'topics' },
      { to: '/precios', label: 'Precios', title: 'Precios', icon: 'prices' },
      { to: '/promociones', label: 'Promos', title: 'Promociones', icon: 'promos' },
      { to: '/descargas', label: 'Descargas', title: 'Descargas gratuitas', icon: 'downloads' },
    ],
  },
  {
    title: 'Equipo',
    links: [{ to: '/actividad', label: 'Actividad', title: 'Actividad', icon: 'activity' }],
  },
]
// Stock, Solicitudes, Temas, Entregas and Tiradas y gastos are hidden for now (code kept in pages/).

const allLinks = groups.flatMap((g) => g.links)

const initials = (name: string | null) =>
  (name ?? '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

const STORAGE_KEY = 'pandito-panel:sidebar-collapsed'

function readCollapsed() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function UserMenu() {
  const { displayName, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointer = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="flex min-h-11 items-center gap-3 rounded-lg px-1 text-left hover:bg-crema/60"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-azul/10 text-sm font-semibold text-azul"
        >
          {initials(displayName)}
        </span>
        <span className="hidden max-w-40 truncate text-sm font-medium sm:inline">{displayName}</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-56 rounded-2xl border border-line bg-white p-2 shadow-lg"
        >
          <p className="truncate px-3 py-2 text-sm font-medium">{displayName}</p>
          <button
            type="button"
            role="menuitem"
            className="flex min-h-11 w-full items-center rounded-lg px-3 text-sm font-medium text-tinta/80 hover:bg-crema/60 hover:text-tinta"
            onClick={() => void signOut()}
          >
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  )
}

export function Layout() {
  const { pathname } = useLocation()
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [hovered, setHovered] = useState(false)
  // The drawer remembers the route it was opened on, so navigating closes it without an effect.
  const [drawerPath, setDrawerPath] = useState<string | null>(null)
  const mobileOpen = drawerPath === pathname
  const setMobileOpen = (open: boolean | ((value: boolean) => boolean)) =>
    setDrawerPath((current) => ((typeof open === 'function' ? open(current === pathname) : open) ? pathname : null))
  const section = allLinks.find((link) => pathname === link.to || pathname.startsWith(`${link.to}/`))

  useEffect(() => {
    if (!mobileOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawerPath(null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [mobileOpen])

  function toggle() {
    if (window.matchMedia('(min-width: 1280px)').matches) {
      setCollapsed((value) => {
        try {
          localStorage.setItem(STORAGE_KEY, value ? '0' : '1')
        } catch {
          // The preference is a convenience; ignore storage failures.
        }
        return !value
      })
    } else {
      setMobileOpen((value) => !value)
    }
  }

  const wide = !collapsed || hovered || mobileOpen
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm ${wide ? '' : 'xl:justify-center'} ${
      isActive ? 'bg-azul/10 font-semibold text-azul' : 'font-medium text-tinta/80 hover:bg-crema/60 hover:text-tinta'
    }`

  return (
    <div className="min-h-screen bg-surface xl:flex">
      <aside
        className={`fixed left-0 top-0 z-50 flex h-screen flex-col border-r border-line bg-white px-5 transition-all duration-300 ease-in-out xl:translate-x-0 ${
          wide ? 'w-72' : 'w-24'
        } ${mobileOpen ? 'translate-x-0' : '-translate-x-full max-xl:invisible'}`}
        onMouseEnter={() => collapsed && setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div className={`flex py-8 ${wide ? 'justify-start' : 'xl:justify-center'}`}>
          {wide ? (
            <img src="/brand/logotipo-naranja.svg" alt="Pandito" className="h-auto w-32" />
          ) : (
            <img src="/favicon.svg" alt="Pandito" className="h-9 w-9" />
          )}
        </div>

        <nav aria-label="Principal" className="min-h-0 flex-1 space-y-6 overflow-y-auto pb-6">
          {groups.map((group) => (
            <div key={group.title}>
              <p className={`mb-3 px-3 text-xs text-muted ${wide ? '' : 'xl:text-center'}`}>{wide ? group.title : '···'}</p>
              <ul className="space-y-1">
                {group.links.map((link) => (
                  <li key={link.to}>
                    <NavLink to={link.to} end={link.to === '/'} className={linkClass} title={wide ? undefined : link.label}>
                      <NavIcon name={link.icon} />
                      {wide ? link.label : <span className="sr-only">{link.label}</span>}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      {mobileOpen && (
        <button
          type="button"
          aria-label="Cerrar menú"
          className="fixed inset-0 z-40 bg-tinta/40 xl:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div className={`min-w-0 flex-1 transition-[margin] duration-300 ease-in-out ${collapsed ? 'xl:ml-24' : 'xl:ml-72'}`}>
        <header className="sticky top-0 z-30 flex min-h-20 items-center justify-between gap-3 border-b border-line bg-white px-4 xl:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-line text-muted hover:bg-crema/60"
              aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú'}
              aria-expanded={mobileOpen}
              onClick={toggle}
            >
              <svg width="18" height="14" viewBox="0 0 16 12" fill="none" aria-hidden="true">
                <path d="M1 1.5h14M1 6h8M1 10.5h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
            <p className="truncate text-xl font-semibold">{section?.title ?? 'Panel'}</p>
          </div>
          <UserMenu />
        </header>
        <ConnectionBanner />
        <main className="min-w-0 bg-surface p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
