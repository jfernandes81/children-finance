import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");
fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, "finance.db");

export const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

const DEFAULT_CATEGORIES: [string, "income" | "expense"][] = [
  ["Mesada", "income"],
  ["Presente", "income"],
  ["Outro (receita)", "income"],
  ["Brinquedos", "expense"],
  ["Doces", "expense"],
  ["Material escolar", "expense"],
  ["Refeições", "expense"],
  ["Livros", "expense"],
  ["Outro (despesa)", "expense"],
];

export function ensureCategories() {
  const insert = db.prepare(`
    INSERT INTO categories (name, type)
    SELECT ?, ?
    WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = ? AND type = ?)
  `);
  for (const [name, type] of DEFAULT_CATEGORIES) {
    insert.run(name, type, name, type);
  }
}

export function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('child', 'parent')),
      display_name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('income', 'expense'))
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      category_id INTEGER NOT NULL REFERENCES categories(id),
      amount REAL NOT NULL CHECK(amount > 0),
      note TEXT,
      payment_status TEXT NOT NULL DEFAULT 'paid' CHECK(payment_status IN ('paid', 'unpaid')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_by INTEGER NOT NULL REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions(created_at DESC);
  `);

  // Migração para BDs antigas sem payment_status
  const cols = db.pragma("table_info(transactions)") as { name: string }[];
  if (!cols.some((c) => c.name === "payment_status")) {
    db.exec(
      `ALTER TABLE transactions ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'paid'`
    );
  }

  ensureCategories();
}

export function getBalance(userId: number): number {
  const row = db
    .prepare(
      `
      SELECT COALESCE(SUM(
        CASE WHEN c.type = 'income' THEN t.amount ELSE -t.amount END
      ), 0) AS balance
      FROM transactions t
      JOIN categories c ON c.id = t.category_id
      WHERE t.user_id = ? AND t.payment_status = 'paid'
    `
    )
    .get(userId) as { balance: number };

  return Math.round(row.balance * 100) / 100;
}

export function getUnpaidTotal(userId: number): number {
  const row = db
    .prepare(
      `
      SELECT COALESCE(SUM(t.amount), 0) AS total
      FROM transactions t
      JOIN categories c ON c.id = t.category_id
      WHERE t.user_id = ? AND t.payment_status = 'unpaid' AND c.type = 'expense'
    `
    )
    .get(userId) as { total: number };

  return Math.round(row.total * 100) / 100;
}

export type ReportPeriod = "month" | "3months" | "all";

export function getPeriodStart(period: ReportPeriod): string | null {
  if (period === "month") {
    return (db.prepare(`SELECT datetime('now', 'start of month') AS d`).get() as { d: string }).d;
  }
  if (period === "3months") {
    return (db.prepare(`SELECT datetime('now', '-3 months') AS d`).get() as { d: string }).d;
  }
  return null;
}

export function getReport(userId: number, period: ReportPeriod) {
  const from = getPeriodStart(period);
  const dateFilter = from ? "AND t.created_at >= ?" : "";
  const params = from ? [userId, from] : [userId];

  const byCategory = db
    .prepare(
      `
      SELECT c.id AS categoryId, c.name AS name, c.type AS type,
             COALESCE(SUM(t.amount), 0) AS total
      FROM transactions t
      JOIN categories c ON c.id = t.category_id
      WHERE t.user_id = ? AND t.payment_status = 'paid' ${dateFilter}
      GROUP BY c.id, c.name, c.type
      ORDER BY total DESC
    `
    )
    .all(...params) as {
    categoryId: number;
    name: string;
    type: "income" | "expense";
    total: number;
  }[];

  const incomeByCategory = byCategory
    .filter((r) => r.type === "income")
    .map((r) => ({ categoryId: r.categoryId, name: r.name, total: Math.round(r.total * 100) / 100 }));
  const expenseByCategory = byCategory
    .filter((r) => r.type === "expense")
    .map((r) => ({ categoryId: r.categoryId, name: r.name, total: Math.round(r.total * 100) / 100 }));

  const incomeTotal = incomeByCategory.reduce((s, r) => s + r.total, 0);
  const expenseTotal = expenseByCategory.reduce((s, r) => s + r.total, 0);

  const unpaidParams = from ? [userId, from] : [userId];
  const unpaidRow = db
    .prepare(
      `
      SELECT COALESCE(SUM(t.amount), 0) AS total
      FROM transactions t
      JOIN categories c ON c.id = t.category_id
      WHERE t.user_id = ? AND t.payment_status = 'unpaid' AND c.type = 'expense' ${dateFilter}
    `
    )
    .get(...unpaidParams) as { total: number };

  return {
    period,
    from,
    incomeTotal: Math.round(incomeTotal * 100) / 100,
    expenseTotal: Math.round(expenseTotal * 100) / 100,
    unpaidTotal: Math.round(unpaidRow.total * 100) / 100,
    incomeByCategory,
    expenseByCategory,
  };
}
