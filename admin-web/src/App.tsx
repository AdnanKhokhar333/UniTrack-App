import { Navigate, Route, Routes } from "react-router-dom";
import AdminLayout from "./components/AdminLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import BusesPage from "./pages/BusesPage";
import DashboardPage from "./pages/DashboardPage";
import DriversPage from "./pages/DriversPage";
import LoginPage from "./pages/LoginPage";
import RoutesPage from "./pages/RoutesPage";
import SosPage from "./pages/SosPage";
import StudentsPage from "./pages/StudentsPage";

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AdminLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/buses" element={<BusesPage />} />
          <Route path="/drivers" element={<DriversPage />} />
          <Route path="/routes" element={<RoutesPage />} />
          <Route path="/students" element={<StudentsPage />} />
          <Route path="/sos" element={<SosPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
