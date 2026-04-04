import { NavLink } from 'react-router-dom'
import { useWeekMenu } from '../store/weekmenu'
import { DAGEN } from '../types'

export default function Nav() {
  const { menu } = useWeekMenu()
  const totalItems = DAGEN.reduce((sum, dag) => sum + menu[dag].length, 0)

  return (
    <nav className="bg-terracotta-600 text-white shadow-md">
      <div className="max-w-5xl mx-auto px-4 flex items-center justify-between h-14">
        <NavLink to="/" className="font-bold text-lg tracking-tight">
          🍽 Recepten
        </NavLink>
        <div className="flex gap-1 text-sm font-medium items-center">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `px-3 py-1.5 rounded-lg transition-colors ${isActive ? 'bg-white/20' : 'hover:bg-white/10'}`
            }
          >
            Recepten
          </NavLink>
          <NavLink
            to="/weekmenu"
            className={({ isActive }) =>
              `px-3 py-1.5 rounded-lg transition-colors relative ${isActive ? 'bg-white/20' : 'hover:bg-white/10'}`
            }
          >
            Weekmenu
            {totalItems > 0 && (
              <span className="absolute -top-1 -right-1 bg-olive-400 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center">
                {totalItems}
              </span>
            )}
          </NavLink>
          <NavLink
            to="/boodschappen"
            className={({ isActive }) =>
              `px-3 py-1.5 rounded-lg transition-colors ${isActive ? 'bg-white/20' : 'hover:bg-white/10'}`
            }
          >
            Boodschappen
          </NavLink>
          <NavLink
            to="/recept/nieuw"
            className={({ isActive }) =>
              `ml-1 px-3 py-1.5 rounded-lg transition-colors font-bold ${isActive ? 'bg-white/20' : 'hover:bg-white/10'}`
            }
            title="Recept toevoegen"
          >
            +
          </NavLink>
        </div>
      </div>
    </nav>
  )
}
