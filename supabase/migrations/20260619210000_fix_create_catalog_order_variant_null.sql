-- Fix "record v_variant is not assigned yet" error in create_catalog_order.
-- Assigning NULL to a record variable clears its tuple descriptor, so any
-- later field access (v_variant.id/name/sku) raises that error when an
-- order item has no variant. Use scalar variables for the json output instead.

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
  v_variant_id uuid;
  v_variant_name text;
  v_variant_sku text;
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
      v_variant_id := v_variant.id;
      v_variant_name := v_variant.name;
      v_variant_sku := v_variant.sku;
    ELSE
      v_unit_price := v_product.base_price;
      v_variant_id := NULL;
      v_variant_name := NULL;
      v_variant_sku := NULL;
    END IF;

    v_line_total := v_unit_price * v_qty;
    v_subtotal := v_subtotal + v_line_total;

    v_validated := v_validated || jsonb_build_array(jsonb_build_object(
      'product_id', v_product.id,
      'product_name', v_product.name,
      'product_sku', v_product.sku,
      'variant_id', v_variant_id,
      'variant_name', v_variant_name,
      'variant_sku', v_variant_sku,
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
