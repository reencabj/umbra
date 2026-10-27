import { useState } from "react";
import { Clock3, Plus, Pencil, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { formatInTimeZone } from "date-fns-tz";
import { useApp } from "../state";
import type { Category } from "../lib/types";
import { db, saveRow } from "../lib/supabase";
import { weekWindow, TZ } from "../lib/domain";
import {
  PageTitle,
  SearchBox,
  Empty,
  Modal,
  Field,
  Submit,
  errorMessage,
} from "../components/ui";
export default function Limits() {
  const { data: d, profile, reload } = useApp();
  const data = d!;
  const [org, setOrg] = useState("all");
  const [search, setSearch] = useState("");
  const [edit, setEdit] = useState<Category | null | undefined>();
  const [exception, setException] = useState(false);
  const [exOrg, setExOrg] = useState("");
  const [exCat, setExCat] = useState("");
  const [exCap, setExCap] = useState("");
  const [busy, setBusy] = useState(false);
  const window = weekWindow(data.settings);
  const admin = profile?.role === "admin";
  const orgs = data.organizations.filter(
    (o) =>
      (org === "all" || o.id === org) &&
      o.name.toLowerCase().includes(search.toLowerCase()),
  );
  const saveException = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await saveRow("limit_exceptions", {
        organization_id: exOrg,
        category_id: exCat,
        weekly_limit: exCap === "" ? null : Number(exCap),
      });
      await reload();
      setException(false);
      toast.success("Excepción guardada");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const removeException = async (oid: string, cid: string) => {
    try {
      const { error } = await db
        .from("limit_exceptions")
        .delete()
        .eq("organization_id", oid)
        .eq("category_id", cid);
      if (error) throw error;
      await reload();
      toast.success("Se restauró el límite general");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  return (
    <>
      <PageTitle
        title="Stock semanal"
        description="Cupo compartido por categoría para cada organización."
        action={
          admin && (
            <div className="row-actions">
              <button
                className="btn"
                onClick={() => {
                  setExOrg(data.organizations[0]?.id || "");
                  setExCat(data.categories[0]?.id || "");
                  setExCap("");
                  setException(true);
                }}
              >
                <ShieldCheck size={16} />
                Crear excepción
              </button>
              <button className="btn primary" onClick={() => setEdit(null)}>
                <Plus size={16} />
                Crear categoría
              </button>
            </div>
          )
        }
      />
      <div className="reset-banner">
        <Clock3 size={20} />
        <div>
          <b>
            Próximo reinicio:{" "}
            {formatInTimeZone(window.end, TZ, "EEEE dd/MM/yyyy 'a las' HH:mm")}
          </b>
          <span>
            Horario de Argentina · Los registros permanecen en el historial.
          </span>
        </div>
      </div>
      <div className="category-caps">
        {data.categories.map((c) => (
          <div key={c.id} className="panel cap-card">
            <div>
              <span>{c.name}</span>
              {admin && (
                <button
                  className="icon-button"
                  title={`Editar ${c.name}`}
                  onClick={() => setEdit(c)}
                >
                  <Pencil size={14} />
                </button>
              )}
            </div>
            <strong>
              {c.weekly_limit ?? "∞"}
              <small> / semana</small>
            </strong>
            <span className="muted">
              {c.active ? "Categoría activa" : "Categoría inactiva"}
            </span>
          </div>
        ))}
      </div>
      <section className="panel">
        <div className="toolbar">
          <SearchBox
            value={search}
            onChange={setSearch}
            placeholder="Buscar organización…"
          />
          <select
            aria-label="Organización para cupos"
            value={org}
            onChange={(e) => setOrg(e.target.value)}
          >
            <option value="all">Todas las organizaciones</option>
            {data.organizations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
        {!orgs.length ? (
          <Empty title="Sin organizaciones para mostrar" />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Organización</th>
                  <th>Categoría</th>
                  <th>Utilizado</th>
                  <th>Disponible</th>
                  <th>Consumo</th>
                  <th>Límite</th>
                </tr>
              </thead>
              <tbody>
                {orgs.flatMap((o) =>
                  data.categories
                    .filter((c) => c.active)
                    .map((c) => {
                      const ex = data.exceptions.find(
                        (e) =>
                          e.organization_id === o.id && e.category_id === c.id,
                      );
                      const cap = ex ? ex.weekly_limit : c.weekly_limit;
                      const used =
                        data.usage.find(
                          (u) =>
                            u.organization_id === o.id &&
                            u.category_id === c.id,
                        )?.used || 0;
                      const percent =
                        cap === null
                          ? 0
                          : cap === 0
                            ? 100
                            : Math.min(100, Math.round((used / cap) * 100));
                      return (
                        <tr key={o.id + c.id}>
                          <td>
                            <b>{o.name}</b>
                          </td>
                          <td>{c.name}</td>
                          <td>{used}</td>
                          <td>
                            {cap === null
                              ? "Sin límite"
                              : Math.max(0, cap - used)}
                          </td>
                          <td>
                            <div className="progress-cell">
                              <div className="progress">
                                <i
                                  style={{ width: percent + "%" }}
                                  className={percent >= 100 ? "full-quota" : ""}
                                />
                              </div>
                              <span>{cap === null ? "—" : percent + "%"}</span>
                            </div>
                          </td>
                          <td>
                            {ex ? (
                              <div className="row-actions">
                                <span className="text-green">
                                  Excepción: {cap ?? "Sin límite"}
                                </span>
                                {admin && (
                                  <button
                                    className="text-link"
                                    onClick={() =>
                                      void removeException(o.id, c.id)
                                    }
                                  >
                                    Restaurar
                                  </button>
                                )}
                              </div>
                            ) : (
                              (cap ?? "Sin límite")
                            )}
                          </td>
                        </tr>
                      );
                    }),
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <div className="info-line">
        <ShieldCheck size={16} /> Pendientes, confirmados y entregados consumen
        cupo. Las anulaciones lo liberan. Los productos de una misma categoría
        suman juntos.
      </div>
      {edit !== undefined && (
        <CategoryEditor
          category={edit}
          onClose={() => setEdit(undefined)}
          onSaved={async () => {
            await reload();
            setEdit(undefined);
          }}
        />
      )}
      {exception && (
        <Modal
          title="Excepción por organización"
          onClose={() => !busy && setException(false)}
        >
          <form className="form-stack" onSubmit={(e) => void saveException(e)}>
            <Field label="Organización">
              <select
                required
                value={exOrg}
                onChange={(e) => setExOrg(e.target.value)}
              >
                <option value="">Seleccionar</option>
                {data.organizations.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Categoría">
              <select
                required
                value={exCat}
                onChange={(e) => setExCat(e.target.value)}
              >
                {data.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Límite semanal"
              hint="Vacío = sin límite. Cero = bloqueado."
            >
              <input
                type="number"
                min="0"
                step="1"
                value={exCap}
                onChange={(e) => setExCap(e.target.value)}
              />
            </Field>
            <div className="modal-actions">
              <Submit busy={busy} />
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
function CategoryEditor({
  category: c,
  onClose,
  onSaved,
}: {
  category: Category | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState(c?.name || "");
  const [limit, setLimit] = useState(c?.weekly_limit?.toString() ?? "");
  const [active, setActive] = useState(c?.active ?? true);
  const [busy, setBusy] = useState(false);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await saveRow("categories", {
        id: c?.id || crypto.randomUUID(),
        name: name.trim(),
        weekly_limit: limit === "" ? null : Number(limit),
        active,
      });
      await onSaved();
      toast.success("Categoría guardada");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title={c ? "Editar categoría y límite" : "Crear categoría"}
      onClose={() => !busy && onClose()}
    >
      <form className="form-stack" onSubmit={(e) => void save(e)}>
        <Field label="Nombre de categoría">
          <input
            required
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field
          label="Límite semanal"
          hint="Dejá vacío para desactivar el límite. Cero bloquea las compras de la categoría."
        >
          <input
            type="number"
            min="0"
            step="1"
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
          />
        </Field>
        <label className="check">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />
          Categoría activa
        </label>
        <div className="modal-actions">
          <Submit busy={busy} />
        </div>
      </form>
    </Modal>
  );
}
