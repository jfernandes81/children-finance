import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { db, initSchema, getBalance } from "./db.js";
import { AuthedRequest, requireAuth, requireParent, signToken } from "./auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
fs.mkdirSync(path.join(__dirname, "..", "data"), { recursive: true });
initSchema();

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(cors());
app.use(express.json());

app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) {
    return res.status(400).json({ error: "Utilizador e palavra-passe são obrigatórios" });
  }

  const user = db
    .prepare(
      "SELECT id, username, password_hash, role, display_name FROM users WHERE username = ?"
    )
    .get(username.trim().toLowerCase()) as
    | {
        id: number;
        username: string;
        password_hash: string;
        role: "child" | "parent";
        display_name: string;
      }
    | undefined;

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: "Utilizador ou palavra-passe incorretos" });
  }

  const payload = {
    id: user.id,
    username: user.username,
    role: user.role,
    displayName: user.display_name,
  };

  res.json({
    token: signToken(payload),
    user: payload,
    balance: user.role === "child" ? getBalance(user.id) : null,
  });
});

app.get("/api/me", requireAuth, (req: AuthedRequest, res) => {
  const user = req.user!;
  res.json({
    user,
    balance: user.role === "child" ? getBalance(user.id) : null,
  });
});

app.post("/api/auth/change-password", requireAuth, (req: AuthedRequest, res) => {
  const { currentPassword, newPassword } = req.body as {
    currentPassword?: string;
    newPassword?: string;
  };

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Indica a palavra-passe atual e a nova" });
  }

  if (newPassword.length < 4) {
    return res.status(400).json({ error: "A nova palavra-passe deve ter pelo menos 4 caracteres" });
  }

  const row = db
    .prepare("SELECT password_hash FROM users WHERE id = ?")
    .get(req.user!.id) as { password_hash: string } | undefined;

  if (!row || !bcrypt.compareSync(currentPassword, row.password_hash)) {
    return res.status(401).json({ error: "Palavra-passe atual incorreta" });
  }

  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(
    bcrypt.hashSync(newPassword, 10),
    req.user!.id
  );

  res.json({ ok: true });
});

app.get("/api/children", requireAuth, requireParent, (_req, res) => {
  const children = db
    .prepare("SELECT id, username, display_name FROM users WHERE role = 'child' ORDER BY display_name")
    .all() as { id: number; username: string; display_name: string }[];

  res.json(
    children.map((c) => ({
      id: c.id,
      username: c.username,
      displayName: c.display_name,
      balance: getBalance(c.id),
    }))
  );
});

app.get("/api/categories", requireAuth, (req, res) => {
  const type = req.query.type as string | undefined;
  let rows;
  if (type === "income" || type === "expense") {
    rows = db
      .prepare("SELECT id, name, type FROM categories WHERE type = ? ORDER BY name")
      .all(type);
  } else {
    rows = db.prepare("SELECT id, name, type FROM categories ORDER BY type, name").all();
  }
  res.json(rows);
});

app.get("/api/transactions", requireAuth, (req: AuthedRequest, res) => {
  const user = req.user!;
  const requestedUserId = req.query.userId ? Number(req.query.userId) : undefined;

  let targetUserId: number;
  if (user.role === "child") {
    targetUserId = user.id;
  } else if (requestedUserId) {
    targetUserId = requestedUserId;
  } else {
    // parent sem filtro: todas as filhas
    const rows = db
      .prepare(
        `
        SELECT t.id, t.user_id AS userId, u.display_name AS displayName,
               t.amount, t.note, t.created_at AS createdAt,
               c.id AS categoryId, c.name AS categoryName, c.type AS categoryType
        FROM transactions t
        JOIN users u ON u.id = t.user_id
        JOIN categories c ON c.id = t.category_id
        WHERE u.role = 'child'
        ORDER BY t.created_at DESC
        LIMIT 100
      `
      )
      .all();
    return res.json(rows);
  }

  const rows = db
    .prepare(
      `
      SELECT t.id, t.user_id AS userId, u.display_name AS displayName,
             t.amount, t.note, t.created_at AS createdAt,
             c.id AS categoryId, c.name AS categoryName, c.type AS categoryType
      FROM transactions t
      JOIN users u ON u.id = t.user_id
      JOIN categories c ON c.id = t.category_id
      WHERE t.user_id = ?
      ORDER BY t.created_at DESC
      LIMIT 100
    `
    )
    .all(targetUserId);

  res.json(rows);
});

