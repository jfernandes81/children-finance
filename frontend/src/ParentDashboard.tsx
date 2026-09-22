import { useEffect, useState, type FormEvent } from "react";
import {
  childAccent,
  deleteTransaction,
  fetchCategories,
  fetchChildren,
  fetchTransactions,
  formatDate,
  formatEuro,
  updateTransaction,
  type Category,
  type ChildSummary,
  type Transaction,
} from "./api";
import { useAuth } from "./AuthContext";
import { ChangePasswordPanel } from "./ChangePasswordPanel";

type Mode = "income" | "expense" | null;

export function ParentDashboard() {
  const { user, logout } = useAuth();
  const [children, setChildren] = useState<ChildSummary[]>([]);
  const [filterId, setFilterId] = useState<number | "all">("all");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<Mode>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [targetChildId, setTargetChildId] = useState<number | "">("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState("");

  async function loadChildren() {
    const list = await fetchChildren();
    setChildren(list);
    if (!targetChildId && list[0]) {
      setTargetChildId(list[0].id);
    }
  }

  async function loadHistory() {
    const id = filterId === "all" ? undefined : filterId;
    setTransactions(await fetchTransactions(id));
  }

  function resetForm() {
    setMode(null);
    setEditingId(null);
    setAmount("");
    setNote("");
  }

  useEffect(() => {
    void loadChildren().catch((err) =>
      setError(err instanceof Error ? err.message : "Erro")
    );
  }, []);

  useEffect(() => {
    void loadHistory().catch((err) =>
      setError(err instanceof Error ? err.message : "Erro")
    );
  }, [filterId]);

  useEffect(() => {
    if (!mode) return;
    void fetchCategories(mode)
      .then((cats) => {
        setCategories(cats);
        setCategoryId((current) => {
          if (current && cats.some((c) => c.id === current)) return current;
          return cats[0]?.id ?? "";
        });
      })
      .catch(() => setError("Não foi possível carregar categorias"));
  }, [mode]);

  async function startEdit(t: Transaction) {
    setError("");
    setEditingId(t.id);
    setMode(t.categoryType);
    setTargetChildId(t.userId);
    setCategoryId(t.categoryId);
    setAmount(String(t.amount).replace(".", ","));
    setNote(t.note ?? "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!editingId || !categoryId || !amount || !targetChildId) return;
    setBusy(true);
    setError("");
    try {
      await updateTransaction(editingId, {
        categoryId: Number(categoryId),
        amount: Number(amount.replace(",", ".")),
        note: note.trim() || undefined,
        userId: Number(targetChildId),
      });
      setFlash("Movimento atualizado!");
      resetForm();
      await loadChildren();
      await loadHistory();
      setTimeout(() => setFlash(""), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao guardar");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(t: Transaction) {
    const ok = window.confirm(
      `Apagar este movimento de ${t.displayName} (${formatEuro(t.amount)})?`
    );
    if (!ok) return;

    setBusy(true);
    setError("");
    try {
      await deleteTransaction(t.id);
      if (editingId === t.id) resetForm();
      setFlash("Movimento apagado!");
      await loadChildren();
      await loadHistory();
      setTimeout(() => setFlash(""), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao apagar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page parent-page">
      <header className="topbar">
        <div>
          <p className="eyebrow">Vista dos pais</p>
          <h1>{user?.displayName}</h1>
        </div>
        <button type="button" className="btn ghost" onClick={logout}>
          Sair
        </button>
      </header>

      {error && <p className="error">{error}</p>}
      {flash && <p className="flash-banner">{flash}</p>}

      <p className="muted parent-hint">As filhas adicionam movimentos. Aqui podes editar ou apagar.</p>

      <ChangePasswordPanel />

      <section className="children-grid">
        {children.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`child-card ${filterId === c.id ? "active" : ""}`}
            style={{ ["--child-accent" as string]: childAccent(c.displayName) }}
            onClick={() => {
              setFilterId(filterId === c.id ? "all" : c.id);
              setTargetChildId(c.id);
            }}
          >
            <span className="child-name">{c.displayName}</span>
            <span className="child-balance">{formatEuro(c.balance)}</span>
            <span className="hint">{filterId === c.id ? "A filtrar" : "Ver movimentos"}</span>
          </button>
        ))}
      </section>

      {editingId && mode && (
        <form className="card-form" onSubmit={onSubmit}>
          <div className="form-head">
            <h2>Editar movimento</h2>
            <button type="button" className="btn ghost" onClick={resetForm}>
              Cancelar
            </button>
          </div>
          <label>
            Filha
            <select
              value={targetChildId}
              onChange={(e) => setTargetChildId(Number(e.target.value))}
              required
            >
              {children.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.displayName}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tipo
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as "income" | "expense")}
            >
              <option value="income">Receita</option>
              <option value="expense">Despesa</option>
            </select>
          </label>
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
          <button
            type="submit"
            className={`btn ${mode === "income" ? "income" : "expense"}`}
            disabled={busy}
          >
            {busy ? "A guardar…" : "Guardar alterações"}
          </button>
        </form>
      )}

      <section className="history">
        <div className="form-head">
          <h2>Histórico</h2>
          {filterId !== "all" && (
            <button type="button" className="btn ghost" onClick={() => setFilterId("all")}>
              Ver todas
            </button>
          )}
        </div>
        {transactions.length === 0 ? (
          <p className="muted">Sem movimentos.</p>
        ) : (
          <ul className="tx-list">
            {transactions.map((t) => (
              <li key={t.id} className="tx-item">
                <div className="tx-main">
                  <div>
                    <strong>
                      {t.displayName} · {t.categoryName}
                    </strong>
                    <span>{formatDate(t.createdAt)}</span>
                    {t.note && <em>{t.note}</em>}
                  </div>
                  <span className={t.categoryType === "income" ? "pos" : "neg"}>
                    {t.categoryType === "income" ? "+" : "−"}
                    {formatEuro(t.amount)}
                  </span>
                </div>
                <div className="tx-actions">
                  <button type="button" className="btn link" onClick={() => void startEdit(t)}>
                    Editar
                  </button>
                  <button
                    type="button"
                    className="btn link danger"
                    disabled={busy}
                    onClick={() => void onDelete(t)}
                  >
                    Apagar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
