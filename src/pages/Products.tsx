import { useState } from "react";
import { Plus, Pencil, ImagePlus, Archive } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "../state";
import type { Product } from "../lib/types";
import { db, rpc } from "../lib/supabase";
import { money } from "../lib/domain";
import { optimizePhoto } from "../lib/export";
import {
  PageTitle,
  SearchBox,
  Photo,
  Modal,
  Field,
  Submit,
  errorMessage,
} from "../components/ui";
export default function Products() {
  const { data: d, profile, reload } = useApp();
  const data = d!;
  const admin = profile?.role === "admin";
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [edit, setEdit] = useState<Product | null | undefined>(undefined);
  return (
    <>
      <PageTitle
        title="Productos"
        action={
          admin && (
            <button className="btn primary" onClick={() => setEdit(null)}>
              <Plus size={17} />
              Crear producto
            </button>
          )
        }
      />
      <section className="panel">
        <div className="toolbar">
          <SearchBox
            value={search}
            onChange={setSearch}
            placeholder="Buscar producto…"
          />
          <label className="check">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />{" "}
            Mostrar archivados
          </label>
          <span className="muted push">
            {data.products.filter((p) => !p.archived).length} productos en
            catálogo
          </span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Categoría</th>
                <th>Precio blanco</th>
                <th>Precio negro</th>
                <th>Estado</th>
                {admin && <th>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {data.products
                .filter(
                  (p) =>
                    (showArchived || !p.archived) &&
                    p.name.toLowerCase().includes(search.toLowerCase()),
                )
                .map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div className="product-cell">
                        <Photo path={p.image_path} name={p.name} />
                        <div>
                          <b>{p.name}</b>
                          <small>{p.description || "Sin descripción"}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      {
                        data.categories.find((c) => c.id === p.category_id)
                          ?.name
                      }
                    </td>
                    <td className="amount">
                      {money(
                        data.prices.find((v) => v.product_id === p.id)?.white ||
                          0,
                      )}
                    </td>
                    <td className="amount">
                      {money(
                        data.prices.find((v) => v.product_id === p.id)?.black ||
                          0,
                      )}
                    </td>
                    <td>
                      <span
                        className={
                          "badge " +
                          (p.active && !p.archived ? "delivered" : "cancelled")
                        }
                      >
                        {p.archived
                          ? "Archivado"
                          : p.active
                            ? "Activo"
                            : "Inactivo"}
                      </span>
                    </td>
                    {admin && (
                      <td>
                        <button
                          className="btn small"
                          onClick={() => setEdit(p)}
                        >
                          <Pencil size={14} />
                          Editar
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
      {edit !== undefined && (
        <ProductEditor
          product={edit}
          onClose={() => setEdit(undefined)}
          onSaved={async () => {
            await reload();
            setEdit(undefined);
          }}
        />
      )}
    </>
  );
}
function ProductEditor({
  product: p,
  onClose,
  onSaved,
}: {
  product: Product | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { data } = useApp();
  const price = data!.prices.find((v) => v.product_id === p?.id);
  const [name, setName] = useState(p?.name || "");
  const [description, setDescription] = useState(p?.description || "");
  const [category, setCategory] = useState(
    p?.category_id || data!.categories[0]?.id || "",
  );
  const [white, setWhite] = useState(price?.white || 0);
  const [black, setBlack] = useState(price?.black || 0);
  const [active, setActive] = useState(p?.active ?? true);
  const [archived, setArchived] = useState(p?.archived ?? false);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState("");
  const [removePhoto, setRemovePhoto] = useState(false);
  const [busy, setBusy] = useState(false);
  const choose = async (file: File) => {
    try {
      const image = await optimizePhoto(file);
      if (preview) URL.revokeObjectURL(preview);
      setPhoto(image);
      setPreview(URL.createObjectURL(image));
      setRemovePhoto(false);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    let uploaded = "";
    try {
      let path = removePhoto ? null : p?.image_path || null;
      if (photo) {
        uploaded = `products/${crypto.randomUUID()}.webp`;
        const { error } = await db.storage
          .from("product-photos")
          .upload(uploaded, photo, {
            contentType: "image/webp",
            cacheControl: "3600",
          });
        if (error) throw error;
        path = uploaded;
      }
      await rpc("save_product", {
        p: {
          id: p?.id,
          name: name.trim(),
          description,
          category_id: category,
          white,
          black,
          image_path: path,
          low_stock: p?.low_stock ?? 5,
          active: active && !archived,
          archived,
        },
      });
      if (p?.image_path && path !== p.image_path)
        await db.storage.from("product-photos").remove([p.image_path]);
      toast.success("Producto guardado");
      await onSaved();
    } catch (e) {
      if (uploaded) await db.storage.from("product-photos").remove([uploaded]);
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title={p ? "Editar producto" : "Crear producto"}
      onClose={() => !busy && onClose()}
    >
      <form onSubmit={(e) => void save(e)} className="form-stack">
        <Field label="Nombre">
          <input
            required
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="Descripción">
          <textarea
            value={description}
            maxLength={1000}
            rows={2}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        <Field label="Categoría">
          <select
            required
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {data!.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="form-grid">
          <Field label="Precio blanco">
            <input
              type="number"
              min="0"
              max="1000000000"
              step="1"
              required
              value={white}
              onChange={(e) => setWhite(Number(e.target.value))}
            />
          </Field>
          <Field label="Precio negro (sin lavado)">
            <input
              type="number"
              min="0"
              max="1000000000"
              step="1"
              required
              value={black}
              onChange={(e) => setBlack(Number(e.target.value))}
            />
          </Field>
        </div>
        <div className="photo-editor">
          {preview ? (
            <img src={preview} alt="Vista previa" />
          ) : !removePhoto ? (
            <Photo path={p?.image_path || null} name={name} />
          ) : (
            <ImagePlus size={30} />
          )}
          <div>
            <label className="btn small">
              <ImagePlus size={16} />
              {p?.image_path ? "Cambiar foto" : "Subir foto"}
              <input
                aria-label="Fotografía del producto"
                className="sr-only"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void choose(f);
                }}
              />
            </label>
            <small>JPG, PNG o WebP · optimización automática</small>
            {(preview || p?.image_path) && (
              <button
                type="button"
                className="text-link danger"
                onClick={() => {
                  setPhoto(null);
                  setPreview("");
                  setRemovePhoto(true);
                }}
              >
                Quitar fotografía
              </button>
            )}
          </div>
        </div>
        <div className="toolbar">
          <label className="check">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />
            Activo
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={archived}
              onChange={(e) => setArchived(e.target.checked)}
            />
            <Archive size={15} /> Archivado
          </label>
        </div>
        <p className="hint">
          La disponibilidad de UMBRA es ilimitada. Archivar conserva todas las
          ventas históricas.
        </p>
        <div className="modal-actions">
          <button
            type="button"
            className="btn"
            onClick={onClose}
            disabled={busy}
          >
            Cancelar
          </button>
          <Submit busy={busy} />
        </div>
      </form>
    </Modal>
  );
}
