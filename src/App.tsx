import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Admin from './pages/Admin';
import Player from './pages/Player';
import Installation from './pages/Installation';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/admin" replace />} />
        <Route path="/admin" element={<Dashboard />} />
        <Route path="/admin/:screenId" element={<Admin />} />
        <Route path="/player" element={<Player />} />
        <Route path="/installation" element={<Installation />} />
      </Routes>
    </BrowserRouter>
  );
}
