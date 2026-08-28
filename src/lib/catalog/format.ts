export const brl = (n: number | null | undefined) =>
  (Number(n ?? 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const discountPct = (base: number, compare?: number | null) => {
  if (!compare || compare <= base) return 0;
  return Math.round(((compare - base) / compare) * 100);
};

export const hasPromo = (base: number, compare?: number | null) =>
  !!compare && Number(compare) > Number(base);
