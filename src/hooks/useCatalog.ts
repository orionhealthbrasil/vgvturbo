import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrganization } from './useOrganization';

export interface ProductCategory {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  position: number;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  organization_id: string;
  name: string;
  sku: string | null;
  price: number;
  compare_at_price: number | null;
  is_available: boolean;
  position: number;
  attributes: Record<string, any>;
}

export interface ProductImage {
  url: string;
  alt?: string;
  position?: number;
}

export interface Product {
  id: string;
  organization_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  sku: string | null;
  kind: 'product' | 'service';
  listing_type: 'sale' | 'rent' | 'sale_rent';
  city: string | null;
  neighborhood: string | null;
  base_price: number;
  compare_at_price: number | null;
  hide_price: boolean;
  is_available: boolean;
  has_variants: boolean;
  position: number;
  tags: string[];
  images: ProductImage[];
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface CatalogSettings {
  organization_id: string;
  slug: string;
  display_name: string;
  tagline: string | null;
  about: string | null;
  logo_url: string | null;
  banner_url: string | null;
  theme_color: string;
  whatsapp_greeting_template: string;
  is_published: boolean;
  show_prices: boolean;
}

// ---------------- categories ----------------
export function useProductCategories() {
  const { data: orgData } = useUserOrganization();
  const orgId = orgData?.organization.id;
  return useQuery({
    queryKey: ['product-categories', orgId],
    queryFn: async () => {
      if (!orgId) return [] as ProductCategory[];
      const { data, error } = await supabase
        .from('product_categories' as any)
        .select('*')
        .eq('organization_id', orgId)
        .order('position');
      if (error) throw error;
      return (data || []) as unknown as ProductCategory[];
    },
    enabled: !!orgId,
  });
}

export function useUpsertCategory() {
  const qc = useQueryClient();
  const { data: orgData } = useUserOrganization();
  const orgId = orgData?.organization.id;
  return useMutation({
    mutationFn: async (input: { id?: string; name: string; slug?: string }) => {
      if (!orgId) throw new Error('Sem organização');
      const slug = (input.slug || input.name)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      if (input.id) {
        const { error } = await supabase
          .from('product_categories' as any)
          .update({ name: input.name, slug })
          .eq('id', input.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('product_categories' as any)
          .insert({ organization_id: orgId, name: input.name, slug });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['product-categories', orgId] }),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  const { data: orgData } = useUserOrganization();
  const orgId = orgData?.organization.id;
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('product_categories' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['product-categories', orgId] }),
  });
}

// ---------------- products ----------------
export function useProducts(filters?: { search?: string; categoryId?: string | null; available?: 'all' | 'yes' | 'no' }) {
  const { data: orgData } = useUserOrganization();
  const orgId = orgData?.organization.id;
  return useQuery({
    queryKey: ['products', orgId, filters],
    queryFn: async () => {
      if (!orgId) return [] as Product[];
      let q = supabase
        .from('products' as any)
        .select('*')
        .eq('organization_id', orgId)
        .order('position')
        .order('created_at', { ascending: false });
      if (filters?.categoryId) q = q.eq('category_id', filters.categoryId);
      if (filters?.available === 'yes') q = q.eq('is_available', true);
      if (filters?.available === 'no') q = q.eq('is_available', false);
      if (filters?.search) q = q.ilike('name', `%${filters.search}%`);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as Product[];
    },
    enabled: !!orgId,
  });
}

export function useProductVariants(productId?: string | null) {
  return useQuery({
    queryKey: ['product-variants', productId],
    queryFn: async () => {
      if (!productId) return [] as ProductVariant[];
      const { data, error } = await supabase
        .from('product_variants' as any)
        .select('*')
        .eq('product_id', productId)
        .order('position');
      if (error) throw error;
      return (data || []) as unknown as ProductVariant[];
    },
    enabled: !!productId,
  });
}

export function useUpsertProduct() {
  const qc = useQueryClient();
  const { data: orgData } = useUserOrganization();
  const orgId = orgData?.organization.id;
  return useMutation({
    mutationFn: async (input: Partial<Product> & { id?: string }) => {
      if (!orgId) throw new Error('Sem organização');
      const payload: any = {
        organization_id: orgId,
        name: input.name,
        description: input.description ?? null,
        sku: input.sku || null,
        kind: input.kind || 'product',
        listing_type: input.listing_type || 'sale',
        city: input.city || null,
        neighborhood: input.neighborhood || null,
        base_price: Number(input.base_price) || 0,
        compare_at_price: input.compare_at_price ?? null,
        hide_price: input.hide_price ?? false,
        is_available: input.is_available ?? true,
        has_variants: input.has_variants ?? false,
        category_id: input.category_id || null,
        tags: input.tags ?? [],
        images: input.images ?? [],
      };
      if (input.id) {
        const { data, error } = await supabase
          .from('products' as any)
          .update(payload)
          .eq('id', input.id)
          .select('id')
          .single();
        if (error) throw error;
        return (data as any).id as string;
      } else {
        const { data, error } = await supabase
          .from('products' as any)
          .insert(payload)
          .select('id')
          .single();
        if (error) throw error;
        return (data as any).id as string;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products', orgId] });
    },
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  const { data: orgData } = useUserOrganization();
  const orgId = orgData?.organization.id;
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('products' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products', orgId] }),
  });
}

export function useToggleProductAvailability() {
  const qc = useQueryClient();
  const { data: orgData } = useUserOrganization();
  const orgId = orgData?.organization.id;
  return useMutation({
    mutationFn: async ({ id, is_available }: { id: string; is_available: boolean }) => {
      const { error } = await supabase.from('products' as any).update({ is_available }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products', orgId] }),
  });
}

export function useSaveVariants() {
  const qc = useQueryClient();
  const { data: orgData } = useUserOrganization();
  const orgId = orgData?.organization.id;
  return useMutation({
    mutationFn: async ({ productId, variants }: { productId: string; variants: Partial<ProductVariant>[] }) => {
      if (!orgId) throw new Error('Sem organização');
      // Replace strategy: delete all + insert provided
      await supabase.from('product_variants' as any).delete().eq('product_id', productId);
      if (variants.length === 0) return;
      const rows = variants.map((v, i) => ({
        product_id: productId,
        organization_id: orgId,
        name: v.name || `Variação ${i + 1}`,
        sku: v.sku || null,
        price: Number(v.price) || 0,
        compare_at_price: v.compare_at_price ?? null,
        is_available: v.is_available ?? true,
        position: i,
        attributes: v.attributes ?? {},
      }));
      const { error } = await supabase.from('product_variants' as any).insert(rows);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['product-variants', vars.productId] });
    },
  });
}

// ---------------- settings ----------------
export function useCatalogSettings() {
  const { data: orgData } = useUserOrganization();
  const orgId = orgData?.organization.id;
  return useQuery({
    queryKey: ['catalog-settings', orgId],
    queryFn: async () => {
      if (!orgId) return null;
      const { data, error } = await supabase
        .from('catalog_settings' as any)
        .select('*')
        .eq('organization_id', orgId)
        .maybeSingle();
      if (error) throw error;
      return (data || null) as unknown as CatalogSettings | null;
    },
    enabled: !!orgId,
  });
}

export function useUpdateCatalogSettings() {
  const qc = useQueryClient();
  const { data: orgData } = useUserOrganization();
  const orgId = orgData?.organization.id;
  return useMutation({
    mutationFn: async (patch: Partial<CatalogSettings>) => {
      if (!orgId) throw new Error('Sem organização');
      const { error } = await supabase
        .from('catalog_settings' as any)
        .update(patch as any)
        .eq('organization_id', orgId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['catalog-settings', orgId] }),
  });
}

// ---------------- public ----------------
export function usePublicCatalog(slug?: string) {
  return useQuery({
    queryKey: ['public-catalog', slug],
    queryFn: async () => {
      if (!slug) return null;
      const { data, error } = await supabase.rpc('get_public_catalog' as any, { p_slug: slug });
      if (error) throw error;
      return data as any;
    },
    enabled: !!slug,
  });
}
