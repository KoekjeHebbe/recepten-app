import { Routes, Route } from 'react-router-dom'
import { WeekMenuProvider } from './store/weekmenu'
import Nav from './components/Nav'
import ReceptenLijst from './pages/ReceptenLijst'
import ReceptDetail from './pages/ReceptDetail'
import Weekmenu from './pages/Weekmenu'
import Boodschappen from './pages/Boodschappen'

export default function App() {
  return (
    <WeekMenuProvider>
      <div className="min-h-screen flex flex-col">
        <Nav />
        <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6">
          <Routes>
            <Route path="/" element={<ReceptenLijst />} />
            <Route path="/recept/:id" element={<ReceptDetail />} />
            <Route path="/weekmenu" element={<Weekmenu />} />
            <Route path="/boodschappen" element={<Boodschappen />} />
          </Routes>
        </main>
      </div>
    </WeekMenuProvider>
  )
}
