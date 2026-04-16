-- ============================================================
-- Casty Inventario - Setup completo (idempotente)
-- Ejecutar TODO en el SQL Editor de Supabase:
-- https://supabase.com/dashboard/project/_/sql/new
-- ============================================================

-- 1. Tabla productos
CREATE TABLE IF NOT EXISTS productos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  descripcion TEXT DEFAULT '',
  categoria TEXT DEFAULT 'otros',
  precio_compra NUMERIC(12,2) DEFAULT 0,
  precio_venta NUMERIC(12,2) DEFAULT 0,
  ubicacion TEXT DEFAULT '',
  fecha_compra DATE,
  fecha_venta DATE,
  fotos_urls TEXT[] DEFAULT '{}'::TEXT[],
  deleted_at TIMESTAMPTZ,
  metodo_pago TEXT,
  pago_nota TEXT,
  cheque_banco TEXT,
  cheque_numero TEXT,
  cheque_monto NUMERIC(12,2),
  cheque_fecha_cobro DATE,
  comprador_nombre TEXT,
  comprador_telefono TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Columnas que puedan faltar en instalaciones previas
ALTER TABLE productos ADD COLUMN IF NOT EXISTS categoria TEXT DEFAULT 'otros';
ALTER TABLE productos ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS metodo_pago TEXT;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS pago_nota TEXT;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS cheque_banco TEXT;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS cheque_numero TEXT;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS cheque_monto NUMERIC(12,2);
ALTER TABLE productos ADD COLUMN IF NOT EXISTS cheque_fecha_cobro DATE;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS fotos_urls TEXT[] DEFAULT '{}'::TEXT[];
ALTER TABLE productos ADD COLUMN IF NOT EXISTS comprador_nombre TEXT;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS comprador_telefono TEXT;

-- Migracion de foto_url (columna vieja) a fotos_urls, luego drop
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'productos' AND column_name = 'foto_url') THEN
    UPDATE productos SET fotos_urls = ARRAY[foto_url]
      WHERE foto_url IS NOT NULL AND foto_url <> ''
        AND (fotos_urls IS NULL OR array_length(fotos_urls, 1) IS NULL);
    ALTER TABLE productos DROP COLUMN foto_url;
  END IF;
END $$;

-- Quitar cheque_titular si existia (ya no lo usamos)
ALTER TABLE productos DROP COLUMN IF EXISTS cheque_titular;

-- Indice para busqueda
CREATE INDEX IF NOT EXISTS idx_productos_nombre ON productos USING gin(to_tsvector('spanish', nombre));
CREATE INDEX IF NOT EXISTS idx_productos_deleted_at ON productos (deleted_at);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_updated_at ON productos;
CREATE TRIGGER trigger_updated_at
  BEFORE UPDATE ON productos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- 2. RLS: solo usuarios autenticados pueden hacer algo
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acceso publico lectura" ON productos;
DROP POLICY IF EXISTS "Acceso publico insertar" ON productos;
DROP POLICY IF EXISTS "Acceso publico actualizar" ON productos;
DROP POLICY IF EXISTS "Acceso publico eliminar" ON productos;
DROP POLICY IF EXISTS "Auth read" ON productos;
DROP POLICY IF EXISTS "Auth insert" ON productos;
DROP POLICY IF EXISTS "Auth update" ON productos;
DROP POLICY IF EXISTS "Auth delete" ON productos;

CREATE POLICY "Auth read" ON productos
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert" ON productos
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update" ON productos
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth delete" ON productos
  FOR DELETE TO authenticated USING (true);

-- 3. Bucket de Storage para fotos
INSERT INTO storage.buckets (id, name, public)
VALUES ('fotos-productos', 'fotos-productos', true)
ON CONFLICT (id) DO NOTHING;

-- Policies del bucket: lectura publica (para mostrar fotos), escritura solo autenticado
DROP POLICY IF EXISTS "Fotos publicas" ON storage.objects;
DROP POLICY IF EXISTS "Fotos lectura publica" ON storage.objects;
DROP POLICY IF EXISTS "Fotos subir auth" ON storage.objects;
DROP POLICY IF EXISTS "Fotos borrar auth" ON storage.objects;
DROP POLICY IF EXISTS "Fotos actualizar auth" ON storage.objects;

CREATE POLICY "Fotos lectura publica" ON storage.objects
  FOR SELECT USING (bucket_id = 'fotos-productos');
CREATE POLICY "Fotos subir auth" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'fotos-productos');
CREATE POLICY "Fotos borrar auth" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'fotos-productos');
CREATE POLICY "Fotos actualizar auth" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'fotos-productos');
