import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import { db, initSchema } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");

fs.mkdirSync(dataDir, { recursive: true });
initSchema();

const userCount = (db.prepare("SELECT COUNT(*) AS c FROM users").get() as { c: number }).c;
if (userCount > 0) {
  console.log("BD já tem dados — seed ignorado.");
  console.log("Para recriar: apaga backend/data/finance.db e corre npm run seed.");
  process.exit(0);
}

const hash = (password: string) => bcrypt.hashSync(password, 10);

const insertUser = db.prepare(`
  INSERT INTO users (username, password_hash, role, display_name)
  VALUES (?, ?, ?, ?)
`);

insertUser.run("pais", hash("CasaPais"), "parent", "Pais");
insertUser.run("eva", hash("Unicornio"), "child", "Eva");
insertUser.run("beatriz", hash("Borboleta"), "child", "Beatriz");

const insertCategory = db.prepare(`
  INSERT INTO categories (name, type) VALUES (?, ?)
`);

const categories: [string, "income" | "expense"][] = [
  ["Mesada", "income"],
  ["Presente", "income"],
  ["Outro (receita)", "income"],
  ["Brinquedos", "expense"],
  ["Doces", "expense"],
  ["Outro (despesa)", "expense"],
];

for (const [name, type] of categories) {
  insertCategory.run(name, type);
}

console.log("Seed concluído.");
console.log("  pais / CasaPais     (parent)");
console.log("  eva / Unicornio     (filha)");
console.log("  beatriz / Borboleta (filha)");
