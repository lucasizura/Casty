import * as XLSX from "xlsx";
import { supabase } from "../supabaseClient";

// IDs de categorias soportadas (deben coincidir con CATEGORIAS de App.jsx)
export const CATEGORIA_IDS = [
  "relojes", "anillos", "pulseras", "collares", "colgantes", "broches",
  "aros", "cadenas", "muebles", "mesas", "espejos", "lamparas",
  "alfombras", "cuadros", "vajilla", "relojes_pared", "esculturas",
  "monedas", "libros", "otros",
];
export const METODO_PAGO_IDS = ["efectivo", "transferencia", "cheque"];

// Headers en el orden que aparecen en la plantilla
export const HEADERS = [
  "sku", "nombre", "categoria", "descripcion",
  "precio_compra", "ubicacion", "fecha_compra",
  "fecha_venta", "precio_venta", "metodo_pago",
  "comprador_nombre", "comprador_telefono", "pago_nota",
  "cheque_banco", "cheque_titular", "cheque_numero", "cheque_monto", "cheque_fecha_cobro",
];

// ----- Helpers de parseo -----

function trimStr(v) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function parseNumber(v) {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return v;
  const cleaned = String(v).replace(/\./g, "").replace(",", ".").trim();
  const n = Number(cleaned);
  return isNaN(n) ? NaN : n;
}

