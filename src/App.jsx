import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { supabase } from "./supabaseClient";

const CATEGORIAS = [
  { id: "relojes", label: "Relojes", icon: "⌚" },
  { id: "anillos", label: "Anillos", icon: "💍" },
  { id: "pulseras", label: "Pulseras", icon: "📿" },
  { id: "collares", label: "Collares", icon: "🪬" },
  { id: "colgantes", label: "Colgantes", icon: "✨" },
  { id: "broches", label: "Broches", icon: "🔮" },
  { id: "aros", label: "Aros", icon: "🌀" },
  { id: "cadenas", label: "Cadenas", icon: "⛓️" },
  { id: "muebles", label: "Muebles", icon: "🪑" },
  { id: "mesas", label: "Mesas", icon: "🪵" },
  { id: "espejos", label: "Espejos", icon: "🪞" },
  { id: "lamparas", label: "Lámparas", icon: "🪔" },
  { id: "alfombras", label: "Alfombras", icon: "🟫" },
  { id: "cuadros", label: "Cuadros", icon: "🖼️" },
  { id: "vajilla", label: "Vajilla", icon: "🏺" },
  { id: "relojes_pared", label: "Relojes de pared", icon: "🕰️" },
  { id: "esculturas", label: "Esculturas", icon: "🗿" },
  { id: "monedas", label: "Monedas", icon: "🪙" },
  { id: "libros", label: "Libros antiguos", icon: "📚" },
  { id: "otros", label: "Otros", icon: "📦" },
];

const METODOS_PAGO = [
  { id: "efectivo", label: "Efectivo", icon: "💵" },
  { id: "transferencia", label: "Transferencia", icon: "🏦" },
  { id: "cheque", label: "Cheque", icon: "📄" },
];

const BUCKET = "fotos-productos";
const MAX_PHOTO_MB = 5;
const MAX_PHOTOS = 4;
const FETCH_LIMIT = 500;
const STALE_DAYS = 90;

function formatCurrency(n) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n || 0);
}
function formatDate(d) {
  if (!d) return "—";
  const p = d.split("-");
  return `${p[2]}/${p[1]}/${p[0]}`;
}
function monthLabelFull(key) {
  const names = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const [yyyy, mm] = key.split("-");
  return `${names[parseInt(mm) - 1]} ${yyyy}`;
}
function getCat(id) {
  return CATEGORIAS.find((c) => c.id === id) || { label: "Otros", icon: "📦" };
}
function getMetodo(id) {
  return METODOS_PAGO.find((m) => m.id === id);
}
function normalize(s) {
  return (s || "").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function isStorageUrl(url) {
  return typeof url === "string" && url.includes(`/storage/v1/object/public/${BUCKET}/`);
}
function storagePathFromUrl(url) {
  const marker = `/${BUCKET}/`;
  const i = url.indexOf(marker);
  return i === -1 ? null : url.slice(i + marker.length);
}
function staleDays(item) {
  if (item.fecha_venta || !item.fecha_compra) return 0;
  const diff = Date.now() - new Date(item.fecha_compra + "T00:00:00").getTime();
  return Math.floor(diff / 86400000);
}
function firstPhoto(item) {
  return item.fotos_urls && item.fotos_urls.length > 0 ? item.fotos_urls[0] : "";
}

function StatusBadge({ sold }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 20, background: sold ? "#EAF3DE" : "#E6F1FB", color: sold ? "#3B6D11" : "#185FA5", whiteSpace: "nowrap" }}>
      {sold ? "Vendido" : "En stock"}
    </span>
  );
}

function StaleChip({ days }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 6, background: "#FFF1E0", color: "#A35B0A", whiteSpace: "nowrap" }}>
      🐌 {days}d
    </span>
  );
}

function Spinner({ small }) {
  const size = small ? 18 : 32;
  return (
    <div style={{ textAlign: "center", padding: small ? 0 : "3rem" }}>
      <div style={{ width: size, height: size, border: `${small ? 2 : 3}px solid #F1EFE8`, borderTop: `${small ? 2 : 3}px solid #1D9E75`, borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: small ? 0 : "0 auto 12px", display: "inline-block" }} />
      {!small && <p style={{ fontSize: 14, color: "#888780" }}>Cargando...</p>}
    </div>
  );
}

