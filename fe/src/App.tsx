import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Jobs from './pages/Jobs'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/jobs" replace />} />
        <Route path="/jobs" element={<Jobs />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
