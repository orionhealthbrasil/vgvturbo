
-- =============================================================
-- CATALOG MODULE
-- =============================================================

-- 1) Categories
CREATE TABLE public.product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, slug)
);
CREATE INDEX idx_product_categories_org ON public.product_categories(organization_id, position);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_categories TO authenticated;
GRANT ALL ON public.product_categories TO service_role;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read categories" ON public.product_categories
  FOR SELECT TO authenticated
  USING (public.user_belongs_to_org(auth.uid(), organization_id));
CREATE POLICY "Members can insert categories" ON public.product_categories
  FOR INSERT TO authenticated
  WITH CHECK (public.user_belongs_to_org(auth.uid(), organization_id));
CREATE POLICY "Members can update categories" ON public.product_categories
  FOR UPDATE TO authenticated
  USING (public.user_belongs_to_org(auth.uid(), organization_id))
  WITH CHECK (public.user_belongs_to_org(auth.uid(), organization_id));
CREATE POLICY "Members can delete categories" ON public.product_categories
  FOR DELETE TO authenticated
  USING (public.user_belongs_to_org(auth.uid(), organization_id));

CREATE TRIGGER trg_product_categories_updated
  BEFORE UPDATE ON public.product_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Products
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.product_categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  sku text,
  kind text NOT NULL DEFAULT 'product' CHECK (kind IN ('product','service')),
  base_price numeric(12,2) NOT NULL DEFAULT 0,
  compare_at_price numeric(12,2),
  is_available boolean NOT NULL DEFAULT true,
  has_variants boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  tags text[] NOT NULL DEFAULT '{}',
  images jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, sku)
);
CREATE INDEX idx_products_org ON public.products(organization_id, position);
CREATE INDEX idx_products_org_available ON public.products(organization_id, is_available);
CREATE INDEX idx_products_category ON public.products(category_id);
CREATE INDEX idx_products_tags ON public.products USING gin(tags);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read products" ON public.products
  FOR SELECT TO authenticated
  USING (public.user_belongs_to_org(auth.uid(), organization_id));
CREATE POLICY "Members can insert products" ON public.products
  FOR INSERT TO authenticated
  WITH CHECK (public.user_belongs_to_org(auth.uid(), organization_id));
CREATE POLICY "Members can update products" ON public.products
  FOR UPDATE TO authenticated
  USING (public.user_belongs_to_org(auth.uid(), organization_id))
  WITH CHECK (public.user_belongs_to_org(auth.uid(), organization_id));
CREATE POLICY "Members can delete products" ON public.products
  FOR DELETE TO authenticated
  USING (public.user_belongs_to_org(auth.uid(), organization_id));

CREATE TRIGGER trg_products_updated
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Product variants
CREATE TABLE public.product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  sku text,
  price numeric(12,2) NOT NULL DEFAULT 0,
  compare_at_price numeric(12,2),
  is_available boolean NOT NULL DEFAULT true,
  position integer NOT NULL DEFAULT 0,
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_variants_product ON public.product_variants(product_id, position);
CREATE INDEX idx_variants_org ON public.product_variants(organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_variants TO authenticated;
GRANT ALL ON public.product_variants TO service_role;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read variants" ON public.product_variants
  FOR SELECT TO authenticated
  USING (public.user_belongs_to_org(auth.uid(), organization_id));
CREATE POLICY "Members can insert variants" ON public.product_variants
  FOR INSERT TO authenticated
  WITH CHECK (public.user_belongs_to_org(auth.uid(), organization_id));
CREATE POLICY "Members can update variants" ON public.product_variants
  FOR UPDATE TO authenticated
  USING (public.user_belongs_to_org(auth.uid(), organization_id))
  WITH CHECK (public.user_belongs_to_org(auth.uid(), organization_id));
CREATE POLICY "Members can delete variants" ON public.product_variants
  FOR DELETE TO authenticated
  USING (public.user_belongs_to_org(auth.uid(), organization_id));

CREATE TRIGGER trg_variants_updated
  BEFORE UPDATE ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Catalog settings (1 per org)
CREATE TABLE public.catalog_settings (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE,
  display_name text NOT NULL DEFAULT '',
  tagline text,
  about text,
  logo_url text,
  banner_url text,
  theme_color text NOT NULL DEFAULT '#0f172a',
  whatsapp_greeting_template text NOT NULL DEFAULT
    E'Olá! Quero finalizar um pedido:\n\n{itens}\n*Total: R$ {subtotal}*\n\nCliente: {nome} ({telefone})\nObs: {observacoes}\n\n(ref: {order_id})',
  is_published boolean NOT NULL DEFAULT false,
  show_prices boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])?$')
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalog_settings TO authenticated;
GRANT ALL ON public.catalog_settings TO service_role;
ALTER TABLE public.catalog_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read catalog settings" ON public.catalog_settings
  FOR SELECT TO authenticated
  USING (public.user_belongs_to_org(auth.uid(), organization_id));
