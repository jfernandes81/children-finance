import { useState, type FormEvent } from "react";
import { changePassword } from "./api";

export function ChangePasswordPanel() {
  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  function reset() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError("");
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (newPassword !== confirmPassword) {
      setError("A confirmação não coincide com a nova palavra-passe");
      return;
    }

    setBusy(true);
    try {
      await changePassword(currentPassword, newPassword);
      reset();
      setOpen(false);
      setSuccess("Palavra-passe atualizada!");
      setTimeout(() => setSuccess(""), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao alterar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="password-section">
      {success && <p className="flash-banner">{success}</p>}
      {!open ? (
        <button type="button" className="btn ghost full" onClick={() => setOpen(true)}>
          Alterar palavra-passe
        </button>
      ) : (
        <form className="card-form" onSubmit={onSubmit}>
          <div className="form-head">
            <h2>Nova palavra-passe</h2>
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                setOpen(false);
                reset();
              }}
            >
              Cancelar
            </button>
          </div>
          <label>
            Atual
            <input
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </label>
          <label>
            Nova
            <input
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={4}
              required
            />
          </label>
          <label>
            Confirmar nova
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={4}
              required
            />
          </label>
          {error && <p className="error">{error}</p>}
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? "A guardar…" : "Guardar palavra-passe"}
          </button>
        </form>
      )}
    </section>
  );
}
