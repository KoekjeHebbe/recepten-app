import { Routes, Route, Navigate, useLocation, Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { AuthProvider, useAuth } from './store/auth'
import { WeekMenuProvider } from './store/weekmenu'
import { FavorietenProvider } from './store/favorieten'
import { AangepasteReceptenProvider } from './store/aangepaste-recepten'
import Nav from './components/Nav'
import ErrorBoundary from './components/ErrorBoundary'
import ReceptenLijst from './pages/ReceptenLijst'
import ReceptDetail from './pages/ReceptDetail'
import ReceptToevoegen from './pages/ReceptToevoegen'
import Weekmenu from './pages/Weekmenu'
import Boodschappen from './pages/Boodschappen'
import Login from './pages/Login'
import Extras from './pages/Extras'

function Splash() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-olive-700/15 border-t-terracotta-600 animate-spin" />
    </div>
  )
}

function NietGevonden() {
  return (
    <div className="text-center py-20">
      <p className="text-4xl mb-4">🍽</p>
      <p className="text-olive-700/60 mb-4 text-sm">Deze pagina bestaat niet.</p>
      <Link to="/" className="text-terracotta-600 underline underline-offset-2 text-sm font-medium">Naar overzicht</Link>
    </div>
  )
}

// Wacht tot de auth-status bekend is voordat we beslissen om te redirecten,
// zo geen flikkering of voortijdige redirect naar /login bij een refresh.
function RequireAuth({ children }: { children: ReactNode }) {
  const { isIngelogd, laden } = useAuth()
  const location = useLocation()
  if (laden) return <Splash />
  if (!isIngelogd) return <Navigate to="/login" replace state={{ from: location }} />
  return <>{children}</>
}

function Shell() {
  const { laden } = useAuth()
  if (laden) return <Splash />

  return (
    <div className="min-h-screen">
      <Nav />
      <main className="max-w-5xl mx-auto w-full px-4 pt-20 sm:pt-28 pb-28 sm:pb-16">
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<ReceptenLijst />} />
            <Route path="/login" element={<Login />} />
            <Route path="/recept/nieuw" element={<ReceptToevoegen />} />
            <Route path="/recept/:id/bewerken" element={<ReceptToevoegen />} />
            <Route path="/recept/:id" element={<ReceptDetail />} />
            <Route path="/weekmenu" element={<Weekmenu />} />
            <Route path="/boodschappen" element={<Boodschappen />} />
            <Route path="/extras" element={<RequireAuth><Extras /></RequireAuth>} />
            <Route path="*" element={<NietGevonden />} />
          </Routes>
        </ErrorBoundary>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AangepasteReceptenProvider>
        <FavorietenProvider>
          <WeekMenuProvider>
            <Shell />
          </WeekMenuProvider>
        </FavorietenProvider>
      </AangepasteReceptenProvider>
    </AuthProvider>
  )
}
