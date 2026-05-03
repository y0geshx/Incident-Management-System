import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './styles/App.css';
import { DashboardPage } from './pages/DashboardPage';
import { IncidentDetailPage } from './pages/IncidentDetailPage';

function App() {
  return (
    <Router>
      <div className="app">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/incident/:id" element={<IncidentDetailPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