// Acepta Date object, "YYYY-MM-DD", "DD/MM/YYYY", "DD-MM-YYYY"
function parseDate(v) {
  if (!v && v !== 0) return null;
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return "INVALID";
    const yyyy = v.getFullYear();
    const mm = String(v.getMonth() + 1).padStart(2, "0");
    const dd = String(v.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
  const s = String(v).trim();
  if (!s) return null;
  // YYYY-MM-DD
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  // DD/MM/YYYY o DD-MM-YYYY
  m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return "INVALID";
}

// ----- Auto-generacion de SKUs -----

// Devuelve N SKUs sequenciales del tipo INV-0001, INV-0002...
// Toma el max actual de la DB y suma. Tambien evita colisiones con SKUs
// que el usuario haya puesto a mano en el mismo batch.
export async function getNextAutoSkus(count, existingInBatch = []) {
  if (count <= 0) return [];
  const { data, error } = await supabase
    .from("productos")
    .select("sku")
    .like("sku", "INV-%")
    .is("deleted_at", null);
  if (error) throw new Error("Error consultando SKUs auto: " + error.message);
  const nums = (data || [])
    .map((r) => parseInt(String(r.sku).replace(/^INV-/, ""), 10))
    .filter((n) => !isNaN(n));
  // incluir SKUs auto que ya estan en el batch actual
  existingInBatch.forEach((sku) => {
    if (sku && /^INV-\d+$/.test(sku)) {
      const n = parseInt(sku.replace(/^INV-/, ""), 10);
      if (!isNaN(n)) nums.push(n);
    }
  });
  const max = nums.length > 0 ? Math.max(...nums) : 0;
  const result = [];
  for (let i = 0; i < count; i++) {
    result.push(`INV-${String(max + i + 1).padStart(4, "0")}`);
  }
  return result;
}

// ----- Validacion de fila -----

function validateRow(raw, rowNumber) {
  const errors = [];
  const get = (k) => trimStr(raw[k]);

  const sku = get("sku"); // opcional: si vacío, se auto-genera después
  const nombre = get("nombre");
  if (!nombre) errors.push("Falta nombre (obligatorio)");

  const categoria = get("categoria") || "otros";
  if (!CATEGORIA_IDS.includes(categoria)) {
    errors.push(`Categoría inválida: "${categoria}". Valores válidos: ${CATEGORIA_IDS.join(", ")}`);
  }

  const precio_compra = raw.precio_compra === "" || raw.precio_compra === undefined || raw.precio_compra === null
    ? 0
    : parseNumber(raw.precio_compra);
  if (precio_compra === null || isNaN(precio_compra)) errors.push("Precio compra inválido");
  else if (precio_compra < 0) errors.push("Precio compra negativo");

  const fecha_compra = raw.fecha_compra ? parseDate(raw.fecha_compra) : null;
  if (fecha_compra === "INVALID") errors.push("Fecha compra inválida (usar YYYY-MM-DD o DD/MM/YYYY)");

  const fecha_venta = raw.fecha_venta ? parseDate(raw.fecha_venta) : null;
  if (fecha_venta === "INVALID") errors.push("Fecha venta inválida (usar YYYY-MM-DD o DD/MM/YYYY)");

  const precio_venta = raw.precio_venta === "" || raw.precio_venta === undefined || raw.precio_venta === null
    ? 0
    : parseNumber(raw.precio_venta);
  if (precio_venta === null || isNaN(precio_venta)) errors.push("Precio venta inválido");
  else if (precio_venta < 0) errors.push("Precio venta negativo");

  const hasFechaVenta = !!fecha_venta && fecha_venta !== "INVALID";
  const hasPrecioVenta = precio_venta > 0;
  if (hasFechaVenta !== hasPrecioVenta) {
    errors.push("Si carga fecha de venta debe cargar precio de venta (y viceversa)");
  }
  if (fecha_compra && hasFechaVenta && fecha_venta < fecha_compra) {
    errors.push("Fecha de venta no puede ser anterior a la de compra");
  }

  const metodo_pago = hasFechaVenta ? (get("metodo_pago") || "efectivo") : null;
  if (metodo_pago && !METODO_PAGO_IDS.includes(metodo_pago)) {
    errors.push(`Método de pago inválido: "${metodo_pago}". Valores válidos: ${METODO_PAGO_IDS.join(", ")}`);
  }

  const cheque_banco = get("cheque_banco");
  const cheque_fecha_cobro = raw.cheque_fecha_cobro ? parseDate(raw.cheque_fecha_cobro) : null;
  if (metodo_pago === "cheque") {
    if (!cheque_banco) errors.push("Cheque: falta banco");
    if (!cheque_fecha_cobro || cheque_fecha_cobro === "INVALID") errors.push("Cheque: falta fecha de cobro válida");
  }

  if (errors.length > 0) {
    return { ok: false, rowNumber, sku, nombre, errors };
  }

  const cheque_monto = metodo_pago === "cheque" && raw.cheque_monto !== "" && raw.cheque_monto !== undefined && raw.cheque_monto !== null
    ? parseNumber(raw.cheque_monto) : null;

  const normalized = {
    sku: sku || null, // si quedó vacío, será auto-generado en analyzeRows
    nombre,
    descripcion: get("descripcion") || "",
    categoria,
    precio_compra: precio_compra || 0,
    ubicacion: get("ubicacion") || "",
    fecha_compra: fecha_compra || null,
    fotos_urls: [],
    fecha_venta: hasFechaVenta ? fecha_venta : null,
    precio_venta: hasFechaVenta ? precio_venta : 0,
    metodo_pago: metodo_pago || null,
    pago_nota: metodo_pago === "transferencia" ? (get("pago_nota") || null) : null,
    cheque_banco: metodo_pago === "cheque" ? cheque_banco : null,
    cheque_titular: metodo_pago === "cheque" ? (get("cheque_titular") || null) : null,
    cheque_numero: metodo_pago === "cheque" ? (get("cheque_numero") || null) : null,
    cheque_monto: cheque_monto !== null && !isNaN(cheque_monto) ? cheque_monto : null,
    cheque_fecha_cobro: metodo_pago === "cheque" ? (cheque_fecha_cobro || null) : null,
    comprador_nombre: hasFechaVenta ? (get("comprador_nombre") || null) : null,
    comprador_telefono: hasFechaVenta ? (get("comprador_telefono") || null) : null,
  };
  return { ok: true, rowNumber, sku, nombre, normalized };
}

// ----- Plantilla -----

export function downloadTemplate() {
  const headers = HEADERS;
  // Ejemplo 1: producto en stock (mínimo)
  const ejemplo1 = ["ANT-001", "Reloj Longines década del 40", "relojes", "Caja oro 18k, mecánico", 80000, "Vitrina 1", "2026-01-10", "", "", "", "", "", "", "", "", "", "", ""];
  // Ejemplo 2: producto vendido con cheque
  const ejemplo2 = ["ANT-002", "Cuadro óleo sobre tela", "cuadros", "Paisaje pampeano firmado", 120000, "Pared este", "2026-02-18", "2026-03-25", 250000, "cheque", "Ana Costa", "11 5532 1188", "", "Santander", "Ana Costa", "0078123", 250000, "2026-04-15"];

  const wsProductos = XLSX.utils.aoa_to_sheet([headers, ejemplo1, ejemplo2]);
  wsProductos["!cols"] = headers.map((h) => ({ wch: Math.max(h.length, 14) }));

  const instrucciones = [
    ["Campo", "Obligatorio", "Formato / valores válidos"],
    ["sku", "No", "Texto único. Ej: ANT-001. Si lo dejás vacío, se genera automático (INV-0001, INV-0002, etc.)."],
    ["nombre", "SÍ", "Texto. Nombre del producto."],
    ["categoria", "No", `Una de: ${CATEGORIA_IDS.join(", ")}. Default: otros.`],
    ["descripcion", "No", "Texto libre."],
    ["precio_compra", "No", "Número (sin símbolo $). Default: 0."],
    ["ubicacion", "No", "Texto. Ej: Vitrina 3, Estante A."],
    ["fecha_compra", "No", "Formato YYYY-MM-DD (ej. 2026-01-15) o DD/MM/YYYY."],
    ["fecha_venta", "No", "Si está vendido. Mismo formato que fecha_compra."],
    ["precio_venta", "Si vendido", "Número. Obligatorio si hay fecha_venta."],
    ["metodo_pago", "No", `Si hay fecha_venta: ${METODO_PAGO_IDS.join(" | ")}. Default: efectivo.`],
    ["comprador_nombre", "No", "Texto. Solo se guarda si está vendido."],
    ["comprador_telefono", "No", "Texto. Solo se guarda si está vendido."],
    ["pago_nota", "No", "Solo para transferencia (referencia/op)."],
    ["cheque_banco", "Si cheque", "Obligatorio si metodo_pago=cheque."],
    ["cheque_titular", "No", "Nombre del librador del cheque."],
    ["cheque_numero", "No", "Texto."],
    ["cheque_monto", "No", "Número. Default: precio_venta."],
    ["cheque_fecha_cobro", "Si cheque", "Fecha de acreditación. Obligatorio si metodo_pago=cheque."],
    [],
    ["NOTAS", "", ""],
    ["•", "", "Si un SKU ya existe en la base, esa fila se saltea (no se duplica)."],
    ["•", "", "Filas con errores se reportan al final, las válidas se importan igual."],
    ["•", "", "Las fotos no se importan desde Excel; agregalas manualmente desde la app."],
  ];
  const wsInstr = XLSX.utils.aoa_to_sheet(instrucciones);
  wsInstr["!cols"] = [{ wch: 22 }, { wch: 12 }, { wch: 70 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsProductos, "Productos");
  XLSX.utils.book_append_sheet(wb, wsInstr, "Instrucciones");

  XLSX.writeFile(wb, "casty-plantilla-importacion.xlsx");
}

// ----- Parseo del archivo subido -----

export async function parseExcelFile(file) {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error("El Excel no tiene hojas");
  const ws = wb.Sheets[sheetName];
  // sheet_to_json con header row, sin valores default vacíos para detectar campos faltantes
  const rows = XLSX.utils.sheet_to_json(ws, { defval: "", raw: false, dateNF: "yyyy-mm-dd" });
  return rows;
}

// ----- Procesar import -----

export async function analyzeRows(rawRows) {
  const valid = [];
  const invalid = [];
  rawRows.forEach((raw, idx) => {
    const result = validateRow(raw, idx + 2); // +2 porque fila 1 es header, +1 para humanos
    if (result.ok) valid.push(result);
    else invalid.push(result);
  });

  // Separar filas con SKU manual y sin SKU (las sin SKU se auto-generan)
  const withSku = valid.filter((r) => r.sku);
  const withoutSku = valid.filter((r) => !r.sku);

  // Auto-generar SKUs para las sin SKU
  if (withoutSku.length > 0) {
    const manualSkus = withSku.map((r) => r.sku);
    const autoSkus = await getNextAutoSkus(withoutSku.length, manualSkus);
    withoutSku.forEach((row, i) => {
      row.sku = autoSkus[i];
      row.normalized.sku = autoSkus[i];
      row.autoGenerated = true;
    });
  }

  // Detectar duplicados dentro del mismo Excel (sólo entre los con SKU manual)
  const seenInFile = new Set();
  const dupesInFile = [];
  const uniqueWithSku = [];
  withSku.forEach((row) => {
    if (seenInFile.has(row.sku)) {
      dupesInFile.push({ ...row, motivo: "SKU duplicado dentro del archivo" });
    } else {
      seenInFile.add(row.sku);
      uniqueWithSku.push(row);
    }
  });

  // Detectar duplicados contra la DB (sólo entre los con SKU manual)
  const skus = uniqueWithSku.map((r) => r.sku);
  let existingSkus = new Set();
  if (skus.length > 0) {
    const { data, error } = await supabase
      .from("productos")
      .select("sku")
      .is("deleted_at", null)
      .in("sku", skus);
    if (error) throw new Error("Error consultando duplicados: " + error.message);
    existingSkus = new Set((data || []).map((r) => r.sku));
  }

  const dupesInDb = [];
  const toInsert = [...withoutSku]; // las auto-generadas siempre van
  uniqueWithSku.forEach((row) => {
    if (existingSkus.has(row.sku)) {
      dupesInDb.push({ ...row, motivo: "SKU ya existe en la base" });
    } else {
      toInsert.push(row);
    }
  });

  return {
    total: rawRows.length,
    toInsert,
    duplicates: [...dupesInFile, ...dupesInDb],
    invalid,
    autoGenerated: withoutSku.length,
  };
}

// Para filas duplicadas que el usuario quiere importar igual,
// genera un SKU disponible auto-numerado: ANT-001 -> ANT-001-2, -3, etc.
// Hace una sola query contra la DB para todos los prefijos.
export async function resolveSkuConflicts(dupRows) {
  if (!dupRows.length) return [];
  const baseSkus = [...new Set(dupRows.map((r) => r.sku))];
  // OR pattern para una sola query
  const orClauses = baseSkus.map((s) => {
    const safe = s.replace(/,/g, ""); // PostgREST usa coma como separador en .or()
    return `sku.ilike.${safe}%`;
  }).join(",");

  const { data, error } = await supabase
    .from("productos")
    .select("sku")
    .or(orClauses)
    .is("deleted_at", null);
  if (error) throw new Error("Error consultando SKUs existentes: " + error.message);
  const existing = new Set((data || []).map((r) => r.sku));

  const localUsed = new Set();
  return dupRows.map((row) => {
    let n = 2;
    let candidate;
    do {
      candidate = `${row.sku}-${n}`;
      n++;
    } while (existing.has(candidate) || localUsed.has(candidate));
    localUsed.add(candidate);
    return {
      ...row,
      originalSku: row.sku,
      sku: candidate,
      normalized: { ...row.normalized, sku: candidate },
    };
  });
}

// Inserta en lotes de 100, devuelve {inserted, failed}
export async function insertRowsInBatches(rows, onProgress) {
  const BATCH = 100;
  const inserted = [];
  const failed = [];
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    // Insertar uno por uno dentro del batch para tener errores granulares
    for (const row of slice) {
      try {
        const { error } = await supabase.from("productos").insert([row.normalized]);
        if (error) throw error;
        inserted.push(row);
      } catch (err) {
        failed.push({ ...row, errors: [err.message || "Error al insertar"] });
      }
      if (onProgress) onProgress(inserted.length + failed.length, rows.length);
    }
  }
  return { inserted, failed };
}

// ----- Reporte descargable -----

export function downloadReport(report) {
  const wb = XLSX.utils.book_new();

  const insertedNew = report.inserted.filter((r) => !r.originalSku).length;
  const insertedAsDup = report.inserted.filter((r) => r.originalSku).length;

  const summary = [
    ["Reporte de importación"],
    ["Fecha", new Date().toLocaleString("es-AR")],
    [],
    ["Filas procesadas", report.totalProcessed],
    ["Importadas (nuevas)", insertedNew],
    ["Importadas como duplicado (SKU auto-numerado)", insertedAsDup],
    ["Salteadas (duplicados sin importar)", report.duplicates.length],
    ["Con error", report.invalid.length + report.failed.length],
  ];
  const wsSum = XLSX.utils.aoa_to_sheet(summary);
  wsSum["!cols"] = [{ wch: 28 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, wsSum, "Resumen");

  // Separar inserted: las que tenían originalSku son duplicadas importadas con SKU nuevo
  const insertedNew = report.inserted.filter((r) => !r.originalSku);
  const insertedAsDup = report.inserted.filter((r) => r.originalSku);

  if (insertedNew.length) {
    const data = [["Fila", "SKU", "Nombre"], ...insertedNew.map((r) => [r.rowNumber, r.sku, r.nombre])];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = [{ wch: 8 }, { wch: 18 }, { wch: 60 }];
    XLSX.utils.book_append_sheet(wb, ws, "Importadas");
  }
  if (insertedAsDup.length) {
    const data = [["Fila", "SKU original", "SKU nuevo", "Nombre"], ...insertedAsDup.map((r) => [r.rowNumber, r.originalSku, r.sku, r.nombre])];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = [{ wch: 8 }, { wch: 18 }, { wch: 18 }, { wch: 60 }];
    XLSX.utils.book_append_sheet(wb, ws, "Importadas como duplicado");
  }
  if (report.duplicates.length) {
    const data = [["Fila", "SKU", "Nombre", "Motivo"], ...report.duplicates.map((r) => [r.rowNumber, r.sku, r.nombre, r.motivo])];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = [{ wch: 8 }, { wch: 18 }, { wch: 50 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, ws, "Duplicadas (salteadas)");
  }
  const allErrors = [...report.invalid, ...report.failed];
  if (allErrors.length) {
    const data = [["Fila", "SKU", "Nombre", "Errores"], ...allErrors.map((r) => [r.rowNumber, r.sku, r.nombre, r.errors.join("; ")])];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = [{ wch: 8 }, { wch: 18 }, { wch: 50 }, { wch: 80 }];
    XLSX.utils.book_append_sheet(wb, ws, "Errores");
  }

  const ts = new Date().toISOString().slice(0, 16).replace(/[T:]/g, "-");
  XLSX.writeFile(wb, `casty-reporte-importacion-${ts}.xlsx`);
}

// ----- Export de productos a Excel -----

// Exporta TODOS los productos (stock + vendidos, sin borrados) en formato
// compatible con la plantilla de import. Agrega 2 columnas extra al final:
// cheque_cobrado_at y fotos_urls (que el import ignora).
export async function exportProductsToExcel() {
  const { data, error } = await supabase
    .from("productos")
    .select("*")
    .is("deleted_at", null)
    .order("fecha_venta", { ascending: false, nullsFirst: true })
    .order("created_at", { ascending: false });
  if (error) throw new Error("Error al exportar: " + error.message);
  const productos = data || [];

  // Headers: los 18 del template + 2 extras
  const exportHeaders = [...HEADERS, "cheque_cobrado_at", "fotos_urls"];

  const rows = productos.map((p) => exportHeaders.map((h) => {
    const v = p[h];
    if (v === null || v === undefined) return "";
    if (Array.isArray(v)) return v.join("; ");
    if (h === "cheque_cobrado_at" && typeof v === "string" && v.length >= 10) return v.slice(0, 10);
    return v;
  }));

  const ws = XLSX.utils.aoa_to_sheet([exportHeaders, ...rows]);
  ws["!cols"] = exportHeaders.map((h) => ({ wch: Math.max(h.length, 14) }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Productos");

  const ts = new Date().toISOString().slice(0, 16).replace(/[T:]/g, "-");
  XLSX.writeFile(wb, `casty-export-${ts}.xlsx`);
  return productos.length;
}
