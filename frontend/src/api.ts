export type Role = "child" | "parent";

export type User = {
  id: number;
  username: string;
  role: Role;
  displayName: string;
};

export type Category = {
  id: number;
  name: string;
  type: "income" | "expense";
};

export type Transaction = {
  id: number;
  userId: number;
  displayName: string;
  amount: number;
  note: string | null;
  createdAt: string;
  categoryId: number;
  categoryName: string;
  categoryType: "income" | "expense";
};

export type ChildSummary = {
  id: number;
  username: string;
  displayName: string;
  balance: number;
};

const TOKEN_KEY = "cf_token";
const USER_KEY = "cf_user";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): User | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function saveSession(token: string, user: User) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || "Erro de rede");
  }
  return data as T;
}

export function login(username: string, password: string) {
  return api<{ token: string; user: User; balance: number | null }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export function changePassword(currentPassword: string, newPassword: string) {
  return api<{ ok: boolean }>("/api/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export function fetchMe() {
  return api<{ user: User; balance: number | null }>("/api/me");
}

export function fetchChildren() {
  return api<ChildSummary[]>("/api/children");
}

export function fetchCategories(type?: "income" | "expense") {
  const q = type ? `?type=${type}` : "";
  return api<Category[]>(`/api/categories${q}`);
}

export function fetchTransactions(userId?: number) {
  const q = userId != null ? `?userId=${userId}` : "";
  return api<Transaction[]>(`/api/transactions${q}`);
}

export function createTransaction(body: {
  categoryId: number;
  amount: number;
  note?: string;
  userId?: number;
}) {
  return api<{ transaction: Transaction; balance: number }>("/api/transactions", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateTransaction(
  id: number,
  body: { categoryId: number; amount: number; note?: string; userId: number }
) {
  return api<{ transaction: Transaction; balance: number }>(`/api/transactions/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deleteTransaction(id: number) {
  return api<{ ok: boolean; balance: number }>(`/api/transactions/${id}`, {
    method: "DELETE",
  });
}

export function formatEuro(value: number): string {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

export function formatDate(iso: string): string {
  const d = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z");
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function childAccent(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("eva")) return "var(--accent-eva)";
  if (n.includes("beatriz")) return "var(--accent-beatriz)";
  return "var(--accent)";
}
