import { useState, type FormEvent } from "react";
import { createCategory, type Category } from "./api";

type Props = {
  type: "income" | "expense";
  onCreated: (category: Category) => void;
};

export function CategoryCreator({ type, onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError("");
    try {
      const created = await createCategory(name.trim(), type);
      onCreated(created);
      setName("");
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="btn link create-cat" onClick={() => setOpen(true)}>
        + Nova categoria
      </button>
    );
  }

  return (
    <form className="category-create" onSubmit={onSubmit}>
      <label>
        Nova categoria
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="ex.: Cinema"
          maxLength={40}
          autoFocus
          required
        />
      </label>
      {error && <p className="error">{error}</p>}
      <div className="tx-actions">
        <button
          type="button"
          className="btn link"
          onClick={() => {
            setOpen(false);
            setError("");
            setName("");
          }}
          disabled={busy}
        >
          Cancelar
        </button>
        <button type="submit" className="btn link" disabled={busy}>
          {busy ? "A guardar…" : "Criar"}
        </button>
      </div>
    </form>
  );
}