CREATE POLICY "Admins can insert catalog settings" ON public.catalog_settings
  FOR INSERT TO authenticated
  WITH CHECK (public.is_org_admin_or_owner(organization_id));
CREATE POLICY "Admins can update catalog settings" ON public.catalog_settings
  FOR UPDATE TO authenticated
  USING (public.is_org_admin_or_owner(organization_id))
  WITH CHECK (public.is_org_admin_or_owner(organization_id));
CREATE POLICY "Admins can delete catalog settings" ON public.catalog_settings
  FOR DELETE TO authenticated
  USING (public.is_org_admin_or_owner(organization_id));

CREATE TRIGGER trg_catalog_settings_updated
  BEFORE UPDATE ON public.catalog_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create settings on new org
CREATE OR REPLACE FUNCTION public.initialize_catalog_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slug text;
  v_base text;
  v_i int := 0;
BEGIN
  v_base := regexp_replace(lower(coalesce(NEW.name, 'loja')), '[^a-z0-9]+', '-', 'g');
  v_base := trim(both '-' from v_base);
  IF v_base = '' OR length(v_base) < 2 THEN
    v_base := 'loja-' || substr(NEW.id::text, 1, 8);
  END IF;
  v_slug := v_base;
  WHILE EXISTS (SELECT 1 FROM public.catalog_settings WHERE slug = v_slug) LOOP
    v_i := v_i + 1;
    v_slug := v_base || '-' || v_i;
  END LOOP;
  INSERT INTO public.catalog_settings (organization_id, slug, display_name)
  VALUES (NEW.id, v_slug, NEW.name)
  ON CONFLICT (organization_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_initialize_catalog_settings
  AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.initialize_catalog_settings();

-- Backfill existing organizations
INSERT INTO public.catalog_settings (organization_id, slug, display_name)
SELECT
  o.id,
  regexp_replace(lower(coalesce(o.name, 'loja')), '[^a-z0-9]+', '-', 'g') || '-' || substr(o.id::text, 1, 6),
  o.name
FROM public.organizations o
LEFT JOIN public.catalog_settings cs ON cs.organization_id = o.id
WHERE cs.organization_id IS NULL
ON CONFLICT DO NOTHING;

-- 5) Catalog orders
CREATE TABLE public.catalog_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  items jsonb NOT NULL,
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  notes text,
  whatsapp_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_catalog_orders_org ON public.catalog_orders(organization_id, created_at DESC);
CREATE INDEX idx_catalog_orders_contact ON public.catalog_orders(contact_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalog_orders TO authenticated;
GRANT ALL ON public.catalog_orders TO service_role;
ALTER TABLE public.catalog_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read catalog orders" ON public.catalog_orders
  FOR SELECT TO authenticated
  USING (public.user_belongs_to_org(auth.uid(), organization_id));
CREATE POLICY "Admins can manage catalog orders" ON public.catalog_orders
  FOR ALL TO authenticated
  USING (public.is_org_admin_or_owner(organization_id))
  WITH CHECK (public.is_org_admin_or_owner(organization_id));

-- 6) Public RPC: get catalog by slug (anon)
CREATE OR REPLACE FUNCTION public.get_public_catalog(p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings record;
  v_result jsonb;
BEGIN
  SELECT * INTO v_settings
  FROM public.catalog_settings
  WHERE slug = p_slug AND is_published = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'settings', jsonb_build_object(
      'slug', v_settings.slug,
      'display_name', v_settings.display_name,
      'tagline', v_settings.tagline,
      'about', v_settings.about,
      'logo_url', v_settings.logo_url,
      'banner_url', v_settings.banner_url,
      'theme_color', v_settings.theme_color,
      'show_prices', v_settings.show_prices
    ),
    'categories', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', c.id, 'name', c.name, 'slug', c.slug, 'position', c.position
      ) ORDER BY c.position, c.name)
      FROM public.product_categories c
      WHERE c.organization_id = v_settings.organization_id
    ), '[]'::jsonb),
    'products', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'description', p.description,
        'sku', p.sku,
        'kind', p.kind,
        'category_id', p.category_id,
        'base_price', p.base_price,
        'compare_at_price', p.compare_at_price,
        'has_variants', p.has_variants,
        'tags', p.tags,
        'images', p.images,
        'position', p.position,
        'variants', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', v.id,
            'name', v.name,
            'sku', v.sku,
            'price', v.price,
            'compare_at_price', v.compare_at_price,
            'attributes', v.attributes,
            'position', v.position
          ) ORDER BY v.position, v.name)
          FROM public.product_variants v
          WHERE v.product_id = p.id AND v.is_available = true
        ), '[]'::jsonb)
      ) ORDER BY p.position, p.name)
      FROM public.products p
      WHERE p.organization_id = v_settings.organization_id
        AND p.is_available = true
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_catalog(text) TO anon, authenticated;