function Toast({ toast, onClose }) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!toast) return;
    const duration = toast.action ? 7000 : 3000;
    const t = setTimeout(() => closeRef.current(), duration);
    return () => clearTimeout(t);
  }, [toast]);
  if (!toast) return null;
  return (
    <div style={{ position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)", background: toast.type === "error" ? "#A32D2D" : "#1D9E75", color: "#fff", padding: "10px 14px", borderRadius: 12, fontSize: 14, fontWeight: 500, zIndex: 100, maxWidth: "90vw", display: "flex", alignItems: "center", gap: 10, animation: "fadeIn 0.2s ease" }}>
      <span>{toast.message}</span>
      {toast.action && (
        <button onClick={() => { toast.action.onClick(); closeRef.current(); }} style={{ background: "rgba(255,255,255,0.2)", color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
          {toast.action.label}
        </button>
      )}
    </div>
  );
}

function Modal({ open, title, message, confirmText = "Confirmar", cancelText = "Cancelar", danger, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div onClick={onCancel} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20, animation: "fadeIn 0.15s ease" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, padding: 20, maxWidth: 360, width: "100%" }}>
        <h3 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 8px", color: "#2C2C2A" }}>{title}</h3>
        {message && <p style={{ fontSize: 14, color: "#5F5E5A", margin: "0 0 18px", lineHeight: 1.5 }}>{message}</p>}
        <div style={{ display: "flex", gap: 8 }}>
          {onCancel && (
            <button onClick={onCancel} style={{ flex: 1, background: "#F7F6F3", color: "#2C2C2A", border: "none", borderRadius: 12, padding: "12px 0", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", minHeight: 44 }}>{cancelText}</button>
          )}
          <button onClick={onConfirm} style={{ flex: 1, background: danger ? "#A32D2D" : "#1D9E75", color: "#fff", border: "none", borderRadius: 12, padding: "12px 0", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", minHeight: 44 }}>{confirmText}</button>
        </div>
      </div>
    </div>
  );
}

const inp = { width: "100%", boxSizing: "border-box", padding: "12px 14px", fontSize: 16, border: "1px solid #D3D1C7", borderRadius: 12, background: "#fff", color: "#2C2C2A", outline: "none", fontFamily: "inherit", WebkitAppearance: "none", appearance: "none", minHeight: 44 };

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#5F5E5A", marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  );
}

function CategoryPicker({ value, onChange }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#5F5E5A", marginBottom: 8 }}>Categoría</label>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
        {CATEGORIAS.map((c) => (
          <button key={c.id} type="button" onClick={() => onChange(c.id)} style={{
            background: value === c.id ? "#E1F5EE" : "#F7F6F3",
            border: value === c.id ? "2px solid #1D9E75" : "2px solid transparent",
            borderRadius: 10, padding: "8px 4px", cursor: "pointer",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
            fontFamily: "inherit",
          }}>
            <span style={{ fontSize: 20 }}>{c.icon}</span>
            <span style={{ fontSize: 9, fontWeight: 600, color: value === c.id ? "#0F6E56" : "#888780", textAlign: "center", lineHeight: 1.2 }}>{c.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function MultiPhotoUpload({ photos, onChange, onError }) {
  const ref = useRef();
  const [uploading, setUploading] = useState(false);

  const upload = async (file) => {
    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext || "jpg"}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      onChange([...(photos || []), data.publicUrl]);
    } catch (err) {
      onError?.("Error subiendo foto: " + (err.message || "desconocido"));
    } finally {
      setUploading(false);
    }
  };

  const handle = (e) => {
    const f = e.target.files[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > MAX_PHOTO_MB * 1024 * 1024) {
      onError?.(`La foto no puede pesar más de ${MAX_PHOTO_MB} MB`);
      return;
    }
    upload(f);
  };

  const removeAt = async (idx) => {
    const url = photos[idx];
    if (url && isStorageUrl(url)) {
      const path = storagePathFromUrl(url);
      if (path) await supabase.storage.from(BUCKET).remove([path]);
    }
    onChange(photos.filter((_, i) => i !== idx));
  };

  const canAdd = (photos?.length || 0) < MAX_PHOTOS;

  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#5F5E5A", marginBottom: 8 }}>
        Fotos <span style={{ color: "#888780", fontWeight: 500 }}>({(photos?.length || 0)}/{MAX_PHOTOS})</span>
      </label>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
        {(photos || []).map((url, idx) => (
          <div key={idx} style={{ position: "relative", aspectRatio: "1", borderRadius: 10, overflow: "hidden", background: `url(${url}) center/cover no-repeat #F7F6F3` }}>
            <button type="button" onClick={() => removeAt(idx)} aria-label="Quitar foto" style={{ position: "absolute", top: 4, right: 4, background: "rgba(0,0,0,0.6)", color: "#fff", border: "none", borderRadius: "50%", width: 22, height: 22, fontSize: 14, lineHeight: 1, cursor: "pointer", fontFamily: "inherit", padding: 0 }}>×</button>
            {idx === 0 && <span style={{ position: "absolute", bottom: 4, left: 4, background: "rgba(0,0,0,0.6)", color: "#fff", borderRadius: 6, padding: "1px 6px", fontSize: 9, fontWeight: 600 }}>Principal</span>}
          </div>
        ))}
        {canAdd && (
          <div onClick={() => !uploading && ref.current.click()} style={{ aspectRatio: "1", borderRadius: 10, border: "2px dashed #D3D1C7", background: "#F7F6F3", display: "flex", alignItems: "center", justifyContent: "center", cursor: uploading ? "default" : "pointer", color: "#888780" }}>
            {uploading ? <Spinner small /> : <div style={{ textAlign: "center" }}><div style={{ fontSize: 22, lineHeight: 1 }}>+</div><div style={{ fontSize: 9, fontWeight: 600 }}>Foto</div></div>}
          </div>
        )}
      </div>
      <input ref={ref} type="file" accept="image/*" onChange={handle} style={{ display: "none" }} />
    </div>
  );
}

// ProductForm: solo datos del producto (sin venta). Se usa en "Nuevo" y "Editar" de Stock.
function ProductForm({ item, onSave, onDelete, saving, onRequestDelete, onError }) {
  const [f, setF] = useState({
    nombre: item?.nombre || "",
    descripcion: item?.descripcion || "",
    precio_compra: item?.precio_compra ?? "",
    ubicacion: item?.ubicacion || "",
    fecha_compra: item?.fecha_compra || "",
    fotos_urls: item?.fotos_urls || [],
    categoria: item?.categoria || "otros",
  });
  const s = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const handleSave = () => {
    if (!f.nombre.trim()) return onError("Ingresá un nombre para el producto");
    onSave({
      ...f,
      id: item?.id,
      precio_compra: Number(f.precio_compra) || 0,
      fecha_compra: f.fecha_compra || null,
      fotos_urls: f.fotos_urls || [],
    });
  };

  return (
    <div style={{ animation: "fadeIn 0.2s ease", paddingBottom: 30 }}>
      <MultiPhotoUpload photos={f.fotos_urls} onChange={(v) => s("fotos_urls", v)} onError={onError} />
      <Field label="Nombre del producto"><input style={inp} value={f.nombre} onChange={(e) => s("nombre", e.target.value)} placeholder="Ej: Reloj Longines 1940" /></Field>
      <CategoryPicker value={f.categoria} onChange={(v) => s("categoria", v)} />
      <Field label="Descripción"><textarea style={{ ...inp, minHeight: 65, resize: "vertical" }} value={f.descripcion} onChange={(e) => s("descripcion", e.target.value)} placeholder="Materiales, época, estado..." /></Field>
      <Field label="Precio de compra ($)"><input style={inp} type="number" inputMode="numeric" value={f.precio_compra} onChange={(e) => s("precio_compra", e.target.value)} placeholder="0" /></Field>
      <Field label="Ubicación"><input style={inp} value={f.ubicacion} onChange={(e) => s("ubicacion", e.target.value)} placeholder="Ej: Vitrina 3, Estante A" /></Field>
      <Field label="Fecha de compra"><input style={inp} type="date" value={f.fecha_compra} onChange={(e) => s("fecha_compra", e.target.value)} /></Field>
      <button disabled={saving} onClick={handleSave} style={{ width: "100%", background: saving ? "#9FE1CB" : "#1D9E75", color: "#fff", border: "none", borderRadius: 14, padding: "14px 0", fontSize: 16, fontWeight: 600, cursor: saving ? "default" : "pointer", marginTop: 8, minHeight: 48 }}>
        {saving ? "Guardando..." : item ? "Guardar cambios" : "Agregar a stock"}
      </button>
      {item && onDelete && (
        <button disabled={saving} onClick={() => onRequestDelete(item)} style={{ width: "100%", background: "#FCEBEB", color: "#A32D2D", border: "none", borderRadius: 14, padding: "14px 0", fontSize: 15, fontWeight: 600, cursor: "pointer", marginTop: 10, minHeight: 48 }}>
          Eliminar producto
        </button>
      )}
    </div>
  );
}

// SellForm: solo datos de venta. Se usa al "Marcar como vendido" y al "Editar venta".
function SellForm({ item, onSave, saving, onError, isEdit }) {
  const today = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState({
    fecha_venta: item?.fecha_venta || today,
    precio_venta: item?.precio_venta ?? "",
    comprador_nombre: item?.comprador_nombre || "",
    comprador_telefono: item?.comprador_telefono || "",
    metodo_pago: item?.metodo_pago || "efectivo",
    pago_nota: item?.pago_nota || "",
    cheque_banco: item?.cheque_banco || "",
    cheque_numero: item?.cheque_numero || "",
    cheque_monto: item?.cheque_monto ?? "",
    cheque_fecha_cobro: item?.cheque_fecha_cobro || "",
  });
  const s = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const handleSave = () => {
    if (!f.fecha_venta) return onError("Ingresá la fecha de venta");
    const precioVenta = Number(f.precio_venta) || 0;
    if (precioVenta <= 0) return onError("Ingresá el precio de venta");
    if (item.fecha_compra && f.fecha_venta < item.fecha_compra) {
      return onError("La fecha de venta no puede ser anterior a la de compra.");
    }
    if (f.metodo_pago === "cheque") {
      if (!f.cheque_banco.trim()) return onError("Ingresá el banco del cheque.");
      if (!f.cheque_fecha_cobro) return onError("Ingresá la fecha de cobro del cheque.");
    }
    onSave({
      id: item.id,
      fecha_venta: f.fecha_venta,
      precio_venta: precioVenta,
      comprador_nombre: f.comprador_nombre || null,
      comprador_telefono: f.comprador_telefono || null,
      metodo_pago: f.metodo_pago || "efectivo",
      pago_nota: f.metodo_pago === "transferencia" ? (f.pago_nota || null) : null,
      cheque_banco: f.metodo_pago === "cheque" ? (f.cheque_banco || null) : null,
      cheque_numero: f.metodo_pago === "cheque" ? (f.cheque_numero || null) : null,
      cheque_monto: f.metodo_pago === "cheque" && f.cheque_monto !== "" ? Number(f.cheque_monto) || 0 : null,
      cheque_fecha_cobro: f.metodo_pago === "cheque" ? (f.cheque_fecha_cobro || null) : null,
    });
  };

  const metodo = f.metodo_pago || "efectivo";

  return (
    <div style={{ animation: "fadeIn 0.2s ease", paddingBottom: 30 }}>
      <div style={{ background: "#F7F6F3", borderRadius: 12, padding: "10px 14px", marginBottom: 16, display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ width: 44, height: 44, minWidth: 44, borderRadius: 8, overflow: "hidden", background: firstPhoto(item) ? `url(${firstPhoto(item)}) center/cover no-repeat` : "#F1EFE8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
          {!firstPhoto(item) && getCat(item.categoria).icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 600, margin: 0, color: "#2C2C2A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.nombre}</p>
          <p style={{ fontSize: 12, color: "#888780", margin: "2px 0 0" }}>Compra: {formatCurrency(item.precio_compra)}</p>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label="Fecha de venta"><input style={inp} type="date" value={f.fecha_venta} onChange={(e) => s("fecha_venta", e.target.value)} /></Field>
        <Field label="Precio de venta ($)"><input style={inp} type="number" inputMode="numeric" value={f.precio_venta} onChange={(e) => s("precio_venta", e.target.value)} placeholder="0" /></Field>
      </div>
      <Field label="Comprador (opcional)"><input style={inp} value={f.comprador_nombre} onChange={(e) => s("comprador_nombre", e.target.value)} placeholder="Ej: Juan Pérez" /></Field>
      <Field label="Teléfono (opcional)"><input style={inp} type="tel" inputMode="tel" value={f.comprador_telefono} onChange={(e) => s("comprador_telefono", e.target.value)} placeholder="Ej: 11 5555 1234" /></Field>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#5F5E5A", marginBottom: 8 }}>Método de pago</label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: metodo !== "efectivo" ? 14 : 14 }}>
        {METODOS_PAGO.map((m) => (
          <button key={m.id} type="button" onClick={() => s("metodo_pago", m.id)} style={{
            background: metodo === m.id ? "#E1F5EE" : "#fff",
            border: metodo === m.id ? "2px solid #1D9E75" : "2px solid #D3D1C7",
            borderRadius: 10, padding: "10px 4px", cursor: "pointer",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
            fontFamily: "inherit",
          }}>
            <span style={{ fontSize: 20 }}>{m.icon}</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: metodo === m.id ? "#0F6E56" : "#5F5E5A" }}>{m.label}</span>
          </button>
        ))}
      </div>
      {metodo === "transferencia" && (
        <Field label="Referencia / nota (opcional)">
          <input style={inp} value={f.pago_nota} onChange={(e) => s("pago_nota", e.target.value)} placeholder="Ej: Operación 12345" />
        </Field>
      )}
      {metodo === "cheque" && (
        <>
          <Field label="Banco"><input style={inp} value={f.cheque_banco} onChange={(e) => s("cheque_banco", e.target.value)} placeholder="Ej: Galicia" /></Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Nº cheque"><input style={inp} value={f.cheque_numero} onChange={(e) => s("cheque_numero", e.target.value)} placeholder="0000123" /></Field>
            <Field label="Monto ($)"><input style={inp} type="number" inputMode="numeric" value={f.cheque_monto} onChange={(e) => s("cheque_monto", e.target.value)} placeholder="0" /></Field>
          </div>
          <Field label="Fecha de cobro"><input style={inp} type="date" value={f.cheque_fecha_cobro} onChange={(e) => s("cheque_fecha_cobro", e.target.value)} /></Field>
        </>
      )}
      <button disabled={saving} onClick={handleSave} style={{ width: "100%", background: saving ? "#9FE1CB" : "#1D9E75", color: "#fff", border: "none", borderRadius: 14, padding: "14px 0", fontSize: 16, fontWeight: 600, cursor: saving ? "default" : "pointer", marginTop: 8, minHeight: 48 }}>
        {saving ? "Guardando..." : isEdit ? "Guardar cambios de venta" : "Confirmar venta"}
      </button>
    </div>
  );
}

function ProductCard({ item, onClick }) {
  const profit = item.precio_venta ? Number(item.precio_venta) - Number(item.precio_compra) : null;
  const cat = getCat(item.categoria);
  const foto = firstPhoto(item);
  const stale = !item.fecha_venta ? staleDays(item) : 0;
  return (
    <div role="button" tabIndex={0} onClick={onClick} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }} style={{ display: "flex", gap: 12, padding: "12px 0", borderBottom: "1px solid #F1EFE8", cursor: "pointer", outline: "none" }}>
      <div style={{ width: 64, height: 64, minWidth: 64, borderRadius: 12, overflow: "hidden", background: foto ? `url(${foto}) center/cover no-repeat` : "#F7F6F3", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>
        {!foto && cat.icon}
      </div>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
          <p style={{ fontSize: 15, fontWeight: 600, margin: 0, color: "#2C2C2A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.nombre}</p>
          {item.fecha_venta ? (
            <span style={{ fontSize: 11, color: "#888780", whiteSpace: "nowrap" }}>{formatDate(item.fecha_venta)}</span>
          ) : (
            stale >= STALE_DAYS && <StaleChip days={stale} />
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "2px 0", flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, background: "#F1EFE8", color: "#5F5E5A", padding: "2px 7px", borderRadius: 6, fontWeight: 500 }}>{cat.icon} {cat.label}</span>
          {item.ubicacion && !item.fecha_venta && <span style={{ fontSize: 11, color: "#888780" }}>· {item.ubicacion}</span>}
          {item.fecha_venta && item.metodo_pago && <span style={{ fontSize: 11, color: "#888780" }}>· {getMetodo(item.metodo_pago)?.icon} {getMetodo(item.metodo_pago)?.label}</span>}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 2 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#2C2C2A" }}>
            {item.fecha_venta ? formatCurrency(item.precio_venta) : formatCurrency(item.precio_compra)}
          </span>
          {profit !== null && <span style={{ fontSize: 12, fontWeight: 600, color: profit >= 0 ? "#0F6E56" : "#A32D2D" }}>{profit >= 0 ? "+" : ""}{formatCurrency(profit)}</span>}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", color: "#D3D1C7", fontSize: 18 }}>›</div>
    </div>
  );
}

function StockStats({ items }) {
  const stats = useMemo(() => {
    const stock = items.filter((i) => !i.fecha_venta);
    const invertido = stock.reduce((s, i) => s + (Number(i.precio_compra) || 0), 0);
    const staleCount = stock.filter((i) => staleDays(i) >= STALE_DAYS).length;
    return { count: stock.length, invertido, staleCount };
  }, [items]);
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: stats.staleCount > 0 ? 8 : 16 }}>
        <div style={{ background: "#F7F6F3", borderRadius: 12, padding: "10px 12px" }}>
          <div style={{ fontSize: 11, color: "#888780", marginBottom: 2 }}>En stock</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#185FA5" }}>{stats.count}</div>
        </div>
        <div style={{ background: "#F7F6F3", borderRadius: 12, padding: "10px 12px" }}>
          <div style={{ fontSize: 11, color: "#888780", marginBottom: 2 }}>Invertido</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#854F0B" }}>{formatCurrency(stats.invertido)}</div>
        </div>
      </div>
      {stats.staleCount > 0 && (
        <div style={{ background: "#FFF1E0", border: "1px solid #F5D7B8", borderRadius: 12, padding: "10px 14px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 11, color: "#A35B0A", marginBottom: 2, fontWeight: 600 }}>🐌 Sin mover hace +{STALE_DAYS} días</div>
            <div style={{ fontSize: 12, color: "#A35B0A" }}>{stats.staleCount} {stats.staleCount === 1 ? "producto" : "productos"}</div>
          </div>
        </div>
      )}
    </>
  );
}

function SalesStats({ items, porMes, meses }) {
  const stats = useMemo(() => {
    const ganancia = items.reduce((s, i) => s + (Number(i.precio_venta) - Number(i.precio_compra)), 0);
    const today = new Date().toISOString().slice(0, 10);
    const chequesPend = items.filter((i) => i.metodo_pago === "cheque" && i.cheque_fecha_cobro && i.cheque_fecha_cobro >= today);
    const chequesMonto = chequesPend.reduce((s, i) => s + (Number(i.cheque_monto) || Number(i.precio_venta) || 0), 0);
    return { count: items.length, ganancia, chequesCount: chequesPend.length, chequesMonto };
  }, [items]);
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: stats.chequesCount > 0 ? 8 : 16 }}>
        <div style={{ background: "#F7F6F3", borderRadius: 12, padding: "10px 12px" }}>
          <div style={{ fontSize: 11, color: "#888780", marginBottom: 2 }}>Ventas (filtradas)</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#3B6D11" }}>{stats.count}</div>
        </div>
        <div style={{ background: "#F7F6F3", borderRadius: 12, padding: "10px 12px" }}>
          <div style={{ fontSize: 11, color: "#888780", marginBottom: 2 }}>Ganancia</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: stats.ganancia >= 0 ? "#0F6E56" : "#A32D2D" }}>{formatCurrency(stats.ganancia)}</div>
        </div>
      </div>
      {stats.chequesCount > 0 && (
        <div style={{ background: "#FFF7E6", border: "1px solid #F5E3B8", borderRadius: 12, padding: "10px 14px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 11, color: "#854F0B", marginBottom: 2, fontWeight: 600 }}>📄 Cheques por cobrar</div>
            <div style={{ fontSize: 12, color: "#854F0B" }}>{stats.chequesCount} {stats.chequesCount === 1 ? "cheque pendiente" : "cheques pendientes"}</div>
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#854F0B" }}>{formatCurrency(stats.chequesMonto)}</div>
        </div>
      )}
      {meses.length > 0 && (
        <details style={{ background: "#F7F6F3", borderRadius: 12, padding: "8px 12px", marginBottom: 16 }}>
          <summary style={{ fontSize: 13, fontWeight: 600, color: "#5F5E5A", cursor: "pointer", padding: "4px 0" }}>Ganancia por mes</summary>
          <div style={{ marginTop: 8 }}>
            {meses.slice(0, 12).map((m) => {
              const g = porMes[m].ganancia;
              return (
                <div key={m} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #EEE" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#2C2C2A" }}>{monthLabelFull(m)}</div>
                    <div style={{ fontSize: 10, color: "#888780", marginTop: 1 }}>{porMes[m].cantidad} {porMes[m].cantidad === 1 ? "venta" : "ventas"}</div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: g >= 0 ? "#0F6E56" : "#A32D2D" }}>{g >= 0 ? "+" : ""}{formatCurrency(g)}</div>
                </div>
              );
            })}
          </div>
        </details>
      )}
    </>
  );
}

function CategoryFilter({ value, onChange, items }) {
  const usedCats = useMemo(() => [...new Set(items.map((i) => i.categoria).filter(Boolean))], [items]);
  return (
    <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8, marginBottom: 8, scrollbarWidth: "none" }}>
      <button onClick={() => onChange("todos")} style={{ flexShrink: 0, background: value === "todos" ? "#1D9E75" : "#F7F6F3", color: value === "todos" ? "#fff" : "#5F5E5A", border: "none", borderRadius: 20, padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>Todas</button>
      {CATEGORIAS.filter((c) => usedCats.includes(c.id)).map((c) => (
        <button key={c.id} onClick={() => onChange(c.id)} style={{ flexShrink: 0, background: value === c.id ? "#1D9E75" : "#F7F6F3", color: value === c.id ? "#fff" : "#5F5E5A", border: "none", borderRadius: 20, padding: "7px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
          {c.icon} {c.label}
        </button>
      ))}
    </div>
  );
}

function StockAdvancedFilters({ filters, setFilters }) {
  const [open, setOpen] = useState(false);
  const active = filters.priceMin || filters.priceMax || filters.compraDesde || filters.compraHasta || filters.staleOnly;
  return (
    <div style={{ marginBottom: 12 }}>
      <button onClick={() => setOpen((v) => !v)} style={{ width: "100%", background: active ? "#E1F5EE" : "#F7F6F3", color: active ? "#0F6E56" : "#5F5E5A", border: "none", borderRadius: 10, padding: "8px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>Filtros avanzados{active ? " • activos" : ""}</span>
        <span>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{ background: "#F7F6F3", borderRadius: 12, padding: 12, marginTop: 6 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#5F5E5A", marginBottom: 4 }}>Precio compra</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
            <input type="number" inputMode="numeric" style={inp} placeholder="Desde ($)" value={filters.priceMin} onChange={(e) => setFilters({ ...filters, priceMin: e.target.value })} />
            <input type="number" inputMode="numeric" style={inp} placeholder="Hasta ($)" value={filters.priceMax} onChange={(e) => setFilters({ ...filters, priceMax: e.target.value })} />
          </div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#5F5E5A", marginBottom: 4 }}>Fecha de compra</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
            <input type="date" style={inp} value={filters.compraDesde} onChange={(e) => setFilters({ ...filters, compraDesde: e.target.value })} />
            <input type="date" style={inp} value={filters.compraHasta} onChange={(e) => setFilters({ ...filters, compraHasta: e.target.value })} />
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#5F5E5A", cursor: "pointer", marginBottom: active ? 10 : 0 }}>
            <input type="checkbox" checked={filters.staleOnly} onChange={(e) => setFilters({ ...filters, staleOnly: e.target.checked })} /> Solo sin mover hace +{STALE_DAYS} días
          </label>
          {active && (
            <button onClick={() => setFilters({ priceMin: "", priceMax: "", compraDesde: "", compraHasta: "", staleOnly: false })} style={{ width: "100%", background: "#fff", border: "1px solid #D3D1C7", borderRadius: 10, padding: "8px 0", fontSize: 12, fontWeight: 600, color: "#5F5E5A", cursor: "pointer", fontFamily: "inherit" }}>
              Limpiar filtros
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function VendidosFilters({ filters, setFilters, items }) {
  const [open, setOpen] = useState(false);
  const active = filters.ventaDesde || filters.ventaHasta || filters.metodo !== "todos" || filters.categoria !== "todos";
  const usedCats = useMemo(() => [...new Set(items.map((i) => i.categoria).filter(Boolean))], [items]);
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#5F5E5A", marginBottom: 4 }}>Venta desde</label>
          <input type="date" style={inp} value={filters.ventaDesde} onChange={(e) => setFilters({ ...filters, ventaDesde: e.target.value })} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#5F5E5A", marginBottom: 4 }}>Venta hasta</label>
          <input type="date" style={inp} value={filters.ventaHasta} onChange={(e) => setFilters({ ...filters, ventaHasta: e.target.value })} />
        </div>
      </div>
      <div style={{ marginBottom: 10 }}>
        <button onClick={() => setOpen((v) => !v)} style={{ width: "100%", background: (filters.metodo !== "todos" || filters.categoria !== "todos") ? "#E1F5EE" : "#F7F6F3", color: (filters.metodo !== "todos" || filters.categoria !== "todos") ? "#0F6E56" : "#5F5E5A", border: "none", borderRadius: 10, padding: "8px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Más filtros</span>
          <span>{open ? "▲" : "▼"}</span>
        </button>
        {open && (
          <div style={{ background: "#F7F6F3", borderRadius: 12, padding: 12, marginTop: 6 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#5F5E5A", marginBottom: 6 }}>Método de pago</label>
            <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
              <button onClick={() => setFilters({ ...filters, metodo: "todos" })} style={{ background: filters.metodo === "todos" ? "#1D9E75" : "#fff", color: filters.metodo === "todos" ? "#fff" : "#5F5E5A", border: "1px solid #D3D1C7", borderRadius: 20, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Todos</button>
              {METODOS_PAGO.map((m) => (
                <button key={m.id} onClick={() => setFilters({ ...filters, metodo: m.id })} style={{ background: filters.metodo === m.id ? "#1D9E75" : "#fff", color: filters.metodo === m.id ? "#fff" : "#5F5E5A", border: "1px solid #D3D1C7", borderRadius: 20, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                  {m.icon} {m.label}
                </button>
              ))}
            </div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#5F5E5A", marginBottom: 6 }}>Categoría</label>
            <div style={{ display: "flex", gap: 6, marginBottom: active ? 10 : 0, flexWrap: "wrap" }}>
              <button onClick={() => setFilters({ ...filters, categoria: "todos" })} style={{ background: filters.categoria === "todos" ? "#1D9E75" : "#fff", color: filters.categoria === "todos" ? "#fff" : "#5F5E5A", border: "1px solid #D3D1C7", borderRadius: 20, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Todas</button>
              {CATEGORIAS.filter((c) => usedCats.includes(c.id)).map((c) => (
                <button key={c.id} onClick={() => setFilters({ ...filters, categoria: c.id })} style={{ background: filters.categoria === c.id ? "#1D9E75" : "#fff", color: filters.categoria === c.id ? "#fff" : "#5F5E5A", border: "1px solid #D3D1C7", borderRadius: 20, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                  {c.icon} {c.label}
                </button>
              ))}
            </div>
            {active && (
              <button onClick={() => setFilters({ ventaDesde: "", ventaHasta: "", metodo: "todos", categoria: "todos" })} style={{ width: "100%", background: "#fff", border: "1px solid #D3D1C7", borderRadius: 10, padding: "8px 0", fontSize: 12, fontWeight: 600, color: "#5F5E5A", cursor: "pointer", fontFamily: "inherit" }}>
                Limpiar filtros
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function PhotoGallery({ photos, cat }) {
  const [active, setActive] = useState(0);
  if (!photos || photos.length === 0) {
    return <div style={{ width: "100%", height: 120, borderRadius: 16, background: "#F7F6F3", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 52, marginBottom: 16 }}>{cat.icon}</div>;
  }
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ width: "100%", height: 240, borderRadius: 16, overflow: "hidden", background: `url(${photos[active]}) center/cover no-repeat`, marginBottom: photos.length > 1 ? 8 : 0 }} />
      {photos.length > 1 && (
        <div style={{ display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none" }}>
          {photos.map((url, idx) => (
            <button key={idx} onClick={() => setActive(idx)} style={{ flexShrink: 0, width: 56, height: 56, borderRadius: 10, overflow: "hidden", background: `url(${url}) center/cover no-repeat`, border: idx === active ? "2px solid #1D9E75" : "2px solid transparent", cursor: "pointer", padding: 0 }} />
          ))}
        </div>
      )}
    </div>
  );
}

function DetailView({ item, onEditProduct, onMarkSold, onEditSale, onUnsell }) {
  const isSold = !!item.fecha_venta;
  const profit = isSold ? Number(item.precio_venta) - Number(item.precio_compra) : null;
  const cat = getCat(item.categoria);
  const photos = item.fotos_urls || [];

  const shareWhatsApp = () => {
    const price = item.precio_venta || item.precio_compra;
    const lines = [
      `*${item.nombre}*`,
      item.descripcion || "",
      price ? `Precio: ${formatCurrency(price)}` : "",
      photos[0] || "",
    ].filter(Boolean);
    const text = encodeURIComponent(lines.join("\n"));
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  return (
    <div style={{ animation: "fadeIn 0.2s ease", paddingBottom: 30 }}>
      <PhotoGallery photos={photos} cat={cat} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
        <h2 style={{ fontSize: 21, fontWeight: 700, margin: 0, color: "#2C2C2A", flex: 1 }}>{item.nombre}</h2>
        <StatusBadge sold={isSold} />
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, background: "#F1EFE8", color: "#5F5E5A", padding: "3px 10px", borderRadius: 8, fontWeight: 500 }}>{cat.icon} {cat.label}</span>
        {!isSold && staleDays(item) >= STALE_DAYS && <StaleChip days={staleDays(item)} />}
      </div>
      {item.descripcion && <p style={{ fontSize: 14, color: "#5F5E5A", margin: "0 0 16px", lineHeight: 1.5 }}>{item.descripcion}</p>}

      <div style={{ display: "grid", gridTemplateColumns: isSold ? "1fr 1fr" : "1fr", gap: 8, marginBottom: 10 }}>
        <div style={{ background: "#F7F6F3", borderRadius: 12, padding: "12px" }}>
          <div style={{ fontSize: 11, color: "#888780", marginBottom: 2 }}>Precio compra</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#2C2C2A" }}>{formatCurrency(item.precio_compra)}</div>
        </div>
        {isSold && (
          <div style={{ background: "#F7F6F3", borderRadius: 12, padding: "12px" }}>
            <div style={{ fontSize: 11, color: "#888780", marginBottom: 2 }}>Precio venta</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#1D9E75" }}>{formatCurrency(item.precio_venta)}</div>
          </div>
        )}
      </div>
      {profit !== null && (
        <div style={{ background: profit >= 0 ? "#EAF3DE" : "#FCEBEB", borderRadius: 12, padding: "10px 14px", display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: profit >= 0 ? "#3B6D11" : "#A32D2D" }}>{profit >= 0 ? "Ganancia" : "Pérdida"}</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: profit >= 0 ? "#3B6D11" : "#A32D2D" }}>{profit >= 0 ? "+" : ""}{formatCurrency(profit)}</span>
        </div>
      )}
      <div style={{ borderTop: "1px solid #F1EFE8", paddingTop: 12 }}>
        {[
          { label: "Ubicación", value: item.ubicacion },
          { label: "Fecha de compra", value: item.fecha_compra ? formatDate(item.fecha_compra) : null },
          { label: "Fecha de venta", value: item.fecha_venta ? formatDate(item.fecha_venta) : null },
        ].filter((r) => r.value).map((r) => (
          <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid #F7F6F3" }}>
            <span style={{ fontSize: 13, color: "#888780" }}>{r.label}</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: "#2C2C2A" }}>{r.value}</span>
          </div>
        ))}
      </div>

      {isSold && (item.comprador_nombre || item.comprador_telefono) && (
        <div style={{ marginTop: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: "#5F5E5A", margin: "0 0 8px" }}>Comprador</p>
          <div style={{ background: "#F7F6F3", borderRadius: 12, padding: "12px 14px" }}>
            {item.comprador_nombre && <div style={{ fontSize: 14, fontWeight: 600, color: "#2C2C2A" }}>{item.comprador_nombre}</div>}
            {item.comprador_telefono && <div style={{ fontSize: 13, color: "#5F5E5A", marginTop: 2 }}>📞 {item.comprador_telefono}</div>}
          </div>
        </div>
      )}

      {isSold && item.metodo_pago && (() => {
        const m = getMetodo(item.metodo_pago);
        const rows = item.metodo_pago === "cheque" ? [
          { label: "Banco", value: item.cheque_banco },
          { label: "Nº cheque", value: item.cheque_numero },
          { label: "Monto del cheque", value: item.cheque_monto ? formatCurrency(item.cheque_monto) : null },
          { label: "Fecha de cobro", value: item.cheque_fecha_cobro ? formatDate(item.cheque_fecha_cobro) : null },
        ].filter((r) => r.value) : item.metodo_pago === "transferencia" && item.pago_nota ? [
          { label: "Referencia", value: item.pago_nota },
        ] : [];
        return (
          <div style={{ marginTop: 16 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#5F5E5A", margin: "0 0 8px" }}>Método de pago</p>
            <div style={{ background: "#F7F6F3", borderRadius: 12, padding: "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: rows.length ? 10 : 0 }}>
                <span style={{ fontSize: 22 }}>{m?.icon || "💰"}</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: "#2C2C2A" }}>{m?.label || item.metodo_pago}</span>
              </div>
              {rows.map((r) => (
                <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #EEE" }}>
                  <span style={{ fontSize: 13, color: "#888780" }}>{r.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 500, color: "#2C2C2A" }}>{r.value}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {!isSold ? (
        <>
          <button onClick={onMarkSold} style={{ width: "100%", background: "#1D9E75", color: "#fff", border: "none", borderRadius: 14, padding: "14px 0", fontSize: 16, fontWeight: 700, cursor: "pointer", marginTop: 20, minHeight: 48, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            💰 Marcar como vendido
          </button>
          <button onClick={shareWhatsApp} style={{ width: "100%", background: "#25D366", color: "#fff", border: "none", borderRadius: 14, padding: "14px 0", fontSize: 15, fontWeight: 600, cursor: "pointer", marginTop: 10, minHeight: 48, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <span style={{ fontSize: 18 }}>💬</span> Compartir por WhatsApp
          </button>
          <button onClick={onEditProduct} style={{ width: "100%", background: "#2C2C2A", color: "#fff", border: "none", borderRadius: 14, padding: "14px 0", fontSize: 16, fontWeight: 600, cursor: "pointer", marginTop: 10, minHeight: 48 }}>
            Editar producto
          </button>
        </>
      ) : (
        <>
          <button onClick={shareWhatsApp} style={{ width: "100%", background: "#25D366", color: "#fff", border: "none", borderRadius: 14, padding: "14px 0", fontSize: 15, fontWeight: 600, cursor: "pointer", marginTop: 20, minHeight: 48, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <span style={{ fontSize: 18 }}>💬</span> Compartir por WhatsApp
          </button>
          <button onClick={onEditSale} style={{ width: "100%", background: "#2C2C2A", color: "#fff", border: "none", borderRadius: 14, padding: "14px 0", fontSize: 16, fontWeight: 600, cursor: "pointer", marginTop: 10, minHeight: 48 }}>
            Editar venta
          </button>
          <button onClick={onEditProduct} style={{ width: "100%", background: "#fff", color: "#2C2C2A", border: "1px solid #D3D1C7", borderRadius: 14, padding: "14px 0", fontSize: 15, fontWeight: 600, cursor: "pointer", marginTop: 10, minHeight: 48 }}>
            Editar producto
          </button>
          <button onClick={onUnsell} style={{ width: "100%", background: "#FCEBEB", color: "#A32D2D", border: "none", borderRadius: 14, padding: "14px 0", fontSize: 15, fontWeight: 600, cursor: "pointer", marginTop: 10, minHeight: 48 }}>
            ↩ Volver a stock
          </button>
        </>
      )}
    </div>
  );
}

function BottomNav({ tab, setTab }) {
  return (
    <div style={{ position: "sticky", bottom: 0, background: "#fff", borderTop: "1px solid #F1EFE8", display: "flex", zIndex: 20, marginLeft: -16, marginRight: -16 }}>
      {[
        { id: "stock", label: "Stock", icon: "📦" },
        { id: "vendidos", label: "Vendidos", icon: "💰" },
      ].map((t) => (
        <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, background: "none", border: "none", padding: "10px 0", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, fontFamily: "inherit" }}>
          <span style={{ fontSize: 20 }}>{t.icon}</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: tab === t.id ? "#1D9E75" : "#888780" }}>{t.label}</span>
          {tab === t.id && <div style={{ width: 20, height: 2, background: "#1D9E75", borderRadius: 2 }} />}
        </button>
      ))}
    </div>
  );
}

function AuthScreen() {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMsg({ type: "success", text: "Cuenta creada. Revisá tu mail si Supabase pide confirmación, o ya podés iniciar sesión." });
        setMode("signin");
      }
    } catch (err) {
      setMsg({ type: "error", text: err.message || "Error de autenticación" });
    }
    setLoading(false);
  };

  return (
    <div style={{ fontFamily: "'DM Sans','Segoe UI',-apple-system,sans-serif", maxWidth: 420, margin: "0 auto", padding: "60px 20px", color: "#2C2C2A", minHeight: "100dvh", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <style>{`
        @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>📦</div>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: "0 0 4px", letterSpacing: -0.5 }}>Casty</h1>
        <p style={{ fontSize: 14, color: "#888780", margin: 0 }}>{mode === "signin" ? "Iniciá sesión para continuar" : "Crear cuenta nueva"}</p>
      </div>
      <form onSubmit={submit}>
        <Field label="Email"><input type="email" style={inp} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" required autoComplete="email" /></Field>
        <Field label="Contraseña"><input type="password" style={inp} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} autoComplete={mode === "signin" ? "current-password" : "new-password"} /></Field>
        {msg && (
          <div style={{ background: msg.type === "error" ? "#FCEBEB" : "#EAF3DE", color: msg.type === "error" ? "#A32D2D" : "#3B6D11", padding: "10px 12px", borderRadius: 10, fontSize: 13, fontWeight: 500, marginBottom: 12, lineHeight: 1.4 }}>{msg.text}</div>
        )}
        <button type="submit" disabled={loading} style={{ width: "100%", background: loading ? "#9FE1CB" : "#1D9E75", color: "#fff", border: "none", borderRadius: 14, padding: "14px 0", fontSize: 16, fontWeight: 600, cursor: loading ? "default" : "pointer", marginTop: 4, minHeight: 48 }}>
          {loading ? "..." : mode === "signin" ? "Entrar" : "Crear cuenta"}
        </button>
      </form>
      <button type="button" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMsg(null); }} style={{ background: "none", border: "none", color: "#1D9E75", fontSize: 13, fontWeight: 600, cursor: "pointer", marginTop: 18, fontFamily: "inherit", textAlign: "center" }}>
        {mode === "signin" ? "¿No tenés cuenta? Creá una" : "¿Ya tenés cuenta? Entrar"}
      </button>
    </div>
  );
}

function InventoryApp({ session }) {
  const [items, setItems] = useState([]);
  const [tab, setTab] = useState("stock");
  const [view, setView] = useState("list"); // list | detail | form | sell
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("todos");
  const [stockFilters, setStockFilters] = useState({ priceMin: "", priceMax: "", compraDesde: "", compraHasta: "", staleOnly: false });
  const [salesFilters, setSalesFilters] = useState({ ventaDesde: "", ventaHasta: "", metodo: "todos", categoria: "todos" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const closeToast = useCallback(() => setToast(null), []);
  const showToast = useCallback((message, type = "success", action = null) => setToast({ message, type, action }), []);
  const showError = useCallback((message) => setToast({ message, type: "error" }), []);

  const fetchItems = useCallback(async () => {
    const { data, error } = await supabase
      .from("productos")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(FETCH_LIMIT);
    if (error) showError("Error al cargar: " + error.message);
    else setItems(data || []);
    setLoading(false);
  }, [showError]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const saveProduct = async (product) => {
    setSaving(true);
    try {
      if (product.id) {
        const { id, created_at, updated_at, ...updates } = product;
        const { error } = await supabase.from("productos").update(updates).eq("id", id);
        if (error) throw error;
        showToast("Producto actualizado");
      } else {
        const { id, ...newP } = product;
        const { error } = await supabase.from("productos").insert([newP]);
        if (error) throw error;
        showToast("Producto agregado a stock");
      }
      await fetchItems();
      setView("list"); setEditing(null); setSelected(null);
    } catch (err) {
      showError("Error: " + err.message);
    }
    setSaving(false);
  };

  const saveSale = async (saleData) => {
    setSaving(true);
    try {
      const { id, ...updates } = saleData;
      const { error } = await supabase.from("productos").update(updates).eq("id", id);
      if (error) throw error;
      showToast(editing?.fecha_venta ? "Venta actualizada" : "¡Vendido!");
      await fetchItems();
      setTab("vendidos");
      setView("list"); setEditing(null); setSelected(null);
    } catch (err) {
      showError("Error: " + err.message);
    }
    setSaving(false);
  };

  const unsell = (item) => {
    setConfirmDialog({
      title: "¿Volver a stock?",
      message: `"${item.nombre}" va a volver a aparecer en Stock. Se van a borrar los datos de la venta (fecha, precio, comprador, método de pago).`,
      confirmText: "Volver a stock",
      danger: true,
      onConfirm: async () => {
        setConfirmDialog(null);
        setSaving(true);
        try {
          const { error } = await supabase.from("productos").update({
            fecha_venta: null, precio_venta: 0,
            comprador_nombre: null, comprador_telefono: null,
            metodo_pago: null, pago_nota: null,
            cheque_banco: null, cheque_numero: null, cheque_monto: null, cheque_fecha_cobro: null,
          }).eq("id", item.id);
          if (error) throw error;
          showToast("Producto vuelto a stock");
          await fetchItems();
          setTab("stock");
          setView("list"); setSelected(null); setEditing(null);
        } catch (err) {
          showError("Error: " + err.message);
        }
        setSaving(false);
      },
      onCancel: () => setConfirmDialog(null),
    });
  };

  const requestDelete = (item) => {
    setConfirmDialog({
      title: "¿Eliminar producto?",
      message: `"${item.nombre}" se va a mover a la papelera. Podés deshacerlo durante 7 segundos.`,
      confirmText: "Eliminar",
      danger: true,
      onConfirm: () => { setConfirmDialog(null); softDelete(item); },
      onCancel: () => setConfirmDialog(null),
    });
  };

  const softDelete = async (item) => {
    setSaving(true);
    try {
      const { error } = await supabase.from("productos").update({ deleted_at: new Date().toISOString() }).eq("id", item.id);
      if (error) throw error;
      await fetchItems();
      setView("list"); setEditing(null); setSelected(null);
      setToast({
        message: "Producto eliminado",
        type: "success",
        action: {
          label: "Deshacer",
          onClick: async () => {
            const { error: e2 } = await supabase.from("productos").update({ deleted_at: null }).eq("id", item.id);
            if (!e2) { await fetchItems(); showToast("Restaurado"); }
          },
        },
      });
    } catch (err) {
      showError("Error al eliminar: " + err.message);
    }
    setSaving(false);
  };

  const logout = async () => { await supabase.auth.signOut(); };

  // Split items by tab
  const stockItems = useMemo(() => items.filter((i) => !i.fecha_venta), [items]);
  const soldItems = useMemo(() => items.filter((i) => !!i.fecha_venta), [items]);

  const filteredStock = useMemo(() => {
    const q = normalize(search);
    const pmin = Number(stockFilters.priceMin) || null;
    const pmax = Number(stockFilters.priceMax) || null;
    return stockItems.filter((i) => {
      const ms = !q || normalize(i.nombre).includes(q) || normalize(i.ubicacion).includes(q);
      const mc = filterCat === "todos" || i.categoria === filterCat;
      const mpMin = pmin == null || Number(i.precio_compra) >= pmin;
      const mpMax = pmax == null || Number(i.precio_compra) <= pmax;
      const mdDesde = !stockFilters.compraDesde || (i.fecha_compra && i.fecha_compra >= stockFilters.compraDesde);
      const mdHasta = !stockFilters.compraHasta || (i.fecha_compra && i.fecha_compra <= stockFilters.compraHasta);
      const mStale = !stockFilters.staleOnly || staleDays(i) >= STALE_DAYS;
      return ms && mc && mpMin && mpMax && mdDesde && mdHasta && mStale;
    });
  }, [stockItems, search, filterCat, stockFilters]);

  const filteredSales = useMemo(() => {
    const q = normalize(search);
    return soldItems.filter((i) => {
      const ms = !q || normalize(i.nombre).includes(q) || normalize(i.comprador_nombre).includes(q);
      const mdDesde = !salesFilters.ventaDesde || i.fecha_venta >= salesFilters.ventaDesde;
      const mdHasta = !salesFilters.ventaHasta || i.fecha_venta <= salesFilters.ventaHasta;
      const mm = salesFilters.metodo === "todos" || i.metodo_pago === salesFilters.metodo;
      const mc = salesFilters.categoria === "todos" || i.categoria === salesFilters.categoria;
      return ms && mdDesde && mdHasta && mm && mc;
    }).sort((a, b) => b.fecha_venta.localeCompare(a.fecha_venta));
  }, [soldItems, search, salesFilters]);

  const { porMes, meses } = useMemo(() => {
    const porMes = {};
    filteredSales.forEach((i) => {
      const key = i.fecha_venta.slice(0, 7);
      if (!porMes[key]) porMes[key] = { ganancia: 0, cantidad: 0 };
      porMes[key].ganancia += Number(i.precio_venta) - Number(i.precio_compra);
      porMes[key].cantidad += 1;
    });
    const meses = Object.keys(porMes).sort().reverse();
    return { porMes, meses };
  }, [filteredSales]);

  const navBack = () => {
    if (view === "sell" && selected) { setView("detail"); setEditing(null); }
    else if (view === "form" && selected) { setView("detail"); setEditing(null); }
    else if (view === "form") { setView("list"); setEditing(null); }
    else if (view === "sell") { setView("detail"); }
    else if (view === "detail") { setView("list"); setSelected(null); }
  };

  const showingSubView = view !== "list";

  const headerTitle = showingSubView
    ? (view === "form" ? (editing ? "Editar producto" : "Nuevo producto") : view === "sell" ? (editing?.fecha_venta ? "Editar venta" : "Marcar como vendido") : "Detalle")
    : (tab === "stock" ? "Stock" : "Vendidos");

  return (
    <div style={{ fontFamily: "'DM Sans','Segoe UI',-apple-system,sans-serif", maxWidth: 480, margin: "0 auto", padding: "0 16px", color: "#2C2C2A", minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
        @keyframes spin{to{transform:rotate(360deg)}}
        *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
        input,textarea,select,button{font-family:inherit}
        input[type="date"]{min-height:44px}
        ::-webkit-scrollbar{display:none}
        details summary::-webkit-details-marker{display:none}
      `}</style>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", borderBottom: "1px solid #F1EFE8", marginBottom: 14, position: "sticky", top: 0, background: "#fff", zIndex: 10 }}>
        {showingSubView ? (
          <>
            <button onClick={navBack} style={{ background: "none", border: "none", fontSize: 16, color: "#1D9E75", cursor: "pointer", padding: "8px 0", fontWeight: 600, fontFamily: "inherit", minHeight: 44, display: "flex", alignItems: "center" }}>‹ Volver</button>
            <h1 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#2C2C2A" }}>{headerTitle}</h1>
            <div style={{ width: 60 }} />
          </>
        ) : (
          <>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: -0.5 }}>{headerTitle}</h1>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {tab === "stock" && (
                <button onClick={() => { setView("form"); setEditing(null); setSelected(null); }} style={{ background: "#1D9E75", color: "#fff", border: "none", borderRadius: 12, padding: "10px 16px", fontSize: 14, fontWeight: 600, cursor: "pointer", minHeight: 44 }}>+ Nuevo</button>
              )}
              <div style={{ position: "relative" }}>
                <button onClick={() => setMenuOpen((v) => !v)} aria-label="Menú" style={{ background: "#F7F6F3", border: "none", borderRadius: 12, width: 44, height: 44, fontSize: 18, cursor: "pointer", fontFamily: "inherit" }}>⋯</button>
                {menuOpen && (
                  <>
                    <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 30 }} />
                    <div style={{ position: "absolute", right: 0, top: 48, background: "#fff", borderRadius: 12, boxShadow: "0 4px 16px rgba(0,0,0,0.12)", zIndex: 31, minWidth: 180, padding: 6 }}>
                      <div style={{ padding: "8px 12px", fontSize: 11, color: "#888780", borderBottom: "1px solid #F1EFE8", marginBottom: 4, wordBreak: "break-all" }}>{session?.user?.email}</div>
                      <button onClick={() => { setMenuOpen(false); logout(); }} style={{ width: "100%", background: "none", border: "none", textAlign: "left", padding: "10px 12px", fontSize: 14, fontWeight: 600, color: "#A32D2D", cursor: "pointer", borderRadius: 8, fontFamily: "inherit" }}>Cerrar sesión</button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      <div style={{ flex: 1 }}>
        {loading ? <Spinner />
          : view === "form" ? (
            <ProductForm item={editing} onSave={saveProduct} onDelete={editing ? softDelete : null} onRequestDelete={requestDelete} saving={saving} onError={showError} />
          )
          : view === "sell" && editing ? (
            <SellForm item={editing} onSave={saveSale} saving={saving} onError={showError} isEdit={!!editing.fecha_venta} />
          )
          : view === "detail" && selected ? (
            <DetailView
              item={selected}
              onEditProduct={() => { setEditing(selected); setView("form"); }}
              onMarkSold={() => { setEditing(selected); setView("sell"); }}
              onEditSale={() => { setEditing(selected); setView("sell"); }}
              onUnsell={() => unsell(selected)}
            />
          )
          : tab === "stock" ? (
            stockItems.length === 0 ? (
              <div style={{ textAlign: "center", padding: "4rem 1rem" }}>
                <div style={{ fontSize: 48, marginBottom: 14, opacity: 0.2 }}>📦</div>
                <p style={{ fontSize: 18, fontWeight: 600, margin: "0 0 6px" }}>Stock vacío</p>
                <p style={{ fontSize: 14, color: "#888780", margin: "0 0 24px" }}>Agregá tu primer producto</p>
                <button onClick={() => { setView("form"); setEditing(null); }} style={{ background: "#1D9E75", color: "#fff", border: "none", borderRadius: 14, padding: "14px 32px", fontSize: 16, fontWeight: 600, cursor: "pointer", minHeight: 48 }}>+ Agregar producto</button>
              </div>
            ) : (
              <div style={{ animation: "fadeIn 0.2s ease" }}>
                <StockStats items={items} />
                <input style={{ ...inp, marginBottom: 8 }} placeholder="Buscar por nombre o ubicación..." value={search} onChange={(e) => setSearch(e.target.value)} />
                <CategoryFilter value={filterCat} onChange={setFilterCat} items={stockItems} />
                <StockAdvancedFilters filters={stockFilters} setFilters={setStockFilters} />
                {filteredStock.length === 0
                  ? <p style={{ textAlign: "center", color: "#888780", padding: "2rem 0", fontSize: 14 }}>Sin resultados</p>
                  : <div>{filteredStock.map((item) => <ProductCard key={item.id} item={item} onClick={() => { setSelected(item); setView("detail"); }} />)}</div>
                }
              </div>
            )
          )
          : tab === "vendidos" ? (
            soldItems.length === 0 ? (
              <div style={{ textAlign: "center", padding: "4rem 1rem" }}>
                <div style={{ fontSize: 48, marginBottom: 14, opacity: 0.2 }}>💰</div>
                <p style={{ fontSize: 18, fontWeight: 600, margin: "0 0 6px" }}>Sin ventas aún</p>
                <p style={{ fontSize: 14, color: "#888780", margin: "0 0 24px" }}>Cuando vendas un producto, aparecerá acá</p>
              </div>
            ) : (
              <div style={{ animation: "fadeIn 0.2s ease" }}>
                <SalesStats items={filteredSales} porMes={porMes} meses={meses} />
                <input style={{ ...inp, marginBottom: 10 }} placeholder="Buscar por producto o comprador..." value={search} onChange={(e) => setSearch(e.target.value)} />
                <VendidosFilters filters={salesFilters} setFilters={setSalesFilters} items={soldItems} />
                {filteredSales.length === 0
                  ? <p style={{ textAlign: "center", color: "#888780", padding: "2rem 0", fontSize: 14 }}>Sin resultados</p>
                  : <div>{filteredSales.map((item) => <ProductCard key={item.id} item={item} onClick={() => { setSelected(item); setView("detail"); }} />)}</div>
                }
              </div>
            )
          )
          : null
        }
      </div>

      {!showingSubView && <BottomNav tab={tab} setTab={(t) => { setTab(t); setView("list"); setSelected(null); setSearch(""); }} />}
      <Toast toast={toast} onClose={closeToast} />
      <Modal open={!!confirmDialog} {...(confirmDialog || {})} />
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <Spinner />
      </div>
    );
  }
  return session ? <InventoryApp session={session} /> : <AuthScreen />;
}
