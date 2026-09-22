import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  clearSession,
  fetchMe,
  getStoredUser,
  getToken,
  login as apiLogin,
  saveSession,
  type User,
} from "./api";

type AuthState = {
  user: User | null;
  balance: number | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  setBalance: (b: number | null) => void;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(getStoredUser());
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setBalance(null);
      setLoading(false);
      return;
    }
    try {
      const data = await fetchMe();
      setUser(data.user);
      setBalance(data.balance);
      saveSession(getToken()!, data.user);
    } catch {
      clearSession();
      setUser(null);
      setBalance(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = async (username: string, password: string) => {
    const data = await apiLogin(username, password);
    saveSession(data.token, data.user);
    setUser(data.user);
    setBalance(data.balance);
  };

  const logout = () => {
    clearSession();
    setUser(null);
    setBalance(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, balance, loading, login, logout, setBalance, refresh }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth fora do AuthProvider");
  return ctx;
}
