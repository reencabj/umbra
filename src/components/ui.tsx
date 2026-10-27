import { useEffect, useState, useId, cloneElement } from "react";
import type { ReactNode, ReactElement, FormEvent } from "react";
import {
  X,
  Package,
  LoaderCircle,
  Search,
  Copy,
  Download,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { db } from "../lib/supabase";
import { money, ticket } from "../lib/domain";
import { statusLabel } from "../lib/types";
import type { Order } from "../lib/types";
import { useApp } from "../state";
export const errorMessage = (e: unknown) =>
  e instanceof Error
    ? e.message
    : (e as { message?: string })?.message ||
      "Ocurrió un error. Intentá otra vez.";
export function PageTitle({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        <div className="eyebrow">OPERACIONES / {title.toUpperCase()}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
export function Empty({
  title = "Todavía no hay registros",
  description = "Los datos aparecerán acá cuando registres actividad.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="empty">
      <Package size={28} />
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
export function Spinner() {
  return (
    <div className="empty">
      <LoaderCircle className="spin" />
      <p>Cargando información…</p>
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", fn);
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", fn);
      document.body.style.overflow = before;
    };
  }, [onClose]);
  return (
    <div
      className="overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={"modal " + (wide ? "wide" : "")}
      >
        <header>
          <h2>{title}</h2>
          <button className="icon-button" aria-label="Cerrar" onClick={onClose}>
            <X size={20} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="field">
      <label id={id + "-label"} htmlFor={id}>
        {label}
      </label>
      {cloneElement(
        children as ReactElement<{
          id?: string;
          "aria-labelledby"?: string;
          "aria-describedby"?: string;
        }>,
        {
          id,
          "aria-labelledby": id + "-label",
          "aria-describedby": hint ? id + "-hint" : undefined,
        },
      )}
      {hint && <small id={id + "-hint"}>{hint}</small>}
    </div>
  );
}
export function SearchBox({
  value,
  onChange,
  placeholder = "Buscar…",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="search">
      <Search size={17} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
    </div>
  );
}
export function Badge({ status }: { status: Order["status"] }) {
  return (
    <span className={"badge " + status}>
      <i />
      {statusLabel[status]}
    </span>
  );
}
export function Photo({ path, name }: { path: string | null; name: string }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let alive = true;
    setUrl("");
    if (path)
      db.storage
        .from("product-photos")
        .createSignedUrl(path, 3600)
        .then(({ data }) => {
          if (alive) setUrl(data?.signedUrl || "");
        });
    return () => {
      alive = false;
    };
  }, [path]);
  return url ? (
    <img className="product-photo" src={url} alt={name} />
  ) : (
    <div className="product-placeholder">
      <Package size={26} />
    </div>
  );
}
export async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Copiado al portapapeles");
  } catch {
    toast.error(
      "El navegador no permitió copiar. Seleccioná el texto y copialo manualmente.",
    );
  }
}
export function Submit({
  busy,
  label = "Guardar",
}: {
  busy: boolean;
  label?: string;
}) {
  return (
    <button className="btn primary" disabled={busy} type="submit">
      {busy ? (
        <LoaderCircle size={17} className="spin" />
      ) : (
        <CheckCircle2 size={17} />
      )}{" "}
      {busy ? "Guardando…" : label}
    </button>
  );
}
export function Form({
  children,
  onSubmit,
  className,
}: {
  children: ReactNode;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  className?: string;
}) {
  return (
    <form className={className} onSubmit={onSubmit}>
      {children}
    </form>
  );
}
export function TicketModal({
  order,
  onClose,
}: {
  order: Order;
  onClose: () => void;
}) {
  const { data } = useApp();
  const [compact, setCompact] = useState(data!.settings.ticket_compact);
  const items = data!.items.filter((i) => i.order_id === order.id);
  const text = ticket(order, items, data!.settings, compact);
  const png = async () => {
    try {
      const { toPng } = await import("html-to-image");
      const el = document.getElementById("ticket-export")!;
      const url = await toPng(el, {
        pixelRatio: 2,
        backgroundColor: "#101419",
      });
      const a = document.createElement("a");
      a.download = `pedido-${order.number}.png`;
      a.href = url;
      a.click();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  return (
    <Modal
      title={`Comprobante #${String(order.number).padStart(5, "0")}`}
      onClose={onClose}
    >
      <div className="toolbar">
        <label className="check">
          <input
            type="checkbox"
            checked={compact}
            onChange={(e) => setCompact(e.target.checked)}
          />{" "}
          Versión compacta
        </label>
        <Badge status={order.status} />
      </div>
      <div id="ticket-export" className="ticket">
        <div className="ticket-mark">
          {data!.settings.system_name}
          <span>COMPROBANTE DE VENTA</span>
        </div>
        <pre>{text}</pre>
        <div className="ticket-total">{money(order.total)}</div>
      </div>
      <div className="modal-actions">
        <button className="btn" onClick={() => void png()}>
          <Download size={16} /> PNG
        </button>
        <button className="btn primary" onClick={() => void copy(text)}>
          <Copy size={16} /> Copiar ticket
        </button>
      </div>
    </Modal>
  );
}
