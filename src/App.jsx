import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Home   from './pages/Home.jsx'
import Quiz   from './pages/Quiz.jsx'
import Result from './pages/Result.jsx'
import Admin  from './pages/Admin.jsx'
import Flagged from './pages/Flagged.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index        element={<Home />}   />
          <Route path="quiz"  element={<Quiz />}   />
          <Route path="result" element={<Result />} />
          <Route path="admin" element={<Admin />}  />
          <Route path="flagged" element={<Flagged />}  />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
