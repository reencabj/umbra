import { useState } from "react";
import { toast } from "sonner";
import { db } from "../lib/supabase";
import { Field, Submit, errorMessage } from "../components/ui";
import AuthLayout from "../components/AuthLayout";
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
    <AuthLayout
      title="Elegí tu nueva contraseña"
      description="Usá al menos 12 caracteres para proteger tu cuenta."
    >
      <form className="auth-form" onSubmit={(e) => void save(e)}>
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
    </AuthLayout>
  );
}
