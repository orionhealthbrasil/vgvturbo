-- Allow a product to hide its price in the catalog (e.g. high-end real estate
-- where the price isn't publicly disclosed and must be requested).
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS hide_price boolean NOT NULL DEFAULT false;

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
        'hide_price', p.hide_price,
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
