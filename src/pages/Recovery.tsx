import { useState } from "react";
import { toast } from "sonner";
import { db } from "../lib/supabase";
import { Field, Submit, errorMessage } from "../components/ui";
export default function Recovery({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Las contraseñas no coinciden.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await db.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Contraseña actualizada");
      window.location.hash = "/";
      onDone();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="access-error">
      <form className="login-form" onSubmit={(e) => void save(e)}>
        <h2>Elegí tu nueva contraseña</h2>
        <Field label="Nueva contraseña">
          <input
            type="password"
            autoComplete="new-password"
            minLength={12}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <Field label="Confirmar contraseña">
          <input
            type="password"
            autoComplete="new-password"
            minLength={12}
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </Field>
        <Submit busy={busy} label="Actualizar contraseña" />
      </form>
    </div>
  );
}
