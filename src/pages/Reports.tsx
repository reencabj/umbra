import { useMemo, useState } from "react";
import {
  Copy,
  Download,
  FileSpreadsheet,
  FileText,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { useApp } from "../state";
import { today, money, report } from "../lib/domain";
import { csv, excel } from "../lib/export";
import { PageTitle, copy, errorMessage } from "../components/ui";
export default function Reports() {
  const { data: d } = useApp();
  const data = d!;
  const [date, setDate] = useState(today());
  const [filter, setFilter] = useState("all");
  const [generated, setGenerated] = useState({ date: today(), filter: "all" });
  const r = useMemo(
    () =>
      report(
        generated.date,
        data.orders,
        data.items,
        data.contacts,
        data.organizations,
        data.settings,
        generated.filter,
      ),
    [generated, data],
  );
  const items = data.items.filter((i) =>
    r.billed.some((o) => o.id === i.order_id),
  );
  const grouped = items.reduce<
    Record<string, { name: string; quantity: number; subtotal: number }>
  >((a, i) => {
    const key = i.product_id;
    a[key] ??= { name: i.product_name, quantity: 0, subtotal: 0 };
    a[key].quantity += i.quantity;
    a[key].subtotal += i.quantity * i.unit_price;
    return a;
  }, {});
  const exportExcel = async () => {
    try {
      await excel(r.selected, data.items, "ventas-" + generated.date);
      toast.success("Excel descargado");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  return (
    <>
      <PageTitle
        title="Reportes"
        description="Cierre diario listo para Discord y exportaciones con detalle de ventas."
      />
      <section className="panel report-controls">
        <div>
          <label className="label" htmlFor="report-date">
            Fecha del cierre
          </label>
          <input
            id="report-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="report-payment">
            Método de pago
          </label>
          <select
            id="report-payment"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">Blanco y Negro</option>
            <option value="white">Blanco</option>
            <option value="black">Negro</option>
          </select>
        </div>
        <button
          className="btn primary"
          disabled={!date}
          onClick={() => setGenerated({ date, filter })}
        >
          <FileText size={17} />
          Generar reporte
          <ArrowRight size={16} />
        </button>
      </section>
      <div className="stats-grid">
        <div className="stat-card">
          <span>Facturación blanca</span>
          <strong>{money(r.white)}</strong>
        </div>
        <div className="stat-card">
          <span>Subtotal negro</span>
          <strong>{money(r.black)}</strong>
        </div>
        <div className="stat-card">
          <span>Lavado cobrado</span>
          <strong>{money(r.washing)}</strong>
        </div>
        <div className="stat-card">
          <span>Total del día</span>
          <strong className="text-green">{money(r.total)}</strong>
        </div>
      </div>
      <div className="report-layout">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Mensaje para Discord</h2>
              <p>
                {r.selected.length} pedidos ·{" "}
                {generated.date.split("-").reverse().join("/")}
              </p>
            </div>
            <button className="btn small" onClick={() => void copy(r.text)}>
              <Copy size={14} />
              Copiar reporte
            </button>
          </div>
          <pre className="report-preview">{r.text}</pre>
        </section>
        <div className="form-stack">
          <section className="panel">
            <div className="panel-heading">
              <h2>Exportar datos</h2>
            </div>
            <div className="export-buttons">
              <button
                className="btn"
                onClick={() =>
                  csv(r.selected, data.items, "ventas-" + generated.date)
                }
              >
                <Download size={17} />
                Descargar CSV
              </button>
              <button className="btn" onClick={() => void exportExcel()}>
                <FileSpreadsheet size={17} />
                Descargar Excel
              </button>
            </div>
          </section>
          <section className="panel">
            <div className="panel-heading">
              <h2>Resumen de productos</h2>
            </div>
            <div className="quota-list padded">
              {Object.values(grouped).map((i) => (
                <div key={i.name}>
                  <span>
                    {i.quantity} × {i.name}
                  </span>
                  <b>{money(i.subtotal)}</b>
                </div>
              ))}
              {!items.length && (
                <p className="muted">
                  Sin unidades facturadas para esta fecha.
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
