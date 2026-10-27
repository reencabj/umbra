import { useState } from "react";
import { Link } from "react-router-dom";
import { Copy, Eye, Plus, Pencil, Ban } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "../state";
import { money, dateTime, ticket } from "../lib/domain";
import { statusLabel } from "../lib/types";
import type { Order } from "../lib/types";
import { rpc } from "../lib/supabase";
import {
  Badge,
  Empty,
  Modal,
  PageTitle,
  SearchBox,
  TicketModal,
  copy,
  errorMessage,
} from "../components/ui";
export default function Orders() {
  const { data: d, reload, profile } = useApp();
  const data = d!;
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("date");
  const [selected, setSelected] = useState<Order | null>(null);
  const [cancel, setCancel] = useState<Order | null>(null);
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(0);
  const all = data.orders
    .filter(
      (o) =>
        o.organization_name.toLowerCase().includes(search.toLowerCase()) &&
        (!from || o.business_date >= from) &&
        (!to || o.business_date <= to) &&
        (status === "all" || o.status === status),
    )
    .sort((a, b) =>
      sort === "total"
        ? b.total - a.total
        : b.business_date.localeCompare(a.business_date) || b.number - a.number,
    );
  const cancelOrder = async () => {
    if (!cancel) return;
    setBusy(true);
    try {
      await rpc("cancel_order", { p_id: cancel.id, p_version: cancel.version });
      await reload();
      setCancel(null);
      toast.success("Pedido anulado. Cupo semanal liberado.");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageTitle
        title="Pedidos"
        action={
          <Link className="btn primary" to="/sales">
            <Plus size={17} />
            Nueva venta
          </Link>
        }
      />
      <section className="panel">
        <div className="toolbar">
          <SearchBox
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(0);
            }}
            placeholder="Buscar organización…"
          />
          <input
            aria-label="Desde"
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(0);
            }}
          />
          <input
            aria-label="Hasta"
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(0);
            }}
          />
          <select
            aria-label="Filtrar estado"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(0);
            }}
          >
            <option value="all">Todos los estados</option>
            {Object.entries(statusLabel).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <select
            aria-label="Ordenar pedidos"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="date">Más recientes</option>
            <option value="total">Mayor importe</option>
          </select>
        </div>
        {!all.length ? (
          <Empty />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Fecha</th>
                  <th>Organización</th>
                  <th>Pago</th>
                  <th>Importe</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {all.slice(page * 25, page * 25 + 25).map((o) => (
                  <tr key={o.id}>
                    <td className="mono">
                      #{String(o.number).padStart(5, "0")}
                      {o.historical && (
                        <small className="block">Importado</small>
                      )}
                    </td>
                    <td>{dateTime(o)}</td>
                    <td>
                      <b>{o.organization_name}</b>
                    </td>
                    <td>
                      <span className={"money-type " + o.payment}>
                        {o.payment === "white" ? "Blanco" : "Negro"}
                      </span>
                    </td>
                    <td className="amount">{money(o.total)}</td>
                    <td>
                      <Badge status={o.status} />
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="icon-button"
                          title="Ver comprobante"
                          onClick={() => setSelected(o)}
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          className="icon-button"
                          title="Copiar ticket"
                          onClick={() =>
                            void copy(
                              ticket(
                                o,
                                data.items.filter((i) => i.order_id === o.id),
                                data.settings,
                                data.settings.ticket_compact,
                              ),
                            )
                          }
                        >
                          <Copy size={15} />
                        </button>
                        <Link
                          title="Duplicar pedido"
                          className="icon-button"
                          to={`/sales?duplicate=${o.id}`}
                        >
                          <Plus size={16} />
                        </Link>
                        {o.status !== "cancelled" &&
                          (!o.historical || profile?.role === "admin") && (
                            <Link
                              title="Editar pedido"
                              className="icon-button"
                              to={`/sales?edit=${o.id}`}
                            >
                              <Pencil size={15} />
                            </Link>
                          )}
                        {o.status !== "cancelled" && (
                          <button
                            className="icon-button danger"
                            title="Anular pedido"
                            onClick={() => setCancel(o)}
                          >
                            <Ban size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="pagination">
          <span>{all.length} pedidos</span>
          <div>
            <button
              className="btn small"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
            >
              Anterior
            </button>
            <span>
              {page + 1} / {Math.max(1, Math.ceil(all.length / 25))}
            </span>
            <button
              className="btn small"
              disabled={(page + 1) * 25 >= all.length}
              onClick={() => setPage(page + 1)}
            >
              Siguiente
            </button>
          </div>
        </div>
      </section>
      {selected && (
        <TicketModal order={selected} onClose={() => setSelected(null)} />
      )}{" "}
      {cancel && (
        <Modal
          title={`Anular pedido #${cancel.number}`}
          onClose={() => !busy && setCancel(null)}
        >
          <p>
            El pedido de <b>{cancel.organization_name}</b> por{" "}
            {money(cancel.total)} permanecerá en el historial como anulado. Se
            liberará el cupo semanal consumido por la organización.
          </p>
          <div className="modal-actions">
            <button
              className="btn"
              onClick={() => setCancel(null)}
              disabled={busy}
            >
              Volver
            </button>
            <button
              className="btn danger-btn"
              onClick={() => void cancelOrder()}
              disabled={busy}
            >
              {busy ? "Anulando…" : "Anular pedido"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
