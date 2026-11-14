import { Navigate, Route, Routes } from "react-router-dom";
import AdminLayout from "./components/AdminLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import BusesPage from "./pages/BusesPage";
import ComplaintsPage from "./pages/ComplaintsPage";
import DashboardPage from "./pages/DashboardPage";
import DriversPage from "./pages/DriversPage";
import LiveMapPage from "./pages/LiveMapPage";
import LoginPage from "./pages/LoginPage";
import MaintenancePage from "./pages/MaintenancePage";
import RatingsPage from "./pages/RatingsPage";
import RoutesPage from "./pages/RoutesPage";
import SosPage from "./pages/SosPage";
import SpeedingPage from "./pages/SpeedingPage";
import StudentsPage from "./pages/StudentsPage";

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AdminLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/live-map" element={<LiveMapPage />} />
          <Route path="/buses" element={<BusesPage />} />
          <Route path="/drivers" element={<DriversPage />} />
          <Route path="/routes" element={<RoutesPage />} />
          <Route path="/students" element={<StudentsPage />} />
          <Route path="/ratings" element={<RatingsPage />} />
          <Route path="/complaints" element={<ComplaintsPage />} />
          <Route path="/speeding" element={<SpeedingPage />} />
          <Route path="/sos" element={<SosPage />} />
          <Route path="/maintenance" element={<MaintenancePage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
