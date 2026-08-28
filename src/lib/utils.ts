import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Normaliza string para busca: remove acentos e converte para minúsculas */
export function normalizeForSearch(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/** Remove não-dígitos de uma string (para busca por telefone em formatos variados) */
export function digitsOnly(s: string): string {
  return s.replace(/\D/g, '');
}
