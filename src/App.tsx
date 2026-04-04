import { Routes, Route } from 'react-router-dom'
import { WeekMenuProvider } from './store/weekmenu'
import { FavorietenProvider } from './store/favorieten'
import { AangepasteReceptenProvider } from './store/aangepaste-recepten'
import Nav from './components/Nav'
import ReceptenLijst from './pages/ReceptenLijst'
import ReceptDetail from './pages/ReceptDetail'
import ReceptToevoegen from './pages/ReceptToevoegen'
import Weekmenu from './pages/Weekmenu'
import Boodschappen from './pages/Boodschappen'

export default function App() {
  return (
    <AangepasteReceptenProvider>
      <FavorietenProvider>
        <WeekMenuProvider>
          <div className="min-h-screen flex flex-col">
            <Nav />
            <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6">
              <Routes>
                <Route path="/" element={<ReceptenLijst />} />
                <Route path="/recept/nieuw" element={<ReceptToevoegen />} />
                <Route path="/recept/:id" element={<ReceptDetail />} />
                <Route path="/weekmenu" element={<Weekmenu />} />
                <Route path="/boodschappen" element={<Boodschappen />} />
              </Routes>
            </main>
          </div>
        </WeekMenuProvider>
      </FavorietenProvider>
    </AangepasteReceptenProvider>
  )
}
