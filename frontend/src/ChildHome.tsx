import { useEffect, useState, type FormEvent } from "react";
import {
  childAccent,
  createTransaction,
  fetchCategories,
  fetchTransactions,
  formatDate,
  formatEuro,
  type Category,
  type Transaction,
} from "./api";
import { useAuth } from "./AuthContext";
import { ChangePasswordPanel } from "./ChangePasswordPanel";

type Mode = "income" | "expense" | null;

export function ChildHome() {
  const { user, balance, logout, setBalance } = useAuth();
  const [mode, setMode] = useState<Mode>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState("");

  async function loadHistory() {
    setTransactions(await fetchTransactions());
  }

  useEffect(() => {
    void loadHistory().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!mode) return;
    void fetchCategories(mode)
      .then((cats) => {
        setCategories(cats);
        setCategoryId(cats[0]?.id ?? "");
      })
      .catch(() => setError("Não foi possível carregar categorias"));
  }, [mode]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!categoryId || !amount) return;
    setBusy(true);
    setError("");
    try {
      const result = await createTransaction({
        categoryId: Number(categoryId),
        amount: Number(amount.replace(",", ".")),
        note: note.trim() || undefined,
      });
      setBalance(result.balance);
      setFlash(mode === "income" ? "Recebido!" : "Gasto registado!");
      setMode(null);
      setAmount("");
      setNote("");
      await loadHistory();
      setTimeout(() => setFlash(""), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao guardar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page child-page">
      <header className="topbar">
        <div>
          <p className="eyebrow">Olá</p>
          <h1>{user?.displayName}</h1>
        </div>
        <button type="button" className="btn ghost" onClick={logout}>
          Sair
        </button>
      </header>

      <section
        className="balance-hero"
        style={{ ["--child-accent" as string]: childAccent(user?.displayName ?? "") }}
      >
        <p>O teu saldo</p>
        <p className="balance-value">{formatEuro(balance ?? 0)}</p>
        {flash && <p className="flash">{flash}</p>}
        <p className="read-only-hint">Podes adicionar. Só os pais podem editar ou apagar.</p>
      </section>

      {!mode ? (
        <div className="action-row">
          <button type="button" className="btn income" onClick={() => setMode("income")}>
            Recebi
          </button>
          <button type="button" className="btn expense" onClick={() => setMode("expense")}>
            Gastei
          </button>
        </div>
      ) : (
        <form className="card-form" onSubmit={onSubmit}>
          <div className="form-head">
            <h2>{mode === "income" ? "Recebi dinheiro" : "Gastei dinheiro"}</h2>
            <button type="button" className="btn ghost" onClick={() => setMode(null)}>
              Cancelar
            </button>
          </div>
          <label>
            Valor (€)
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
              required
            />
          </label>
          <label>
            Categoria
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(Number(e.target.value))}
              required
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Nota (opcional)
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="ex.: gelado" />
          </label>
          {error && <p className="error">{error}</p>}
          <button
            type="submit"
            className={`btn ${mode === "income" ? "income" : "expense"}`}
            disabled={busy}
          >
            {busy ? "A guardar…" : "Guardar"}
          </button>
        </form>
      )}

      <ChangePasswordPanel />

      <section className="history">
        <h2>Histórico</h2>
        {transactions.length === 0 ? (
          <p className="muted">Ainda sem movimentos.</p>
        ) : (
          <ul className="tx-list">
            {transactions.map((t) => (
              <li key={t.id}>
                <div>
                  <strong>{t.categoryName}</strong>
                  <span>{formatDate(t.createdAt)}</span>
                  {t.note && <em>{t.note}</em>}
                </div>
                <span className={t.categoryType === "income" ? "pos" : "neg"}>
                  {t.categoryType === "income" ? "+" : "−"}
                  {formatEuro(t.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
