import { useState, useEffect, useRef, useCallback } from "react";
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

function formatCurrency(n) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);
}
function formatDate(d) {
  if (!d) return "—";
  const p = d.split("-");
  return `${p[2]}/${p[1]}/${p[0]}`;
}
function monthLabel(yyyy, mm) {
  const names = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  return `${names[parseInt(mm)-1]} ${String(yyyy).slice(2)}`;
}
function getCat(id) {
  return CATEGORIAS.find((c) => c.id === id) || { label: "Otros", icon: "📦" };
}

function StatusBadge({ sold }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 20, background: sold ? "#EAF3DE" : "#E6F1FB", color: sold ? "#3B6D11" : "#185FA5", whiteSpace: "nowrap" }}>
      {sold ? "Vendido" : "En stock"}
    </span>
  );
}

function Spinner() {
  return (
    <div style={{ textAlign: "center", padding: "3rem" }}>
      <div style={{ width: 32, height: 32, border: "3px solid #F1EFE8", borderTop: "3px solid #1D9E75", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
      <p style={{ fontSize: 14, color: "#888780" }}>Cargando...</p>
    </div>
  );
}

function Toast({ message, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div style={{ position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)", background: type === "error" ? "#A32D2D" : "#1D9E75", color: "#fff", padding: "12px 20px", borderRadius: 12, fontSize: 14, fontWeight: 500, zIndex: 100, maxWidth: "90vw", textAlign: "center", animation: "fadeIn 0.2s ease" }}>
      {message}
    </div>
  );
}

function PhotoUpload({ value, onChange }) {
  const ref = useRef();
  const handle = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) { alert("La foto no puede pesar más de 2 MB"); return; }
    const r = new FileReader();
    r.onload = (ev) => onChange(ev.target.result);
    r.readAsDataURL(f);
  };
  return (
    <div onClick={() => ref.current.click()} style={{ width: "100%", height: 180, borderRadius: 16, border: value ? "none" : "2px dashed #D3D1C7", background: value ? `url(${value}) center/cover no-repeat` : "#F7F6F3", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", position: "relative", overflow: "hidden" }}>
      {!value && <div style={{ textAlign: "center", color: "#888780" }}><div style={{ fontSize: 28, marginBottom: 4 }}>📷</div><div style={{ fontSize: 13 }}>Tocá para subir foto</div></div>}
      {value && <div style={{ position: "absolute", bottom: 8, right: 8, background: "rgba(0,0,0,0.5)", color: "#fff", borderRadius: 8, padding: "4px 10px", fontSize: 11, fontWeight: 600 }}>Cambiar</div>}
      <input ref={ref} type="file" accept="image/*" onChange={handle} style={{ display: "none" }} />
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
          <button key={c.id} onClick={() => onChange(c.id)} style={{
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

function ProductForm({ item, onSave, onDelete, saving }) {
  const [f, setF] = useState({
    nombre: item?.nombre || "", descripcion: item?.descripcion || "",
    precio_compra: item?.precio_compra || "", precio_venta: item?.precio_venta || "",
    ubicacion: item?.ubicacion || "", fecha_compra: item?.fecha_compra || "",
    fecha_venta: item?.fecha_venta || "", foto_url: item?.foto_url || "",
    categoria: item?.categoria || "otros",
  });
  const s = (k, v) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ animation: "fadeIn 0.2s ease", paddingBottom: 30 }}>
      <PhotoUpload value={f.foto_url} onChange={(v) => s("foto_url", v)} />
      <div style={{ marginTop: 16 }}>
        <Field label="Nombre del producto"><input style={inp} value={f.nombre} onChange={(e) => s("nombre", e.target.value)} placeholder="Ej: Reloj Longines 1940" /></Field>
        <CategoryPicker value={f.categoria} onChange={(v) => s("categoria", v)} />
        <Field label="Descripción"><textarea style={{ ...inp, minHeight: 65, resize: "vertical" }} value={f.descripcion} onChange={(e) => s("descripcion", e.target.value)} placeholder="Materiales, época, estado..." /></Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="Precio compra ($)"><input style={inp} type="number" inputMode="numeric" value={f.precio_compra} onChange={(e) => s("precio_compra", e.target.value)} placeholder="0" /></Field>
          <Field label="Precio venta ($)"><input style={inp} type="number" inputMode="numeric" value={f.precio_venta} onChange={(e) => s("precio_venta", e.target.value)} placeholder="0" /></Field>
        </div>
        <Field label="Ubicación"><input style={inp} value={f.ubicacion} onChange={(e) => s("ubicacion", e.target.value)} placeholder="Ej: Vitrina 3, Estante A" /></Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="Fecha compra"><input style={inp} type="date" value={f.fecha_compra} onChange={(e) => s("fecha_compra", e.target.value)} /></Field>
          <Field label="Fecha venta"><input style={inp} type="date" value={f.fecha_venta} onChange={(e) => s("fecha_venta", e.target.value)} /></Field>
        </div>
      </div>
      <button disabled={saving} onClick={() => {
        if (!f.nombre.trim()) return alert("Ingresá un nombre");
        onSave({ ...f, id: item?.id, precio_compra: Number(f.precio_compra) || 0, precio_venta: Number(f.precio_venta) || 0, fecha_compra: f.fecha_compra || null, fecha_venta: f.fecha_venta || null });
      }} style={{ width: "100%", background: saving ? "#9FE1CB" : "#1D9E75", color: "#fff", border: "none", borderRadius: 14, padding: "14px 0", fontSize: 16, fontWeight: 600, cursor: saving ? "default" : "pointer", marginTop: 8, minHeight: 48 }}>
        {saving ? "Guardando..." : item ? "Guardar cambios" : "Agregar producto"}
      </button>
      {item && onDelete && (
        <button disabled={saving} onClick={() => { if (confirm("¿Eliminar este producto?")) onDelete(item.id); }} style={{ width: "100%", background: "#FCEBEB", color: "#A32D2D", border: "none", borderRadius: 14, padding: "14px 0", fontSize: 15, fontWeight: 600, cursor: "pointer", marginTop: 10, minHeight: 48 }}>
          Eliminar producto
        </button>
      )}
    </div>
  );
}

function ProductCard({ item, onClick }) {
  const profit = item.precio_venta ? item.precio_venta - item.precio_compra : null;
  const cat = getCat(item.categoria);
  return (
    <div onClick={onClick} style={{ display: "flex", gap: 12, padding: "12px 0", borderBottom: "1px solid #F1EFE8", cursor: "pointer" }}>
      <div style={{ width: 64, height: 64, minWidth: 64, borderRadius: 12, overflow: "hidden", background: item.foto_url ? `url(${item.foto_url}) center/cover no-repeat` : "#F7F6F3", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>
        {!item.foto_url && cat.icon}
      </div>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
          <p style={{ fontSize: 15, fontWeight: 600, margin: 0, color: "#2C2C2A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.nombre}</p>
          <StatusBadge sold={!!item.fecha_venta} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "2px 0" }}>
          <span style={{ fontSize: 11, background: "#F1EFE8", color: "#5F5E5A", padding: "2px 7px", borderRadius: 6, fontWeight: 500 }}>{cat.icon} {cat.label}</span>
          {item.ubicacion && <span style={{ fontSize: 11, color: "#888780" }}>· {item.ubicacion}</span>}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 2 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#1D9E75" }}>{formatCurrency(item.precio_compra)}</span>
          {profit !== null && <span style={{ fontSize: 12, fontWeight: 600, color: profit >= 0 ? "#3B6D11" : "#A32D2D" }}>{profit >= 0 ? "+" : ""}{formatCurrency(profit)}</span>}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", color: "#D3D1C7", fontSize: 18 }}>›</div>
    </div>
  );
}

function Stats({ items }) {
  const stock = items.filter((i) => !i.fecha_venta).length;
  const vendidos = items.filter((i) => !!i.fecha_venta).length;
  const invertido = items.reduce((s, i) => s + (Number(i.precio_compra) || 0), 0);
  const ganancia = items.filter((i) => i.fecha_venta && i.precio_venta).reduce((s, i) => s + (Number(i.precio_venta) - Number(i.precio_compra)), 0);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
      {[
        { label: "En stock", value: stock, color: "#185FA5" },
        { label: "Vendidos", value: vendidos, color: "#3B6D11" },
        { label: "Invertido", value: formatCurrency(invertido), color: "#854F0B" },
        { label: "Ganancia", value: formatCurrency(ganancia), color: ganancia >= 0 ? "#0F6E56" : "#A32D2D" },
      ].map((d) => (
        <div key={d.label} style={{ background: "#F7F6F3", borderRadius: 12, padding: "10px 12px" }}>
          <div style={{ fontSize: 11, color: "#888780", marginBottom: 2 }}>{d.label}</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: d.color }}>{d.value}</div>
        </div>
      ))}
    </div>
  );
}

function CategoryFilter({ value, onChange, items }) {
  const usedCats = [...new Set(items.map((i) => i.categoria).filter(Boolean))];
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

function DetailView({ item, onEdit }) {
  const profit = item.precio_venta ? Number(item.precio_venta) - Number(item.precio_compra) : null;
  const cat = getCat(item.categoria);
  return (
    <div style={{ animation: "fadeIn 0.2s ease", paddingBottom: 30 }}>
      {item.foto_url
        ? <div style={{ width: "100%", height: 220, borderRadius: 16, overflow: "hidden", background: `url(${item.foto_url}) center/cover no-repeat`, marginBottom: 16 }} />
        : <div style={{ width: "100%", height: 120, borderRadius: 16, background: "#F7F6F3", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 52, marginBottom: 16 }}>{cat.icon}</div>
      }
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
        <h2 style={{ fontSize: 21, fontWeight: 700, margin: 0, color: "#2C2C2A", flex: 1 }}>{item.nombre}</h2>
        <StatusBadge sold={!!item.fecha_venta} />
      </div>
      <span style={{ display: "inline-block", fontSize: 12, background: "#F1EFE8", color: "#5F5E5A", padding: "3px 10px", borderRadius: 8, fontWeight: 500, marginBottom: 10 }}>{cat.icon} {cat.label}</span>
      {item.descripcion && <p style={{ fontSize: 14, color: "#5F5E5A", margin: "0 0 16px", lineHeight: 1.5 }}>{item.descripcion}</p>}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
        <div style={{ background: "#F7F6F3", borderRadius: 12, padding: "12px" }}>
          <div style={{ fontSize: 11, color: "#888780", marginBottom: 2 }}>Precio compra</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#2C2C2A" }}>{formatCurrency(item.precio_compra)}</div>
        </div>
        <div style={{ background: "#F7F6F3", borderRadius: 12, padding: "12px" }}>
          <div style={{ fontSize: 11, color: "#888780", marginBottom: 2 }}>Precio venta</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: item.precio_venta ? "#1D9E75" : "#B4B2A9" }}>{item.precio_venta ? formatCurrency(item.precio_venta) : "—"}</div>
        </div>
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
      <button onClick={onEdit} style={{ width: "100%", background: "#2C2C2A", color: "#fff", border: "none", borderRadius: 14, padding: "14px 0", fontSize: 16, fontWeight: 600, cursor: "pointer", marginTop: 20, minHeight: 48 }}>Editar producto</button>
    </div>
  );
}

function HistorialView({ items }) {
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [catFiltro, setCatFiltro] = useState("todos");
  const vendidos = items.filter((i) => i.fecha_venta && i.precio_venta);
  const filtrados = vendidos.filter((i) => {
    if (desde && i.fecha_venta < desde) return false;
    if (hasta && i.fecha_venta > hasta) return false;
    if (catFiltro !== "todos" && i.categoria !== catFiltro) return false;
    return true;
  });
  const porMes = {};
  filtrados.forEach((i) => {
    const key = i.fecha_venta.slice(0, 7);
    if (!porMes[key]) porMes[key] = { ganancia: 0, cantidad: 0 };
    porMes[key].ganancia += Number(i.precio_venta) - Number(i.precio_compra);
    porMes[key].cantidad += 1;
  });
  const meses = Object.keys(porMes).sort();
  const maxG = Math.max(...meses.map((m) => Math.abs(porMes[m].ganancia)), 1);
  const totalGanancia = filtrados.reduce((s, i) => s + (Number(i.precio_venta) - Number(i.precio_compra)), 0);
  const usedCats = [...new Set(vendidos.map((i) => i.categoria).filter(Boolean))];
  return (
    <div style={{ animation: "fadeIn 0.2s ease", paddingBottom: 40 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
        <div style={{ background: "#F7F6F3", borderRadius: 12, padding: "10px 12px" }}>
          <div style={{ fontSize: 11, color: "#888780", marginBottom: 2 }}>Ventas</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#185FA5" }}>{filtrados.length}</div>
        </div>
        <div style={{ background: "#F7F6F3", borderRadius: 12, padding: "10px 12px" }}>
          <div style={{ fontSize: 11, color: "#888780", marginBottom: 2 }}>Ganancia total</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: totalGanancia >= 0 ? "#0F6E56" : "#A32D2D" }}>{formatCurrency(totalGanancia)}</div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#5F5E5A", marginBottom: 4 }}>Desde</label>
          <input type="date" style={inp} value={desde} onChange={(e) => setDesde(e.target.value)} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#5F5E5A", marginBottom: 4 }}>Hasta</label>
          <input type="date" style={inp} value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8, marginBottom: 16, scrollbarWidth: "none" }}>
        <button onClick={() => setCatFiltro("todos")} style={{ flexShrink: 0, background: catFiltro === "todos" ? "#1D9E75" : "#F7F6F3", color: catFiltro === "todos" ? "#fff" : "#5F5E5A", border: "none", borderRadius: 20, padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Todas</button>
        {CATEGORIAS.filter((c) => usedCats.includes(c.id)).map((c) => (
          <button key={c.id} onClick={() => setCatFiltro(c.id)} style={{ flexShrink: 0, background: catFiltro === c.id ? "#1D9E75" : "#F7F6F3", color: catFiltro === c.id ? "#fff" : "#5F5E5A", border: "none", borderRadius: 20, padding: "7px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
            {c.icon} {c.label}
          </button>
        ))}
      </div>
      {meses.length > 0 ? (
        <>
          <div style={{ background: "#F7F6F3", borderRadius: 14, padding: "14px", marginBottom: 20 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: "#5F5E5A", margin: "0 0 12px" }}>Ganancia por mes</p>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 100, overflowX: "auto", paddingBottom: 4 }}>
              {meses.map((m) => {
                const g = porMes[m].ganancia;
                const pct = Math.max((Math.abs(g) / maxG) * 100, 4);
                const [yyyy, mm] = m.split("-");
                return (
                  <div key={m} style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 40, flex: 1 }}>
                    <span style={{ fontSize: 8, color: "#888780", marginBottom: 2, fontWeight: 600, textAlign: "center" }}>{formatCurrency(g).replace(/\.000/,"k")}</span>
                    <div style={{ width: "100%", height: `${pct}%`, background: g >= 0 ? "#1D9E75" : "#E24B4A", borderRadius: "4px 4px 0 0", minHeight: 4 }} />
                    <span style={{ fontSize: 8, color: "#888780", marginTop: 3, textAlign: "center" }}>{monthLabel(yyyy, mm)}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <p style={{ fontSize: 13, fontWeight: 600, color: "#5F5E5A", margin: "0 0 8px" }}>Detalle de ventas</p>
          {filtrados.sort((a, b) => b.fecha_venta.localeCompare(a.fecha_venta)).map((item) => {
            const g = Number(item.precio_venta) - Number(item.precio_compra);
            const cat = getCat(item.categoria);
            return (
              <div key={item.id} style={{ display: "flex", gap: 10, padding: "11px 0", borderBottom: "1px solid #F1EFE8", alignItems: "center" }}>
                <div style={{ width: 44, height: 44, minWidth: 44, borderRadius: 8, overflow: "hidden", background: item.foto_url ? `url(${item.foto_url}) center/cover no-repeat` : "#F7F6F3", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
                  {!item.foto_url && cat.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, margin: 0, color: "#2C2C2A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.nombre}</p>
                  <p style={{ fontSize: 11, color: "#888780", margin: "1px 0 0" }}>{cat.icon} {cat.label} · {formatDate(item.fecha_venta)}</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: g >= 0 ? "#0F6E56" : "#A32D2D" }}>{g >= 0 ? "+" : ""}{formatCurrency(g)}</div>
                  <div style={{ fontSize: 11, color: "#888780" }}>{formatCurrency(item.precio_venta)}</div>
                </div>
              </div>
            );
          })}
        </>
      ) : (
        <div style={{ textAlign: "center", padding: "3rem 0" }}>
          <div style={{ fontSize: 40, opacity: 0.2, marginBottom: 10 }}>📊</div>
          <p style={{ fontSize: 14, color: "#888780" }}>No hay ventas en este período</p>
        </div>
      )}
    </div>
  );
}

function BottomNav({ tab, setTab }) {
  return (
    <div style={{ position: "sticky", bottom: 0, background: "#fff", borderTop: "1px solid #F1EFE8", display: "flex", zIndex: 20, marginLeft: -16, marginRight: -16 }}>
      {[
        { id: "list", label: "Inventario", icon: "📦" },
        { id: "historial", label: "Historial", icon: "📊" },
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

export default function App() {
  const [items, setItems] = useState([]);
  const [tab, setTab] = useState("list");
  const [view, setView] = useState("list");
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [filterCat, setFilterCat] = useState("todos");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = "success") => setToast({ message: msg, type });

  const fetchItems = useCallback(async () => {
    const { data, error } = await supabase.from("productos").select("*").order("created_at", { ascending: false });
    if (error) showToast("Error al cargar", "error");
    else setItems(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const save = async (product) => {
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
        showToast("Producto agregado");
      }
      await fetchItems();
      setView("list"); setEditing(null); setSelected(null);
    } catch (err) { showToast("Error: " + err.message, "error"); }
    setSaving(false);
  };

  const del = async (id) => {
    setSaving(true);
    try {
      const { error } = await supabase.from("productos").delete().eq("id", id);
      if (error) throw error;
      showToast("Eliminado");
      await fetchItems();
      setView("list"); setEditing(null); setSelected(null);
    } catch (err) { showToast("Error al eliminar", "error"); }
    setSaving(false);
  };

  const filtered = items.filter((i) => {
    const ms = !search || i.nombre.toLowerCase().includes(search.toLowerCase()) || (i.ubicacion || "").toLowerCase().includes(search.toLowerCase());
    const mf = filterStatus === "todos" || (filterStatus === "stock" && !i.fecha_venta) || (filterStatus === "vendidos" && !!i.fecha_venta);
    const mc = filterCat === "todos" || i.categoria === filterCat;
    return ms && mf && mc;
  });

  const navBack = () => {
    if (view === "form" && selected) { setView("detail"); setEditing(null); }
    else if (view === "form") { setView("list"); setEditing(null); }
    else if (view === "detail") { setView("list"); setSelected(null); }
  };

  const showingSubView = view !== "list";
  const isHistorial = tab === "historial" && !showingSubView;

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
      `}</style>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", borderBottom: "1px solid #F1EFE8", marginBottom: 14, position: "sticky", top: 0, background: "#fff", zIndex: 10 }}>
        {showingSubView ? (
          <button onClick={navBack} style={{ background: "none", border: "none", fontSize: 16, color: "#1D9E75", cursor: "pointer", padding: "8px 0", fontWeight: 600, fontFamily: "inherit", minHeight: 44, display: "flex", alignItems: "center" }}>‹ Volver</button>
        ) : (
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: -0.5 }}>{isHistorial ? "Historial" : "Inventario"}</h1>
        )}
        {!showingSubView && tab === "list" && items.length > 0 && (
          <button onClick={() => { setView("form"); setEditing(null); setSelected(null); }} style={{ background: "#1D9E75", color: "#fff", border: "none", borderRadius: 12, padding: "10px 16px", fontSize: 14, fontWeight: 600, cursor: "pointer", minHeight: 44 }}>+ Nuevo</button>
        )}
      </div>

      <div style={{ flex: 1 }}>
        {loading ? <Spinner />
          : view === "form" ? <ProductForm item={editing} onSave={save} onDelete={editing ? del : null} saving={saving} />
          : view === "detail" && selected ? <DetailView item={selected} onEdit={() => { setEditing(selected); setView("form"); }} />
          : isHistorial ? <HistorialView items={items} />
          : items.length === 0 ? (
            <div style={{ textAlign: "center", padding: "4rem 1rem" }}>
              <div style={{ fontSize: 48, marginBottom: 14, opacity: 0.2 }}>📦</div>
              <p style={{ fontSize: 18, fontWeight: 600, margin: "0 0 6px" }}>Inventario vacío</p>
              <p style={{ fontSize: 14, color: "#888780", margin: "0 0 24px" }}>Agregá tu primer producto</p>
              <button onClick={() => setView("form")} style={{ background: "#1D9E75", color: "#fff", border: "none", borderRadius: 14, padding: "14px 32px", fontSize: 16, fontWeight: 600, cursor: "pointer", minHeight: 48 }}>+ Agregar producto</button>
            </div>
          ) : (
            <div style={{ animation: "fadeIn 0.2s ease" }}>
              <Stats items={items} />
              <input style={{ ...inp, marginBottom: 8 }} placeholder="Buscar por nombre o ubicación..." value={search} onChange={(e) => setSearch(e.target.value)} />
              <CategoryFilter value={filterCat} onChange={setFilterCat} items={items} />
              <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                {["todos","stock","vendidos"].map((v) => (
                  <button key={v} onClick={() => setFilterStatus(v)} style={{ background: filterStatus === v ? "#2C2C2A" : "#F7F6F3", color: filterStatus === v ? "#fff" : "#5F5E5A", border: "none", borderRadius: 20, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                    {v === "todos" ? "Todos" : v === "stock" ? "En stock" : "Vendidos"}
                  </button>
                ))}
              </div>
              {filtered.length === 0
                ? <p style={{ textAlign: "center", color: "#888780", padding: "2rem 0", fontSize: 14 }}>Sin resultados</p>
                : <div>{filtered.map((item) => <ProductCard key={item.id} item={item} onClick={() => { setSelected(item); setView("detail"); }} />)}</div>
              }
            </div>
          )
        }
      </div>

      {!showingSubView && <BottomNav tab={tab} setTab={(t) => { setTab(t); setView("list"); setSelected(null); }} />}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
