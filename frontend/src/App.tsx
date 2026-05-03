import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './styles/App.css';
import { DashboardPage } from './pages/DashboardPage';
import { IncidentDetailPage } from './pages/IncidentDetailPage';
import { ApiDocsPage } from './pages/ApiDocsPage';

function App() {
  return (
    <Router>
      <div className="app">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/incident/:id" element={<IncidentDetailPage />} />
          <Route path="/api-docs" element={<ApiDocsPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
