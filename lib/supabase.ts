
import { createClient } from "@supabase/supabase-js";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
export const supabase = url && key && !url.includes('placeholder') ? createClient(url, key) : null as any;
export const isSupabaseConfigured = () => !!url && !!key && !url.includes('placeholder');

export type Transaction = {
  id: string;
  data: string;
  descricao: string;
  categoria: 'Fixo'|'Variável'|'Venda'|'Fornecedor'|'Imposto'|'Outros';
  tipo: 'Entrada'|'Saída';
  valor: number;
  status?: 'realizado'|'previsto'|'pago'|'a_pagar'|'a_receber'|'vencido';
  data_vencimento?: string;
  data_pagamento?: string;
  hash_dedup?: string;
  observacao?: string;
  itens?: string;
  impostos?: number;
  created_at?: string;
}

export function makeHash(descricao: string, valor: number, data: string) {
  return `${descricao.trim().toLowerCase()}_${Number(valor).toFixed(2)}_${data}`.slice(0,200);
}
