import { useState } from "react";
import { useApp } from "../state";
import { rpc } from "../lib/supabase";
import { Field, Submit, errorMessage } from "./ui";

export default function PseudonymForm({
  onDone,
  onCancel,
}: {
  onDone?: () => void;
  onCancel?: () => void;
}) {
  const { profile, reload } = useApp();
  const [name, setName] = useState(profile?.pseudonym || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await rpc("save_pseudonym", { p_pseudonym: name });
      await reload();
      onDone?.();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="auth-form" onSubmit={(e) => void save(e)}>
      <Field
        label="Pseudónimo"
        hint="Entre 3 y 24 caracteres. Por ejemplo: MONACO, TOKYO o MOSCU."
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value.toUpperCase())}
          placeholder="MONACO"
          minLength={3}
          maxLength={24}
          required
          autoFocus
          autoComplete="nickname"
          spellCheck={false}
        />
      </Field>
      {error && (
        <div className="inline-error" role="alert">
          {error}
        </div>
      )}
      <Submit
        busy={busy}
        label={profile?.pseudonym ? "Guardar pseudónimo" : "Continuar"}
      />
      {onCancel && (
        <button
          className="text-link"
          type="button"
          disabled={busy}
          onClick={onCancel}
        >
          Cancelar
        </button>
      )}
    </form>
  );
}
