import { NavLink, useNavigate } from 'react-router-dom'
import { useWeekMenu } from '../store/weekmenu'
import { useAuth } from '../store/auth'
import { DAGEN } from '../types'

export default function Nav() {
  const { menu } = useWeekMenu()
  const { isIngelogd, gebruiker, logout } = useAuth()
  const navigate = useNavigate()
  const totalItems = DAGEN.reduce((sum, dag) => sum + menu[dag].length, 0)

  return (
    <header className="fixed top-4 left-0 right-0 z-50 flex justify-center px-4">
      <nav
        className="flex items-center gap-1 px-3 py-2 rounded-full border border-olive-700/10 shadow-nav"
        style={{ background: 'rgba(242,240,233,0.82)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}
      >
        <NavLink
          to="/"
          end
          className="font-bold text-sm text-olive-700 px-3 py-1.5 rounded-full transition-colors hover:bg-olive-700/8 mr-1 font-serif italic tracking-tight"
        >
          TNP
        </NavLink>

        <div className="w-px h-4 bg-olive-700/10 mr-1" />

        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `text-sm font-medium px-3 py-1.5 rounded-full transition-all btn-magnetic ${isActive ? 'bg-olive-700 text-cream' : 'text-olive-700 hover:bg-olive-700/8'}`
          }
        >
          Recepten
        </NavLink>

        <NavLink
          to="/weekmenu"
          className={({ isActive }) =>
            `text-sm font-medium px-3 py-1.5 rounded-full transition-all btn-magnetic relative ${isActive ? 'bg-olive-700 text-cream' : 'text-olive-700 hover:bg-olive-700/8'}`
          }
        >
          Weekmenu
          {totalItems > 0 && (
            <span className="absolute -top-1 -right-1 bg-terracotta-600 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center leading-none">
              {totalItems}
            </span>
          )}
        </NavLink>

        <NavLink
          to="/boodschappen"
          className={({ isActive }) =>
            `text-sm font-medium px-3 py-1.5 rounded-full transition-all btn-magnetic ${isActive ? 'bg-olive-700 text-cream' : 'text-olive-700 hover:bg-olive-700/8'}`
          }
        >
          Boodschappen
        </NavLink>

        <div className="w-px h-4 bg-olive-700/10 mx-1" />

        {isIngelogd ? (
          <>
            <NavLink
              to="/recept/nieuw"
              className={({ isActive }) =>
                `text-sm font-semibold px-3 py-1.5 rounded-full transition-all btn-magnetic ${isActive ? 'bg-terracotta-600 text-white' : 'bg-terracotta-600/10 text-terracotta-600 hover:bg-terracotta-600 hover:text-white'}`
              }
            >
              + Recept
            </NavLink>
            <button
              onClick={() => { logout(); navigate('/') }}
              title={`Uitloggen (${gebruiker?.naam})`}
              className="text-sm px-3 py-1.5 rounded-full text-olive-700/40 hover:text-olive-700 hover:bg-olive-700/8 transition-all btn-magnetic"
            >
              {gebruiker?.naam?.split(' ')[0]} ↩
            </button>
          </>
        ) : (
          <NavLink
            to="/login"
            className={({ isActive }) =>
              `text-sm font-semibold px-3 py-1.5 rounded-full transition-all btn-magnetic ${isActive ? 'bg-olive-700 text-cream' : 'text-olive-700/50 hover:text-olive-700 hover:bg-olive-700/8'}`
            }
          >
            Inloggen
          </NavLink>
        )}
      </nav>
    </header>
  )
}
