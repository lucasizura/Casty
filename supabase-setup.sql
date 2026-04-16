-- Ejecutar esto en el SQL Editor de Supabase (https://supabase.com/dashboard)
-- Menu: SQL Editor > New Query > pegar esto > Run

-- Tabla de productos
CREATE TABLE productos (
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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indice para buscar por nombre
CREATE INDEX idx_productos_nombre ON productos USING gin(to_tsvector('spanish', nombre));

-- Funcion para actualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_updated_at
  BEFORE UPDATE ON productos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Habilitar acceso publico (sin login, ideal para app simple de 1 usuario)
-- Si en el futuro queres login, sacas estas policies y agregas auth
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acceso publico lectura" ON productos
  FOR SELECT USING (true);

CREATE POLICY "Acceso publico insertar" ON productos
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Acceso publico actualizar" ON productos
  FOR UPDATE USING (true);

CREATE POLICY "Acceso publico eliminar" ON productos
  FOR DELETE USING (true);

-- Bucket de storage para fotos (opcional, si queres subir fotos a Supabase)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('fotos-productos', 'fotos-productos', true);
-- CREATE POLICY "Fotos publicas" ON storage.objects FOR ALL USING (bucket_id = 'fotos-productos');
