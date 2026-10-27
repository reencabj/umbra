import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Plus,
  ArrowUpRight,
  DollarSign,
  ShoppingBag,
  Users,
  ReceiptText,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { fromZonedTime } from "date-fns-tz";
import { useApp } from "../state";
import { today, money, billable, weekWindow, localDate } from "../lib/domain";
import type { Order } from "../lib/types";
import { PageTitle, Badge, Empty, TicketModal } from "../components/ui";
export default function Dashboard() {
  const { data: d } = useApp();
  const data = d!;
  const [period, setPeriod] = useState("week");
  const [ticket, setTicket] = useState<Order | null>(null);
  const date = today();
  const window = weekWindow(data.settings);
  const valid = data.orders.filter(billable);
  const day = valid.filter((o) => o.business_date === date);
  const week = valid.filter((o) => {
    const at = o.occurred_at
      ? new Date(o.occurred_at)
      : fromZonedTime(o.business_date + "T00:00:00", data.settings.timezone);
    return at >= window.start && at < window.end;
  });
  const month = valid.filter(
    (o) => o.business_date.slice(0, 7) === date.slice(0, 7),
  );
  const sum = (os: Order[]) => os.reduce((a, o) => a + o.total, 0);
  const grouped: Record<string, number> = {};
  for (let i = period === "week" ? 6 : 29; i >= 0; i--) {
    const dayDate = new Date(date + "T12:00:00Z");
    dayDate.setUTCDate(dayDate.getUTCDate() - i);
    grouped[dayDate.toISOString().slice(0, 10)] = 0;
  }
  for (const o of valid)
    if (o.business_date in grouped) grouped[o.business_date] += o.total;
  const selected = valid.filter((o) => o.business_date in grouped);
  const chart = Object.entries(grouped).map(([date, total]) => ({
    date: localDate(date).slice(0, 5),
    total,
  }));
  const white = sum(selected.filter((o) => o.payment === "white"));
  const black = sum(selected.filter((o) => o.payment === "black"));
  const rank = data.organizations
    .map((o) => ({
      ...o,
      total: sum(selected.filter((x) => x.organization_id === o.id)),
    }))
    .filter((o) => o.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);
  const sold = data.items.filter((i) =>
    selected.some((o) => o.id === i.order_id),
  );
  const top = data.products
    .map((p) => ({
      name: p.name,
      quantity: sold
        .filter((i) => i.product_id === p.id)
        .reduce((a, i) => a + i.quantity, 0),
    }))
    .filter((p) => p.quantity)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);
  const recent = [...data.orders]
    .sort((a, b) => b.number - a.number)
    .slice(0, 6);
  return (
    <>
      <PageTitle
        title="Dashboard"
        description="Una visión clara de tus operaciones, en tiempo real."
        action={
          <Link className="btn primary" to="/sales">
            <Plus size={17} />
            Nueva venta
          </Link>
        }
      />
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-top">
            <span>Facturación del día</span>
            <DollarSign size={18} />
          </div>
          <strong>{money(sum(day))}</strong>
          <small>{day.length} ventas facturadas hoy</small>
        </div>
        <div className="stat-card">
          <div className="stat-top">
            <span>Ventas de la semana</span>
            <ShoppingBag size={18} />
          </div>
          <strong>{money(sum(week))}</strong>
          <small>{week.length} pedidos confirmados o entregados</small>
        </div>
        <div className="stat-card">
          <div className="stat-top">
            <span>Facturación del mes</span>
            <ReceiptText size={18} />
          </div>
          <strong>{money(sum(month))}</strong>
          <small>{month.length} pedidos facturados</small>
        </div>
        <div className="stat-card">
          <div className="stat-top">
            <span>Organizaciones atendidas</span>
            <Users size={18} />
          </div>
          <strong>
            {new Set(week.map((o) => o.organization_id)).size}
            <em>/ {data.organizations.length}</em>
          </strong>
          <small>
            {
              data.organizations.filter((o) => o.contact_status === "Pendiente")
                .length
            }{" "}
            pendientes de contacto
          </small>
        </div>
      </div>
      <div className="chart-layout">
        <section className="panel revenue-panel">
          <div className="panel-heading">
            <div>
              <h2>Facturación diaria</h2>
              <p>Evolución de ingresos registrados</p>
            </div>
            <div className="segmented small">
              <button
                className={period === "week" ? "selected" : ""}
                onClick={() => setPeriod("week")}
              >
                7 días
              </button>
              <button
                className={period === "month" ? "selected" : ""}
                onClick={() => setPeriod("month")}
              >
                30 días
              </button>
            </div>
          </div>
          <div className="chart-area">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chart}
                margin={{ top: 15, right: 14, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="revenue-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00db8b" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#00db8b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  vertical={false}
                  stroke="#242b31"
                  strokeDasharray="3 4"
                />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#7d8996", fontSize: 11 }}
                  minTickGap={35}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#7d8996", fontSize: 11 }}
                  tickFormatter={(v) =>
                    v >= 1000000
                      ? `${v / 1000000}M`
                      : v >= 1000
                        ? `${v / 1000}k`
                        : v
                  }
                />
                <Tooltip
                  contentStyle={{
                    background: "#171d23",
                    border: "1px solid #303942",
                    borderRadius: 8,
                  }}
                  formatter={(v) => money(Number(v))}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="#00db8b"
                  strokeWidth={2.5}
                  fill="url(#revenue-fill)"
                  name="Facturación"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Métodos de pago</h2>
              <p>Total final por tipo de dinero</p>
            </div>
          </div>
          {white + black > 0 ? (
            <>
              <div className="donut">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Blanco", value: white },
                        { name: "Negro", value: black },
                      ]}
                      innerRadius={64}
                      outerRadius={84}
                      paddingAngle={4}
                      dataKey="value"
                      stroke="none"
                    >
                      <Cell fill="#00db8b" />
                      <Cell fill="#5e7185" />
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "#171d23",
                        border: "1px solid #303942",
                      }}
                      formatter={(v) => money(Number(v))}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div>
                  <small>Total facturado</small>
                  <strong>{money(white + black)}</strong>
                </div>
              </div>
              <div className="payment-legend">
                <span>
                  <i />
                  Blanco<b>{money(white)}</b>
                </span>
                <span>
                  <i />
                  Negro<b>{money(black)}</b>
                </span>
              </div>
            </>
          ) : (
            <Empty
              title="Sin facturación"
              description="El gráfico aparecerá al confirmar ventas."
            />
          )}
        </section>
      </div>
      <div className="mini-stats">
        <div>
          <span>Pedidos registrados</span>
          <b>{data.orders.length}</b>
        </div>
        <div>
          <span>Ticket promedio</span>
          <b>
            {money(
              selected.length ? Math.round(sum(selected) / selected.length) : 0,
            )}
          </b>
        </div>
        <div>
          <span>Unidades vendidas</span>
          <b>
            {sold.reduce((a, i) => a + i.quantity, 0).toLocaleString("es-AR")}
          </b>
        </div>
        <div>
          <span>Pedidos pendientes</span>
          <b>{data.orders.filter((o) => o.status === "pending").length}</b>
        </div>
      </div>
      <div className="chart-layout">
        <section className="panel">
          <div className="panel-heading">
            <h2>Pedidos recientes</h2>
            <Link className="text-link" to="/orders">
              Ver todos
              <ArrowUpRight size={15} />
            </Link>
          </div>
          {!recent.length ? (
            <Empty
              title="Tu primera venta empieza acá"
              description="Creá una organización y cargá stock para registrar el primer pedido."
            />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Pedido</th>
                    <th>Organización</th>
                    <th>Fecha</th>
                    <th>Total</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((o) => (
                    <tr
                      key={o.id}
                      className="clickable"
                      onClick={() => setTicket(o)}
                    >
                      <td className="mono">
                        #{String(o.number).padStart(5, "0")}
                      </td>
                      <td>
                        <b>{o.organization_name}</b>
                      </td>
                      <td>{localDate(o.business_date)}</td>
                      <td className="amount">{money(o.total)}</td>
                      <td>
                        <Badge status={o.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>Ranking de organizaciones</h2>
          </div>
          <div className="ranking">
            {rank.length ? (
              rank.map((o, i) => (
                <div key={o.id}>
                  <span className="rank-number">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span>{o.name}</span>
                  <b>{money(o.total)}</b>
                </div>
              ))
            ) : (
              <Empty title="Sin actividad en el período" />
            )}
          </div>
        </section>
      </div>
      <section className="panel top-products">
        <div className="panel-heading">
          <h2>Productos más vendidos</h2>
          <span className="muted">Unidades del período</span>
        </div>
        <div className="top-product-list">
          {top.length ? (
            top.map((p) => (
              <div key={p.name}>
                <span>{p.name}</span>
                <b>{p.quantity.toLocaleString("es-AR")}</b>
                <div className="progress">
                  <i
                    style={{
                      width: (p.quantity / top[0].quantity) * 100 + "%",
                    }}
                  />
                </div>
              </div>
            ))
          ) : (
            <p className="muted">Todavía no hay unidades facturadas.</p>
          )}
        </div>
      </section>
      {ticket && <TicketModal order={ticket} onClose={() => setTicket(null)} />}
    </>
  );
}