-- 7) Public RPC: create order (validates prices server-side)
CREATE OR REPLACE FUNCTION public.create_catalog_order(
  p_slug text,
  p_customer_name text,
  p_customer_phone text,
  p_items jsonb,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings record;
  v_item jsonb;
  v_product record;
  v_variant record;
  v_qty int;
  v_unit_price numeric;
  v_line_total numeric;
  v_subtotal numeric := 0;
  v_validated jsonb := '[]'::jsonb;
  v_order_id uuid;
  v_contact_id uuid;
  v_phone_digits text;
BEGIN
  IF p_customer_name IS NULL OR btrim(p_customer_name) = '' THEN
    RAISE EXCEPTION 'Nome do cliente é obrigatório';
  END IF;
  IF p_customer_phone IS NULL OR btrim(p_customer_phone) = '' THEN
    RAISE EXCEPTION 'Telefone do cliente é obrigatório';
  END IF;
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Pedido vazio';
  END IF;

  SELECT * INTO v_settings
  FROM public.catalog_settings
  WHERE slug = p_slug AND is_published = true
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Catálogo não encontrado';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := GREATEST(1, COALESCE((v_item->>'qty')::int, 1));

    SELECT id, name, base_price, has_variants, sku, is_available
      INTO v_product
    FROM public.products
    WHERE id = (v_item->>'product_id')::uuid
      AND organization_id = v_settings.organization_id;

    IF NOT FOUND OR NOT v_product.is_available THEN
      CONTINUE;
    END IF;

    IF v_product.has_variants AND (v_item->>'variant_id') IS NOT NULL THEN
      SELECT id, name, price, sku, is_available, attributes
        INTO v_variant
      FROM public.product_variants
      WHERE id = (v_item->>'variant_id')::uuid
        AND product_id = v_product.id;

      IF NOT FOUND OR NOT v_variant.is_available THEN
        CONTINUE;
      END IF;
      v_unit_price := v_variant.price;
    ELSE
      v_unit_price := v_product.base_price;
      v_variant := NULL;
    END IF;

    v_line_total := v_unit_price * v_qty;
    v_subtotal := v_subtotal + v_line_total;

    v_validated := v_validated || jsonb_build_array(jsonb_build_object(
      'product_id', v_product.id,
      'product_name', v_product.name,
      'product_sku', v_product.sku,
      'variant_id', v_variant.id,
      'variant_name', v_variant.name,
      'variant_sku', v_variant.sku,
      'qty', v_qty,
      'unit_price', v_unit_price,
      'line_total', v_line_total
    ));
  END LOOP;

  IF jsonb_array_length(v_validated) = 0 THEN
    RAISE EXCEPTION 'Nenhum item válido no pedido';
  END IF;

  -- Try to link existing contact by normalized phone
  v_phone_digits := regexp_replace(p_customer_phone, '\D', '', 'g');
  IF length(v_phone_digits) >= 10 THEN
    SELECT id INTO v_contact_id
    FROM public.contacts
    WHERE organization_id = v_settings.organization_id
      AND regexp_replace(phone, '\D', '', 'g') = v_phone_digits
    LIMIT 1;
  END IF;

  INSERT INTO public.catalog_orders (
    organization_id, contact_id, customer_name, customer_phone,
    items, subtotal, notes, whatsapp_sent_at
  ) VALUES (
    v_settings.organization_id, v_contact_id,
    btrim(p_customer_name), btrim(p_customer_phone),
    v_validated, v_subtotal, NULLIF(btrim(p_notes), ''), now()
  ) RETURNING id INTO v_order_id;

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'subtotal', v_subtotal,
    'items', v_validated,
    'template', v_settings.whatsapp_greeting_template,
    'organization_id', v_settings.organization_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_catalog_order(text, text, text, jsonb, text) TO anon, authenticated;

-- 8) Helper RPC to read connected WhatsApp number for the catalog (anon)
CREATE OR REPLACE FUNCTION public.get_public_catalog_whatsapp(p_slug text)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_phone text;
BEGIN
  SELECT organization_id INTO v_org
  FROM public.catalog_settings
  WHERE slug = p_slug AND is_published = true
  LIMIT 1;

  IF v_org IS NULL THEN RETURN NULL; END IF;

  SELECT regexp_replace(coalesce(instance_name,''), '\D', '', 'g') INTO v_phone
  FROM public.whatsapp_instances
  WHERE organization_id = v_org
  ORDER BY created_at ASC
  LIMIT 1;

  RETURN NULLIF(v_phone, '');
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_catalog_whatsapp(text) TO anon, authenticated;
