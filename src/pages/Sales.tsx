import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
  ShieldCheck,
  Wallet,
  Layers3,
} from "lucide-react";
import { toast } from "sonner";
import { useApp } from "../state";
import type { CartLine, Payment, Status } from "../lib/types";
import { money, totals, weekWindow, TZ } from "../lib/domain";
import { fromZonedTime } from "date-fns-tz";
import { rpc } from "../lib/supabase";
import {
  PageTitle,
  SearchBox,
  Photo,
  Modal,
  TicketModal,
  errorMessage,
} from "../components/ui";
export default function Sales() {
  const { data: d, reload, profile } = useApp();
  const data = d!;
  const [params, setParams] = useSearchParams();
  const edit = data.orders.find((o) => o.id === params.get("edit"));
  const source = data.orders.find((o) => o.id === params.get("duplicate"));
  const [org, setOrg] = useState("");
  const [payment, setPayment] = useState<Payment>("white");
  const [status, setStatus] = useState<Status>("confirmed");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ticketId, setTicketId] = useState("");
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());
  useEffect(() => {
    const o = edit || source;
    if (o) {
      setOrg(o.organization_id);
      setPayment(o.payment);
      setStatus(
        edit
          ? o.status === "cancelled"
            ? "confirmed"
            : o.status
          : "confirmed",
      );
      setNotes(o.notes);
      setCart(
        data.items
          .filter((i) => i.order_id === o.id)
          .map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
      );
    } else {
      setCart([]);
      setNotes("");
      setStatus("confirmed");
    }
    setRequestKey(crypto.randomUUID());
  }, [edit?.id, source?.id]);
  const originalItems = edit
    ? data.items.filter((i) => i.order_id === edit.id)
    : [];
  const products = data.products
    .filter(
      (p) =>
        originalItems.some((i) => i.product_id === p.id) ||
        (p.active &&
          !p.archived &&
          data.categories.some((c) => c.id === p.category_id && c.active)),
    )
    .map((p) => {
      const old = originalItems.find((i) => i.product_id === p.id);
      return old
        ? { ...p, name: old.product_name, category_id: old.category_id }
        : p;
    });
  const selectedOrg = data.organizations.find((o) => o.id === org);
  const bps =
    edit && edit.payment === payment
      ? edit.washing_bps
      : data.settings.washing_bps;
  const getPrice = (id: string) => {
    const old = originalItems.find((i) => i.product_id === id);
    return edit && edit.payment === payment && old
      ? old.unit_price
      : (data.prices.find((p) => p.product_id === id)?.[payment] ?? 0);
  };
  let amount = { subtotal: 0, washing: 0, total: 0 };
  let amountError = "";
  try {
    amount = totals(
      cart.map((c) => ({
        quantity: c.quantity,
        unit_price: getPrice(c.product_id),
      })),
      payment,
      bps,
    );
  } catch (e) {
    amountError = errorMessage(e);
  }
  const window = weekWindow(
    data.settings,
    edit
      ? edit.occurred_at
        ? new Date(edit.occurred_at)
        : fromZonedTime(edit.business_date + "T00:00:00", TZ)
      : new Date(),
  );
  const used = useMemo(() => {
    const result: Record<string, number> = {};
    for (const o of data.orders) {
      const at = o.occurred_at
        ? new Date(o.occurred_at)
        : fromZonedTime(o.business_date + "T00:00:00", TZ);
      if (
        o.organization_id !== org ||
        o.status === "cancelled" ||
        o.id === edit?.id ||
        at < window.start ||
        at >= window.end
      )
        continue;
      for (const i of data.items.filter((i) => i.order_id === o.id))
        result[i.category_id] = (result[i.category_id] || 0) + i.quantity;
    }
    return result;
  }, [data.orders, data.items, org, edit?.id, window.start.getTime()]);
  const capFor = (id: string) => {
    const exception = data.exceptions.find(
      (e) => e.organization_id === org && e.category_id === id,
    );
    return exception
      ? exception.weekly_limit
      : (data.categories.find((c) => c.id === id)?.weekly_limit ?? null);
  };
  const cartByCategory = (id: string) =>
    cart.reduce(
      (a, c) =>
        a +
        (products.find((p) => p.id === c.product_id)?.category_id === id
          ? c.quantity
          : 0),
      0,
    );
  const issues: string[] = amountError ? [amountError] : [];
  if (edit?.status === "cancelled")
    issues.push("El pedido fue anulado. Duplicalo para crear otro.");
  if (!selectedOrg?.active) issues.push("Seleccioná una organización activa.");
  if (!cart.length) issues.push("Agregá al menos un producto.");
  for (const c of cart) {
    const p = products.find((p) => p.id === c.product_id);
    if (!p)
      issues.push("El carrito contiene un producto inactivo o archivado.");
  }
  for (const c of data.categories) {
    const cap = capFor(c.id);
    if (cap !== null && (used[c.id] || 0) + cartByCategory(c.id) > cap)
      issues.push(
        `${c.name}: cupo de ${cap}, utilizado ${used[c.id] || 0}, carrito ${cartByCategory(c.id)}.`,
      );
  }
  if (edit?.historical && profile?.role !== "admin")
    issues.push("La corrección histórica requiere administrador.");
  function quantity(id: string, value: number) {
    setCart((previous) =>
      value <= 0
        ? previous.filter((c) => c.product_id !== id)
        : previous.some((c) => c.product_id === id)
          ? previous.map((c) =>
              c.product_id === id
                ? { ...c, quantity: Math.min(1000000, Math.floor(value)) }
                : c,
            )
          : [
              ...previous,
              {
                product_id: id,
                quantity: Math.min(1000000, Math.floor(value)),
              },
            ],
    );
  }
  async function save() {
    setBusy(true);
    try {
      const id = await rpc<string>("save_order", {
        p: {
          id: edit?.id,
          version: edit?.version,
          request_key: requestKey,
          organization_id: org,
          payment,
          status,
          items: cart,
          notes,
        },
      });
      await reload();
      setTicketId(id);
      setConfirm(false);
      setCart([]);
      setParams({});
      setRequestKey(crypto.randomUUID());
      toast.success(edit ? "Pedido actualizado" : "Venta registrada");
    } catch (e) {
      toast.error(errorMessage(e));
      await reload();
    } finally {
      setBusy(false);
    }
  }
  const ticketOrder = data.orders.find((o) => o.id === ticketId);
  return (
    <>
      <PageTitle
        title={edit ? `Editar pedido #${edit.number}` : "Nueva venta"}
        description="Elegí una organización, armá el pedido y generá su comprobante."
        action={
          <span className="subtle-tag">
            <ShieldCheck size={15} /> Validación transaccional
          </span>
        }
      />
      <div className="sales-layout">
        <div className="sales-catalog">
          <section className="panel sale-selection">
            <div className="section-number">01</div>
            <div className="grow">
              <label className="label" htmlFor="sale-org">
                Organización
              </label>
              <select
                id="sale-org"
                value={org}
                onChange={(e) => setOrg(e.target.value)}
              >
                <option value="">Seleccionar organización</option>
                {data.organizations
                  .filter((o) => o.active)
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
              </select>
              {!data.organizations.length && (
                <Link className="text-link" to="/organizations">
                  Crear la primera organización <ArrowRight size={13} />
                </Link>
              )}
            </div>
            <div className="payment-block">
              <span className="label">Método de pago</span>
              <div className="segmented">
                {(["white", "black"] as Payment[]).map((p) => (
                  <button
                    className={payment === p ? "selected" : ""}
                    key={p}
                    onClick={() => setPayment(p)}
                  >
                    <Wallet size={15} />
                    {p === "white" ? "Blanco" : "Negro"}
                  </button>
                ))}
              </div>
            </div>
          </section>
          <div className="catalog-heading">
            <div>
              <h2>
                Catálogo de productos <span>{products.length}</span>
              </h2>
              <p>
                Precios en dinero {payment === "white" ? "blanco" : "negro"}
              </p>
            </div>
            <SearchBox
              value={search}
              onChange={setSearch}
              placeholder="Buscar artículo…"
            />
          </div>
          <div className="tabs">
            <button
              className={category === "all" ? "active" : ""}
              onClick={() => setCategory("all")}
            >
              Todos
            </button>
            {data.categories
              .filter((c) => c.active)
              .map((c) => (
                <button
                  key={c.id}
                  className={category === c.id ? "active" : ""}
                  onClick={() => setCategory(c.id)}
                >
                  {c.name}
                </button>
              ))}
          </div>
          {data.combos.some((c) => c.active) && (
            <div className="combos">
              <Layers3 size={15} />
              <span>Combos</span>
              {data.combos
                .filter((c) => c.active)
                .map((c) => (
                  <button
                    className="btn small"
                    key={c.id}
                    onClick={() => {
                      setCart((previous) => {
                        const map = new Map(
                          previous.map((i) => [i.product_id, i.quantity]),
                        );
                        c.items.forEach((i) =>
                          map.set(
                            i.product_id,
                            (map.get(i.product_id) || 0) + i.quantity,
                          ),
                        );
                        return [...map].map(([product_id, quantity]) => ({
                          product_id,
                          quantity,
                        }));
                      });
                      toast.success(`Combo ${c.name} agregado`);
                    }}
                  >
                    {c.name}
                    <Plus size={13} />
                  </button>
                ))}
            </div>
          )}
          <div className="product-grid">
            {products
              .filter(
                (p) =>
                  (category === "all" || p.category_id === category) &&
                  p.name.toLowerCase().includes(search.toLowerCase()),
              )
              .map((p) => {
                const count =
                  cart.find((c) => c.product_id === p.id)?.quantity || 0;
                const cap = capFor(p.category_id);
                const rest =
                  cap === null
                    ? null
                    : Math.max(
                        0,
                        cap -
                          (used[p.category_id] || 0) -
                          cartByCategory(p.category_id),
                      );
                return (
                  <article
                    className={"product-card " + (count ? "in-cart" : "")}
                    key={p.id}
                  >
                    <div className="product-image">
                      <Photo path={p.image_path} name={p.name} />
                      <span className="category-label">
                        {
                          data.categories.find((c) => c.id === p.category_id)
                            ?.name
                        }
                      </span>
                      {count > 0 && (
                        <span className="selected-count">
                          {count} en pedido
                        </span>
                      )}
                    </div>
                    <div className="product-content">
                      <h3>{p.name}</h3>
                      <div className="stock-note">
                        {org
                          ? rest === null
                            ? "Sin límite"
                            : `Cupo: ${rest}`
                          : "Elegí organización"}
                      </div>
                      <div className="product-bottom">
                        <strong>{money(getPrice(p.id))}</strong>
                        <div className="stepper">
                          <button
                            aria-label={`Quitar ${p.name}`}
                            disabled={!count}
                            onClick={() => quantity(p.id, count - 1)}
                          >
                            <Minus size={14} />
                          </button>
                          <input
                            aria-label={`Cantidad ${p.name}`}
                            type="number"
                            min="0"
                            max="1000000"
                            value={count}
                            onChange={(e) =>
                              quantity(p.id, Number(e.target.value) || 0)
                            }
                          />
                          <button
                            aria-label={`Agregar ${p.name}`}
                            disabled={!org || rest === 0}
                            onClick={() => quantity(p.id, count + 1)}
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </div>
                      {count > 0 && (
                        <div className="line-subtotal">
                          Subtotal <b>{money(count * getPrice(p.id))}</b>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
          </div>
          <div className="info-line">
            <ShieldCheck size={16} /> Los productos de una categoría comparten
            el cupo semanal. Blanco y Negro consumen el mismo cupo.
          </div>
        </div>
        <aside className="panel order-summary">
          <div className="summary-title">
            <div>
              <ShoppingBag size={19} />
              <h2>Resumen del pedido</h2>
            </div>
            <button
              className="icon-button"
              aria-label="Limpiar carrito"
              onClick={() => setCart([])}
            >
              <Trash2 size={17} />
            </button>
          </div>
          <div className="summary-org">
            <small>ORGANIZACIÓN</small>
            <strong>{selectedOrg?.name || "Sin seleccionar"}</strong>
            <span>
              {payment === "white" ? "Dinero blanco" : "Dinero negro"}
            </span>
          </div>
          <div className="summary-lines">
            {cart.length ? (
              cart.map((c) => (
                <div key={c.product_id}>
                  <span>
                    <b>{c.quantity}×</b>{" "}
                    {products.find((p) => p.id === c.product_id)?.name}
                  </span>
                  <strong>{money(c.quantity * getPrice(c.product_id))}</strong>
                </div>
              ))
            ) : (
              <div className="cart-empty">
                <ShoppingBag size={28} />
                <p>Tu pedido está vacío</p>
                <small>Agregá productos del catálogo.</small>
              </div>
            )}
          </div>
          <div className="summary-totals">
            <div>
              <span>Subtotal</span>
              <b>{money(amount.subtotal)}</b>
            </div>
            <div>
              <span>Lavado {payment === "black" ? `(${bps / 100}%)` : ""}</span>
              <b>{money(amount.washing)}</b>
            </div>
            <div className="grand-total">
              <span>Total final</span>
              <strong>{money(amount.total)}</strong>
            </div>
          </div>
          <label className="field">
            <span>Estado del pedido</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as Status)}
            >
              <option value="pending">Pendiente</option>
              <option value="confirmed">Confirmada</option>
              <option value="delivered">Entregada</option>
            </select>
          </label>
          <textarea
            aria-label="Notas del pedido"
            placeholder="Notas internas (opcional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
          <small className="state-explanation">
            {edit?.historical
              ? "Corrección histórica: conserva la fecha original, sin inventar hora."
              : "UMBRA: disponibilidad ilimitada. Pendientes, confirmadas y entregadas consumen el cupo semanal de la banda; anular lo libera."}
          </small>
          {issues.length > 0 && cart.length > 0 && (
            <div className="inline-error">
              {issues.map((i) => (
                <p key={i}>{i}</p>
              ))}
            </div>
          )}
          <button
            className="btn primary full"
            disabled={issues.length > 0}
            onClick={() => setConfirm(true)}
          >
            {edit ? "Guardar cambios" : "Confirmar pedido"}
            <ArrowRight size={17} />
          </button>
          <div className="summary-foot">
            Los precios quedan guardados en el pedido.
          </div>
        </aside>
      </div>
      {confirm && (
        <Modal
          title={edit ? "Confirmar cambios" : "Confirmar venta"}
          onClose={() => !busy && setConfirm(false)}
        >
          <div className="confirm-sale">
            <div className="confirm-icon">
              <ShieldCheck size={28} />
            </div>
            <h3>{selectedOrg?.name}</h3>
            <p>
              {cart.reduce((a, c) => a + c.quantity, 0)} unidades ·{" "}
              {status === "delivered"
                ? "Entrega inmediata"
                : status === "pending"
                  ? "Pedido pendiente"
                  : "Pedido confirmado"}
            </p>
            <strong>{money(amount.total)}</strong>
            <p>Se comprobará nuevamente el cupo semanal de la organización.</p>
          </div>
          <div className="modal-actions">
            <button
              className="btn"
              disabled={busy}
              onClick={() => setConfirm(false)}
            >
              Volver
            </button>
            <button
              className="btn primary"
              disabled={busy}
              onClick={() => void save()}
            >
              {busy ? "Guardando…" : "Registrar venta"}
            </button>
          </div>
        </Modal>
      )}
      {ticketOrder && (
        <TicketModal order={ticketOrder} onClose={() => setTicketId("")} />
      )}
    </>
  );
}
