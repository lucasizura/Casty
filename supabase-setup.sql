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
  foto_url TEXT DEFAULT '',
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Columnas que puedan faltar en instalaciones previas
ALTER TABLE productos ADD COLUMN IF NOT EXISTS categoria TEXT DEFAULT 'otros';
ALTER TABLE productos ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

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
