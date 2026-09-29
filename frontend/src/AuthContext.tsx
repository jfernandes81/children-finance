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
  unpaidTotal: number | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  setBalance: (b: number | null) => void;
  setUnpaidTotal: (v: number | null) => void;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(getStoredUser());
  const [balance, setBalance] = useState<number | null>(null);
  const [unpaidTotal, setUnpaidTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setBalance(null);
      setUnpaidTotal(null);
      setLoading(false);
      return;
    }
    try {
      const data = await fetchMe();
      setUser(data.user);
      setBalance(data.balance);
      setUnpaidTotal(data.unpaidTotal);
      saveSession(getToken()!, data.user);
    } catch {
      clearSession();
      setUser(null);
      setBalance(null);
      setUnpaidTotal(null);
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
    setUnpaidTotal(data.unpaidTotal);
  };

  const logout = () => {
    clearSession();
    setUser(null);
    setBalance(null);
    setUnpaidTotal(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        balance,
        unpaidTotal,
        loading,
        login,
        logout,
        setBalance,
        setUnpaidTotal,
        refresh,
      }}
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
