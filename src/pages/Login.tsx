import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { db, configured } from "../lib/supabase";
import { errorMessage, Field } from "../components/ui";
import Logo from "../components/Logo";
export default function Login() {
  const [mode, setMode] = useState<"login" | "signup" | "recover">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "recover") {
        const { error } = await db.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + import.meta.env.BASE_URL,
        });
        if (error) throw error;
        toast.success(
          "Si la cuenta existe, recibirás un enlace para recuperar el acceso.",
        );
      } else if (mode === "signup") {
        const { error } = await db.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin + import.meta.env.BASE_URL,
          },
        });
        if (error) throw error;
        toast.success(
          "Revisá tu correo para confirmar la cuenta antes de ingresar.",
        );
        setMode("login");
      } else {
        const { error } = await db.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="login-page">
      <div className="login-brand">
        <Logo className="auth-logo" />
      </div>
      <div className="login-form-wrap">
        <form className="login-form" onSubmit={(e) => void submit(e)}>
          <h2>
            {mode === "signup"
              ? "Activar mi cuenta"
              : mode === "recover"
                ? "Recuperar acceso"
                : "Bienvenido de nuevo"}
          </h2>
          <p>
            {mode === "signup"
              ? "Usá un correo autorizado por el administrador."
              : mode === "recover"
                ? "Te enviaremos un enlace de recuperación."
                : "Ingresá para administrar tus operaciones."}
          </p>
          {!configured && (
            <div className="inline-error">
              Falta conectar el proyecto de Supabase. Configurá las variables
              públicas y volvé a compilar.
            </div>
          )}
          <Field label="Correo electrónico">
            <input
              type="email"
              autoComplete="email"
              placeholder="tu@correo.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          {mode !== "recover" && (
            <Field label="Contraseña">
              <input
                type="password"
                autoComplete={
                  mode === "signup" ? "new-password" : "current-password"
                }
                required
                minLength={mode === "signup" ? 12 : 1}
                placeholder={
                  mode === "signup" ? "Al menos 12 caracteres" : "Tu contraseña"
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
          )}
          <button className="btn primary full" disabled={busy || !configured}>
            {busy
              ? "Procesando…"
              : mode === "signup"
                ? "Activar cuenta"
                : mode === "recover"
                  ? "Enviar enlace"
                  : "Ingresar"}
            <ArrowRight size={17} />
          </button>
          <button
            className="text-link"
            type="button"
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
          >
            {mode === "login"
              ? "Primera vez · Activar cuenta autorizada"
              : "Volver al inicio de sesión"}
          </button>
          {mode === "login" && (
            <button
              className="text-link muted"
              type="button"
              onClick={() => setMode("recover")}
            >
              Olvidé mi contraseña
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
