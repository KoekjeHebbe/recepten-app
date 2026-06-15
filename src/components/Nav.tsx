import { NavLink, useNavigate } from 'react-router-dom'
import { UtensilsCrossed, CalendarDays, ShoppingCart, SlidersHorizontal, Plus, LogIn, LogOut } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useWeekMenu } from '../store/weekmenu'
import { useAuth } from '../store/auth'
import { DAGEN } from '../types'

interface Bestemming { to: string; label: string; icon: LucideIcon; badge?: number }

export default function Nav() {
  const { menu } = useWeekMenu()
  const { isIngelogd, gebruiker, logout } = useAuth()
  const navigate = useNavigate()
  const totalItems = DAGEN.reduce((sum, dag) => sum + menu[dag].length, 0)

  // Primaire bestemmingen voor de mobiele tabbalk
  const tabs: Bestemming[] = [
    { to: '/', label: 'Recepten', icon: UtensilsCrossed },
    { to: '/weekmenu', label: 'Weekmenu', icon: CalendarDays, badge: totalItems },
    { to: '/boodschappen', label: 'Boodschappen', icon: ShoppingCart },
    ...(isIngelogd
      ? [{ to: '/recept/nieuw', label: 'Recept', icon: Plus } as Bestemming,
         { to: '/extras', label: 'Cache', icon: SlidersHorizontal } as Bestemming]
      : [{ to: '/login', label: 'Inloggen', icon: LogIn } as Bestemming]),
  ]

  return (
    <>
      {/* ── Desktop: zwevende pill-navigatie (sm en breder) ── */}
      <header className="hidden sm:flex fixed top-4 left-0 right-0 z-50 justify-center px-4">
        <nav
          className="flex items-center gap-1 px-3 py-2 rounded-full border border-olive-700/10 shadow-nav max-w-full overflow-x-auto"
          style={{
            background: 'rgba(242,240,233,0.82)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          <NavLink to="/" end className="font-bold text-sm text-olive-700 px-3 py-1.5 rounded-full transition-colors hover:bg-olive-700/8 mr-1 font-serif italic tracking-tight flex-shrink-0">
            TNP
          </NavLink>
          <div className="w-px h-4 bg-olive-700/10 mr-1 flex-shrink-0" />
          <NavLink to="/" end className={({ isActive }) => `text-sm font-medium px-3 py-1.5 rounded-full transition-all btn-magnetic flex-shrink-0 ${isActive ? 'bg-olive-700 text-cream' : 'text-olive-700 hover:bg-olive-700/8'}`}>
            Recepten
          </NavLink>
          <NavLink to="/weekmenu" className={({ isActive }) => `text-sm font-medium px-3 py-1.5 rounded-full transition-all btn-magnetic relative flex-shrink-0 ${isActive ? 'bg-olive-700 text-cream' : 'text-olive-700 hover:bg-olive-700/8'}`}>
            Weekmenu
            {totalItems > 0 && (
              <span className="absolute -top-1 -right-1 bg-terracotta-600 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center leading-none">{totalItems}</span>
            )}
          </NavLink>
          <NavLink to="/boodschappen" className={({ isActive }) => `text-sm font-medium px-3 py-1.5 rounded-full transition-all btn-magnetic flex-shrink-0 ${isActive ? 'bg-olive-700 text-cream' : 'text-olive-700 hover:bg-olive-700/8'}`}>
            Boodschappen
          </NavLink>
          {isIngelogd && (
            <NavLink to="/extras" className={({ isActive }) => `text-sm font-medium px-3 py-1.5 rounded-full transition-all btn-magnetic flex-shrink-0 ${isActive ? 'bg-olive-700 text-cream' : 'text-olive-700 hover:bg-olive-700/8'}`}>
              Extras
            </NavLink>
          )}
          <div className="w-px h-4 bg-olive-700/10 mx-1 flex-shrink-0" />
          {isIngelogd ? (
            <>
              <NavLink to="/recept/nieuw" className={({ isActive }) => `text-sm font-semibold px-3 py-1.5 rounded-full transition-all btn-magnetic flex-shrink-0 ${isActive ? 'bg-terracotta-600 text-white' : 'bg-terracotta-600/10 text-terracotta-600 hover:bg-terracotta-600 hover:text-white'}`}>
                + Recept
              </NavLink>
              <button onClick={() => { logout(); navigate('/') }} title={`Uitloggen (${gebruiker?.naam})`} aria-label={`Uitloggen (${gebruiker?.naam ?? ''})`} className="text-sm px-3 py-1.5 rounded-full text-olive-700/40 hover:text-olive-700 hover:bg-olive-700/8 transition-all btn-magnetic flex-shrink-0">
                {gebruiker?.naam?.split(' ')[0]} <span aria-hidden="true">↩</span>
              </button>
            </>
          ) : (
            <NavLink to="/login" className={({ isActive }) => `text-sm font-semibold px-3 py-1.5 rounded-full transition-all btn-magnetic flex-shrink-0 ${isActive ? 'bg-olive-700 text-cream' : 'text-olive-700/50 hover:text-olive-700 hover:bg-olive-700/8'}`}>
              Inloggen
            </NavLink>
          )}
        </nav>
      </header>

      {/* ── Mobiel: minimale topbalk (merk + uitloggen) ── */}
      <header
        className="sm:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 h-14 border-b border-olive-700/8"
        style={{ background: 'rgba(242,240,233,0.9)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}
      >
        <NavLink to="/" end className="font-serif italic font-bold text-lg text-olive-700 tracking-tight">TNP</NavLink>
        {isIngelogd && (
          <button onClick={() => { logout(); navigate('/') }} aria-label={`Uitloggen (${gebruiker?.naam ?? ''})`} className="flex items-center gap-1.5 text-xs font-semibold text-olive-700/50">
            {gebruiker?.naam?.split(' ')[0]} <LogOut size={14} aria-hidden="true" />
          </button>
        )}
      </header>

      {/* ── Mobiel: onderste tabbalk ── */}
      <nav
        className="sm:hidden fixed bottom-0 left-0 right-0 z-50 flex items-stretch justify-around border-t border-olive-700/8 pb-[env(safe-area-inset-bottom)]"
        style={{ background: 'rgba(242,240,233,0.92)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}
      >
        {tabs.map(({ to, label, icon: Icon, badge }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `relative flex flex-col items-center justify-center gap-0.5 flex-1 py-2.5 text-[10px] font-semibold transition-colors ${
                isActive ? 'text-terracotta-600' : 'text-olive-700/50'
              }`
            }
          >
            <Icon size={20} aria-hidden="true" />
            {label}
            {badge ? (
              <span className="absolute top-1.5 right-1/2 translate-x-3 bg-terracotta-600 text-white text-[9px] font-bold min-w-[15px] h-[15px] px-1 rounded-full flex items-center justify-center leading-none">{badge}</span>
            ) : null}
          </NavLink>
        ))}
      </nav>
    </>
  )
}
