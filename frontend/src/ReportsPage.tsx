import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  fetchChildren,
  fetchReport,
  formatEuro,
  type ChildSummary,
  type Report,
  type ReportCategoryTotal,
  type ReportPeriod,
} from "./api";
import { useAuth } from "./AuthContext";

const PERIODS: { id: ReportPeriod; label: string }[] = [
  { id: "month", label: "Este mês" },
  { id: "3months", label: "3 meses" },
  { id: "all", label: "Tudo" },
];

function CategoryBars({
  items,
  total,
  tone,
}: {
  items: ReportCategoryTotal[];
  total: number;
  tone: "income" | "expense";
}) {
  if (items.length === 0) {
    return <p className="muted">Sem movimentos neste período.</p>;
  }

  const max = Math.max(...items.map((i) => i.total), 1);

  return (
    <ul className="report-bars">
      {items.map((item) => {
        const pct = total > 0 ? Math.round((item.total / total) * 100) : 0;
        const width = Math.max(8, Math.round((item.total / max) * 100));
        return (
          <li key={item.categoryId}>
            <div className="report-bar-head">
              <strong>{item.name}</strong>
              <span>
                {formatEuro(item.total)} · {pct}%
              </span>
            </div>
            <div className="report-bar-track">
              <div className={`report-bar-fill ${tone}`} style={{ width: `${width}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function ReportsPage() {
  const { user, logout } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [period, setPeriod] = useState<ReportPeriod>(
    (searchParams.get("period") as ReportPeriod) || "month"
  );
  const [children, setChildren] = useState<ChildSummary[]>([]);
  const [childId, setChildId] = useState<number | "">("");
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.role !== "parent") return;
    void fetchChildren()
      .then((list) => {
        setChildren(list);
        const fromQuery = searchParams.get("userId");
        const initial = fromQuery ? Number(fromQuery) : list[0]?.id;
        if (initial) setChildId(initial);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Erro"));
  }, [user, searchParams]);

  useEffect(() => {
    if (user?.role === "parent" && !childId) return;

    setLoading(true);
    setError("");
    void fetchReport(period, user?.role === "parent" ? Number(childId) : undefined)
      .then(setReport)
      .catch((err) => setError(err instanceof Error ? err.message : "Erro"))
      .finally(() => setLoading(false));
  }, [period, childId, user]);

  function onPeriodChange(next: ReportPeriod) {
    setPeriod(next);
    const params = new URLSearchParams(searchParams);
    params.set("period", next);
    setSearchParams(params);
  }

  function onChildChange(e: FormEvent<HTMLSelectElement>) {
    const id = Number(e.currentTarget.value);
    setChildId(id);
    const params = new URLSearchParams(searchParams);
    params.set("userId", String(id));
    setSearchParams(params);
  }

  return (
    <div className="page reports-page">
      <header className="topbar">
        <div>
          <p className="eyebrow">Relatórios</p>
          <h1>{report?.displayName ?? user?.displayName}</h1>
        </div>
        <div className="topbar-actions">
          <Link to="/" className="btn ghost">
            Voltar
          </Link>
          <button type="button" className="btn ghost" onClick={logout}>
            Sair
          </button>
        </div>
      </header>

      {user?.role === "parent" && children.length > 0 && (
        <label className="inline-select">
          Filha
          <select value={childId} onChange={onChildChange}>
            {children.map((c) => (
              <option key={c.id} value={c.id}>
                {c.displayName}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="period-tabs">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`period-tab ${period === p.id ? "active" : ""}`}
            onClick={() => onPeriodChange(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {error && <p className="error">{error}</p>}
      {loading && <p className="muted">A carregar…</p>}

      {report && !loading && (
        <>
          <section className="report-summary">
            <div className="summary-card income">
              <span>Ganhou</span>
              <strong>{formatEuro(report.incomeTotal)}</strong>
            </div>
            <div className="summary-card expense">
              <span>Gastou</span>
              <strong>{formatEuro(report.expenseTotal)}</strong>
            </div>
            {report.unpaidTotal > 0 && (
              <div className="summary-card unpaid">
                <span>Por pagar</span>
                <strong>{formatEuro(report.unpaidTotal)}</strong>
              </div>
            )}
          </section>

          <section className="history">
            <h2>Onde ganhou</h2>
            <CategoryBars
              items={report.incomeByCategory}
              total={report.incomeTotal}
              tone="income"
            />
          </section>

          <section className="history">
            <h2>Onde gastou</h2>
            <CategoryBars
              items={report.expenseByCategory}
              total={report.expenseTotal}
              tone="expense"
            />
          </section>
        </>
      )}
    </div>
  );
}
