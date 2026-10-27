import { useState } from "react";
import {
  Settings2,
  Users,
  Database,
  Layers3,
  Plus,
  Trash2,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { useApp } from "../state";
import type { CartLine } from "../lib/types";
import { rpc, saveRow, rows } from "../lib/supabase";
import {
  PageTitle,
  Field,
  Submit,
  Modal,
  errorMessage,
} from "../components/ui";
export default function Settings() {
  const { data: d, profile, reload } = useApp();
  const data = d!;
  const s = data.settings;
  const [name, setName] = useState(s.system_name);
  const [wash, setWash] = useState(s.washing_bps / 100);
  const [day, setDay] = useState(s.reset_day);
  const [time, setTime] = useState(
    `${String(Math.floor(s.reset_minute / 60)).padStart(2, "0")}:${String(s.reset_minute % 60).padStart(2, "0")}`,
  );
  const [footer, setFooter] = useState(s.ticket_footer);
  const [heading, setHeading] = useState(s.report_heading);
  const [compact, setCompact] = useState(s.ticket_compact);
  const [reportCompact, setReportCompact] = useState(s.report_compact);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("operator");
  const [importOpen, setImportOpen] = useState(false);
  const [comboOpen, setComboOpen] = useState(false);
  const [comboName, setComboName] = useState("");
  const [comboItems, setComboItems] = useState<CartLine[]>([]);
  const [audit, setAudit] = useState<object[] | null>(null);
  if (profile?.role !== "admin")
    return (
      <>
        <PageTitle
          title="Configuración"
          description="Los cambios de configuración requieren acceso de administrador."
        />
        <div className="panel empty">
          <ShieldCheck size={30} />
          <h3>Acceso de operador</h3>
          <p>Pedile al administrador que realice los cambios del sistema.</p>
        </div>
      </>
    );
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const [h, m] = time.split(":").map(Number);
      await saveRow("settings", {
        ...s,
        system_name: name.trim(),
        washing_bps: Math.round(wash * 100),
        reset_day: day,
        reset_minute: h * 60 + m,
        ticket_footer: footer,
        report_heading: heading,
        ticket_compact: compact,
        report_compact: reportCompact,
      });
      await reload();
      toast.success("Configuración guardada");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const authorize = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await rpc("set_authorized_user", {
        p_email: email.toLowerCase().trim(),
        p_role: role,
        p_enabled: true,
      });
      await reload();
      setEmail("");
      toast.success(
        "Correo autorizado. La persona puede activar su cuenta desde el acceso.",
      );
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const toggleUser = async (email: string, role: string, enabled: boolean) => {
    try {
      await rpc("set_authorized_user", {
        p_email: email,
        p_role: role,
        p_enabled: enabled,
      });
      await reload();
      toast.success("Permisos actualizados");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  const importHistory = async () => {
    setBusy(true);
    try {
      const count = await rpc<number>("import_history");
      await reload();
      setImportOpen(false);
      toast.success(
        count
          ? `${count} pedidos históricos importados`
          : "Los pedidos ya estaban importados. No se duplicaron.",
      );
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const saveCombo = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (!comboItems.length) throw Error("Agregá al menos un producto.");
      await saveRow("combos", {
        id: crypto.randomUUID(),
        name: comboName,
        items: comboItems,
        active: true,
      });
      await reload();
      setComboOpen(false);
      setComboName("");
      setComboItems([]);
      toast.success("Combo guardado");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageTitle
        title="Configuración"
        description="Ajustes del sistema, acceso de usuarios y herramientas de administración."
      />
      <div className="settings-layout">
        <form
          className="panel form-stack settings-form"
          onSubmit={(e) => void save(e)}
        >
          <div className="settings-section-title">
            <Settings2 size={19} />
            <h2>General y reglas de venta</h2>
          </div>
          <Field label="Nombre del sistema">
            <input
              required
              maxLength={60}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field
            label="Recargo de lavado (%)"
            hint="Se aplica una sola vez sobre el subtotal negro. Los pedidos existentes conservan su porcentaje."
          >
            <input
              required
              type="number"
              min="0"
              max="1000"
              step="0.01"
              value={wash}
              onChange={(e) => setWash(Number(e.target.value))}
            />
          </Field>
          <div className="form-grid">
            <Field label="Día de reinicio">
              <select
                value={day}
                onChange={(e) => setDay(Number(e.target.value))}
              >
                {[
                  "Lunes",
                  "Martes",
                  "Miércoles",
                  "Jueves",
                  "Viernes",
                  "Sábado",
                  "Domingo",
                ].map((d, i) => (
                  <option key={d} value={i + 1}>
                    {d}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Hora en Argentina">
              <input
                required
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </Field>
          </div>
          <p className="hint">
            Zona horaria: America/Argentina/Buenos_Aires. Un cambio del reinicio
            redefine el período actual a partir de las fechas originales; no
            borra pedidos.
          </p>
          <div className="settings-section-title">
            <ShieldCheck size={18} />
            <h2>Tickets y reportes</h2>
          </div>
          <Field label="Pie de los tickets">
            <textarea
              rows={2}
              value={footer}
              maxLength={500}
              onChange={(e) => setFooter(e.target.value)}
            />
          </Field>
          <Field label="Encabezado del reporte">
            <input
              required
              value={heading}
              maxLength={80}
              onChange={(e) => setHeading(e.target.value)}
            />
          </Field>
          <label className="check">
            <input
              type="checkbox"
              checked={compact}
              onChange={(e) => setCompact(e.target.checked)}
            />
            Tickets compactos por defecto
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={reportCompact}
              onChange={(e) => setReportCompact(e.target.checked)}
            />
            Productos del reporte en una sola línea
          </label>
          <div className="modal-actions">
            <Submit busy={busy} label="Guardar configuración" />
          </div>
        </form>
        <div className="form-stack">
          <section className="panel settings-form">
            <div className="settings-section-title">
              <Users size={19} />
              <h2>Usuarios autorizados</h2>
            </div>
            <p className="hint">
              Solo estos correos pueden activar una cuenta. Al deshabilitar un
              usuario se bloquea inmediatamente su acceso a los datos.
            </p>
            <form className="form-stack" onSubmit={(e) => void authorize(e)}>
              <Field label="Correo electrónico">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="operador@correo.com"
                />
              </Field>
              <div className="form-grid">
                <select
                  aria-label="Rol del nuevo usuario"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                >
                  <option value="operator">Operador</option>
                  <option value="admin">Administrador</option>
                </select>
                <Submit busy={busy} label="Autorizar" />
              </div>
            </form>
            <div className="users-list">
              {data.users.map((u) => (
                <div key={u.email}>
                  <div>
                    <b>{u.email}</b>
                    <small>
                      {u.role === "admin" ? "Administrador" : "Operador"} ·{" "}
                      {u.enabled ? "Habilitado" : "Deshabilitado"}
                    </small>
                  </div>
                  <button
                    className="btn small"
                    disabled={u.email === profile.email}
                    onClick={() => void toggleUser(u.email, u.role, !u.enabled)}
                  >
                    {u.enabled ? "Deshabilitar" : "Habilitar"}
                  </button>
                </div>
              ))}
            </div>
          </section>
          <section className="panel settings-form">
            <div className="settings-section-title">
              <Layers3 size={19} />
              <h2>Combos preconfigurados</h2>
              <button
                className="icon-button push"
                title="Crear combo"
                onClick={() => setComboOpen(true)}
              >
                <Plus size={17} />
              </button>
            </div>
            {data.combos.map((c) => (
              <div className="combo-row" key={c.id}>
                <span>
                  {c.name}
                  <small>
                    {c.items.length} productos ·{" "}
                    {c.active ? "Activo" : "Inactivo"}
                  </small>
                </span>
                <button
                  className="btn small"
                  onClick={async () => {
                    try {
                      await saveRow("combos", { ...c, active: !c.active });
                      await reload();
                    } catch (e) {
                      toast.error(errorMessage(e));
                    }
                  }}
                >
                  {c.active ? "Desactivar" : "Activar"}
                </button>
              </div>
            ))}
            {!data.combos.length && (
              <p className="hint">
                Creá combos para agregar varios artículos al pedido con un clic.
              </p>
            )}
          </section>
          <section className="panel settings-form">
            <div className="settings-section-title">
              <Database size={19} />
              <h2>Datos y auditoría</h2>
            </div>
            <p className="hint">
              Importación opcional de 10 pedidos blancos del 27/10/2026 y tres
              contactos sin respuesta. Total: $1.134.000.
            </p>
            <button className="btn full" onClick={() => setImportOpen(true)}>
              Importar ventas históricas
            </button>
            <button
              className="btn full"
              onClick={async () => {
                try {
                  setAudit(
                    (await rows<object>("audit_log")).slice(-100).reverse(),
                  );
                } catch (e) {
                  toast.error(errorMessage(e));
                }
              }}
            >
              Ver registro de auditoría
            </button>
          </section>
        </div>
      </div>
      {importOpen && (
        <Modal
          title="Importar historial del 27/10/2026"
          onClose={() => !busy && setImportOpen(false)}
        >
          <p>
            Se crearán 10 pedidos por <b>$1.134.000</b>, con fecha conocida y
            sin hora individual. Se marcarán como entregados y no modificarán el
            stock actual.
          </p>
          <p>
            El cupo se asociará a su semana original. La importación se puede
            repetir sin duplicar registros.
          </p>
          <div className="modal-actions">
            <button
              className="btn"
              onClick={() => setImportOpen(false)}
              disabled={busy}
            >
              Volver
            </button>
            <button
              className="btn primary"
              onClick={() => void importHistory()}
              disabled={busy}
            >
              {busy ? "Importando…" : "Importar historial"}
            </button>
          </div>
        </Modal>
      )}
      {comboOpen && (
        <Modal title="Crear combo" onClose={() => !busy && setComboOpen(false)}>
          <form className="form-stack" onSubmit={(e) => void saveCombo(e)}>
            <Field label="Nombre del combo">
              <input
                required
                value={comboName}
                onChange={(e) => setComboName(e.target.value)}
              />
            </Field>
            {data.products
              .filter((p) => p.active && !p.archived)
              .map((p) => (
                <div className="combo-item" key={p.id}>
                  <label htmlFor={"combo-" + p.id}>{p.name}</label>
                  <input
                    id={"combo-" + p.id}
                    type="number"
                    min="0"
                    max="1000000"
                    step="1"
                    value={
                      comboItems.find((i) => i.product_id === p.id)?.quantity ||
                      0
                    }
                    onChange={(e) => {
                      const q = Number(e.target.value);
                      setComboItems((previous) => [
                        ...previous.filter((i) => i.product_id !== p.id),
                        ...(q > 0 ? [{ product_id: p.id, quantity: q }] : []),
                      ]);
                    }}
                  />
                  <button
                    type="button"
                    className="icon-button"
                    title="Quitar del combo"
                    onClick={() =>
                      setComboItems((prev) =>
                        prev.filter((i) => i.product_id !== p.id),
                      )
                    }
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            <div className="modal-actions">
              <Submit busy={busy} />
            </div>
          </form>
        </Modal>
      )}
      {audit && (
        <Modal
          title="Auditoría · últimos 100 cambios"
          wide
          onClose={() => setAudit(null)}
        >
          <pre className="audit-preview">{JSON.stringify(audit, null, 2)}</pre>
        </Modal>
      )}
    </>
  );
}
