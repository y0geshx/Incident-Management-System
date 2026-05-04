import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './styles/App.css';
import { DashboardPage } from './pages/DashboardPage';
import { IncidentDetailPage } from './pages/IncidentDetailPage';
import { NewIncidentPage } from './pages/NewIncidentPage';
import { ApiDocsPage } from './pages/ApiDocsPage';
import { MetricsPage } from './pages/MetricsPage';
import { ServiceStatusPage } from './pages/ServiceStatusPage';

function App() {
  return (
    <Router>
      <div className="app">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/incident/new" element={<NewIncidentPage />} />
          <Route path="/incident/:id" element={<IncidentDetailPage />} />
          <Route path="/api-docs" element={<ApiDocsPage />} />
          <Route path="/metrics" element={<MetricsPage />} />
          <Route path="/service-status" element={<ServiceStatusPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
