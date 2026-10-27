import type { ReactNode } from "react";
import Logo from "./Logo";

export default function AuthLayout({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="auth-page">
      <section className="auth-card" aria-label={title}>
        <header className="auth-header">
          <Logo className="auth-logo" />
          <h1>{title}</h1>
          <p>{description}</p>
        </header>
        {children}
      </section>
    </main>
  );
}
