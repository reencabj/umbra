import { useState } from "react";
import { Plus, Pencil, History, Phone, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useApp } from "../state";
import type { Organization } from "../lib/types";
import { contactStatuses } from "../lib/types";
import { money, billable, localDate } from "../lib/domain";
import { saveRow, rpc } from "../lib/supabase";
import {
  PageTitle,
  SearchBox,
  Empty,
  Modal,
  Field,
  Submit,
  Badge,
  errorMessage,
} from "../components/ui";
export default function Organizations() {
  const { data: d, profile, reload } = useApp();
  const data = d!;
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("name");
  const [edit, setEdit] = useState<Organization | null | undefined>();
  const [detail, setDetail] = useState<Organization | null>(null);
  const [contact, setContact] = useState<Organization | null>(null);
  const [result, setResult] = useState("Contactada");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const spent = (id: string) =>
    data.orders
      .filter((o) => o.organization_id === id && billable(o))
      .reduce((a, o) => a + o.total, 0);
  const list = data.organizations
    .filter(
      (o) =>
        o.name.toLowerCase().includes(search.toLowerCase()) &&
        (status === "all" || o.contact_status === status),
    )
    .sort((a, b) =>
      sort === "spent"
        ? spent(b.id) - spent(a.id)
        : a.name.localeCompare(b.name),
    );
  const record = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await rpc("record_contact", {
        p_org: contact!.id,
        p_result: result,
        p_notes: notes,
      });
      await reload();
      setContact(null);
      setNotes("");
      toast.success("Contacto registrado");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageTitle
        title="Organizaciones"
        action={
          <button
            className="btn primary"
            disabled={profile?.role !== "admin"}
            onClick={() => setEdit(null)}
          >
            <Plus size={17} />
            Crear organización
          </button>
        }
      />
      <section className="panel">
        <div className="toolbar">
          <SearchBox
            value={search}
            onChange={setSearch}
            placeholder="Buscar organización…"
          />
          <select
            aria-label="Estado de contacto"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="all">Todos los contactos</option>
            {contactStatuses.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <select
            aria-label="Ordenar organizaciones"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="name">Nombre A–Z</option>
            <option value="spent">Mayor gasto</option>
          </select>
        </div>
        {!list.length ? (
          <Empty
            title="Creá tu primera organización"
            description="Registrá las bandas para empezar a cargar ventas y contactos."
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Organización</th>
                  <th>Contacto</th>
                  <th>Pedidos</th>
                  <th>Total gastado</th>
                  <th>Última compra</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {list.map((o) => {
                  const orders = data.orders.filter(
                    (x) => x.organization_id === o.id && billable(x),
                  );
                  const last = orders
                    .map((x) => x.business_date)
                    .sort()
                    .at(-1);
                  return (
                    <tr key={o.id}>
                      <td>
                        <div className="org-cell">
                          <span>{o.name.slice(0, 2).toUpperCase()}</span>
                          <div>
                            <b>{o.name}</b>
                            <small>
                              {o.code}
                              {!o.active ? " · Inactiva" : ""}
                            </small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span
                          className={
                            "contact-status " +
                            (o.contact_status === "No respondió"
                              ? "warning"
                              : "")
                          }
                        >
                          {o.contact_status}
                        </span>
                      </td>
                      <td>{orders.length}</td>
                      <td className="amount">{money(spent(o.id))}</td>
                      <td>{last ? localDate(last) : "Sin compras"}</td>
                      <td>
                        <div className="row-actions">
                          <button
                            className="icon-button"
                            title="Historial y cupos"
                            onClick={() => setDetail(o)}
                          >
                            <History size={16} />
                          </button>
                          <button
                            className="icon-button"
                            title="Registrar contacto"
                            disabled={profile?.role !== "admin"}
                            onClick={() => setContact(o)}
                          >
                            <Phone size={15} />
                          </button>
                          <button
                            className="icon-button"
                            title="Editar organización"
                            disabled={profile?.role !== "admin"}
                            onClick={() => setEdit(o)}
                          >
                            <Pencil size={15} />
                          </button>
                          <Link
                            className="icon-button"
                            title="Nueva venta"
                            to="/sales"
                          >
                            <ArrowUpRight size={17} />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {edit !== undefined && (
        <OrganizationEditor
          organization={edit}
          onClose={() => setEdit(undefined)}
          onSaved={async () => {
            await reload();
            setEdit(undefined);
          }}
        />
      )}
      {contact && (
        <Modal
          title={`Contacto · ${contact.name}`}
          onClose={() => !busy && setContact(null)}
        >
          <form className="form-stack" onSubmit={(e) => void record(e)}>
            <Field label="Resultado">
              <select
                value={result}
                onChange={(e) => setResult(e.target.value)}
              >
                {contactStatuses.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field label="Notas del intento">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </Field>
            <div className="modal-actions">
              <Submit busy={busy} label="Registrar contacto" />
            </div>
          </form>
        </Modal>
      )}
      {detail && (
        <Modal title={detail.name} wide onClose={() => setDetail(null)}>
          <div className="detail-stats">
            <div>
              <small>Total gastado</small>
              <strong>{money(spent(detail.id))}</strong>
            </div>
            <div>
              <small>Estado de contacto</small>
              <strong>{detail.contact_status}</strong>
            </div>
          </div>
          <p>{detail.notes || "Sin notas internas."}</p>
          <h3>Cupos de esta semana</h3>
          <div className="quota-list">
            {data.categories
              .filter((c) => c.active)
              .map((c) => {
                const e = data.exceptions.find(
                  (e) =>
                    e.organization_id === detail.id && e.category_id === c.id,
                );
                const cap = e ? e.weekly_limit : c.weekly_limit;
                const used =
                  data.usage.find(
                    (u) =>
                      u.organization_id === detail.id && u.category_id === c.id,
                  )?.used || 0;
                return (
                  <div key={c.id}>
                    <span>{c.name}</span>
                    <b>
                      {used} / {cap ?? "Sin límite"}
                    </b>
                  </div>
                );
              })}
          </div>
          <h3>Historial de ventas</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Pedido</th>
                  <th>Total</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {data.orders
                  .filter((o) => o.organization_id === detail.id)
                  .sort((a, b) => b.number - a.number)
                  .map((o) => (
                    <tr key={o.id}>
                      <td>{localDate(o.business_date)}</td>
                      <td>#{o.number}</td>
                      <td>{money(o.total)}</td>
                      <td>
                        <Badge status={o.status} />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <h3>Intentos de contacto</h3>
          {data.contacts
            .filter((c) => c.organization_id === detail.id)
            .sort((a, b) => b.contact_date.localeCompare(a.contact_date))
            .map((c) => (
              <div className="contact-entry" key={c.id}>
                <small>
                  {localDate(c.contact_date)}
                  {c.occurred_at ? "" : " · hora no registrada"}
                </small>
                <b>{c.result}</b>
                <p>{c.notes}</p>
              </div>
            ))}
        </Modal>
      )}
    </>
  );
}
function OrganizationEditor({
  organization: o,
  onClose,
  onSaved,
}: {
  organization: Organization | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState(o?.name || "");
  const [code, setCode] = useState(o?.code || "");
  const [notes, setNotes] = useState(o?.notes || "");
  const [active, setActive] = useState(o?.active ?? true);
  const [busy, setBusy] = useState(false);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await saveRow("organizations", {
        id: o?.id || crypto.randomUUID(),
        name: name.trim(),
        code: code.trim().toUpperCase(),
        notes,
        active,
      });
      toast.success("Organización guardada");
      await onSaved();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title={o ? "Editar organización" : "Crear organización"}
      onClose={() => !busy && onClose()}
    >
      <form className="form-stack" onSubmit={(e) => void save(e)}>
        <Field label="Nombre">
          <input
            required
            maxLength={100}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!o)
                setCode(
                  e.target.value
                    .toUpperCase()
                    .replace(/[^A-Z0-9]+/g, "-")
                    .replace(/^-|-$/g, ""),
                );
            }}
          />
        </Field>
        <Field label="Identificador único">
          <input
            required
            pattern="[A-Za-z0-9_-]+"
            maxLength={60}
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </Field>
        <Field label="Notas internas">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </Field>
        <label className="check">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />
          Organización activa
        </label>
        <div className="modal-actions">
          <Submit busy={busy} />
        </div>
      </form>
    </Modal>
  );
}