app.post("/api/transactions", requireAuth, (req: AuthedRequest, res) => {
  const user = req.user!;

  if (user.role !== "child") {
    return res.status(403).json({
      error: "Só as filhas podem adicionar movimentos. Os pais podem editar ou apagar.",
    });
  }

  const { categoryId, amount, note } = req.body as {
    categoryId?: number;
    amount?: number;
    note?: string;
  };

  if (!categoryId || amount == null || Number(amount) <= 0) {
    return res.status(400).json({ error: "Categoria e valor positivo são obrigatórios" });
  }

  const category = db
    .prepare("SELECT id, type FROM categories WHERE id = ?")
    .get(categoryId) as { id: number; type: string } | undefined;
  if (!category) {
    return res.status(400).json({ error: "Categoria inválida" });
  }

  const targetUserId = user.id;

  const result = db
    .prepare(
      `
      INSERT INTO transactions (user_id, category_id, amount, note, created_by)
      VALUES (?, ?, ?, ?, ?)
    `
    )
    .run(targetUserId, categoryId, Number(amount), note?.trim() || null, user.id);

  const created = db
    .prepare(
      `
      SELECT t.id, t.user_id AS userId, u.display_name AS displayName,
             t.amount, t.note, t.created_at AS createdAt,
             c.id AS categoryId, c.name AS categoryName, c.type AS categoryType
      FROM transactions t
      JOIN users u ON u.id = t.user_id
      JOIN categories c ON c.id = t.category_id
      WHERE t.id = ?
    `
    )
    .get(result.lastInsertRowid);

  res.status(201).json({
    transaction: created,
    balance: getBalance(targetUserId),
  });
});

app.patch("/api/transactions/:id", requireAuth, requireParent, (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const { categoryId, amount, note, userId } = req.body as {
    categoryId?: number;
    amount?: number;
    note?: string;
    userId?: number;
  };

  const existing = db
    .prepare("SELECT id, user_id FROM transactions WHERE id = ?")
    .get(id) as { id: number; user_id: number } | undefined;
  if (!existing) {
    return res.status(404).json({ error: "Movimento não encontrado" });
  }

  if (!categoryId || amount == null || Number(amount) <= 0) {
    return res.status(400).json({ error: "Categoria e valor positivo são obrigatórios" });
  }

  if (!userId) {
    return res.status(400).json({ error: "Indica a filha (userId)" });
  }

  const category = db
    .prepare("SELECT id FROM categories WHERE id = ?")
    .get(categoryId);
  if (!category) {
    return res.status(400).json({ error: "Categoria inválida" });
  }

  const child = db
    .prepare("SELECT id FROM users WHERE id = ? AND role = 'child'")
    .get(userId);
  if (!child) {
    return res.status(400).json({ error: "Filha inválida" });
  }

  const previousUserId = existing.user_id;

  db.prepare(
    `
    UPDATE transactions
    SET user_id = ?, category_id = ?, amount = ?, note = ?
    WHERE id = ?
  `
  ).run(userId, categoryId, Number(amount), note?.trim() || null, id);

  const updated = db
    .prepare(
      `
      SELECT t.id, t.user_id AS userId, u.display_name AS displayName,
             t.amount, t.note, t.created_at AS createdAt,
             c.id AS categoryId, c.name AS categoryName, c.type AS categoryType
      FROM transactions t
      JOIN users u ON u.id = t.user_id
      JOIN categories c ON c.id = t.category_id
      WHERE t.id = ?
    `
    )
    .get(id);

  res.json({
    transaction: updated,
    balance: getBalance(userId),
    previousBalance: previousUserId !== userId ? getBalance(previousUserId) : undefined,
  });
});

app.delete("/api/transactions/:id", requireAuth, requireParent, (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const existing = db
    .prepare("SELECT id, user_id FROM transactions WHERE id = ?")
    .get(id) as { id: number; user_id: number } | undefined;

  if (!existing) {
    return res.status(404).json({ error: "Movimento não encontrado" });
  }

  db.prepare("DELETE FROM transactions WHERE id = ?").run(id);

  res.json({
    ok: true,
    balance: getBalance(existing.user_id),
  });
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`API a correr em http://localhost:${PORT}`);
});
