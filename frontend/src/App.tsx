import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./AuthContext";
import { ChildHome } from "./ChildHome";
import { LoginPage } from "./LoginPage";
import { ParentDashboard } from "./ParentDashboard";

function Protected() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="page center">
        <p className="muted">A carregar…</p>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "parent") return <ParentDashboard />;
  return <ChildHome />;
}

export default function App() {
  return (
    <AuthProvider>
      <div className="app-shell">
        <Routes>
          <Route path="/login" element={<LoginGate />} />
          <Route path="/*" element={<Protected />} />
        </Routes>
      </div>
    </AuthProvider>
  );
}

function LoginGate() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="page center">
        <p className="muted">A carregar…</p>
      </div>
    );
  }
  if (user) return <Navigate to="/" replace />;
  return <LoginPage />;
}
