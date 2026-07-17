
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupa() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  if (!url || !key || url.includes('placeholder')) throw new Error("Supabase não configurado");
  return createClient(url, key);
}

function makeHash(d: string, v: number, data: string) {
  return `${d.trim().toLowerCase()}_${Number(v).toFixed(2)}_${data}`.slice(0,200);
}

export async function GET() {
  try {
    const supa = getSupa();
    const { data, error } = await supa.from('transactions').select('*').order('data', { ascending: false }).limit(800);
    if (error) throw error;
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supa = getSupa();
    const body = await req.json();
    const rows = Array.isArray(body) ? body : [body];
    
    // verifica duplicidade
    const cleaned = [];
    const dups: any[] = [];
    for (const r of rows) {
      const hash = makeHash(r.descricao, r.valor, r.data_vencimento || r.data);
      const { data: exists } = await supa.from('transactions').select('id').eq('hash_dedup', hash).limit(1);
      if (exists && exists.length > 0) {
        dups.push({ descricao: r.descricao, valor: r.valor, motivo: 'DUPLICADO - já existe com mesma descrição+valor+data' });
        continue;
      }
      cleaned.push({
        data: r.data,
        descricao: r.descricao,
        categoria: r.categoria,
        tipo: r.tipo,
        valor: Number(r.valor),
        status: r.status || (r.tipo === 'Entrada' ? 'a_receber' : 'a_pagar'),
        data_vencimento: r.data_vencimento || r.data,
        data_pagamento: r.data_pagamento || null,
        hash_dedup: hash,
        observacao: r.observacao || null
      });
    }
    if (cleaned.length === 0) {
      return NextResponse.json({ ok: false, duplicados: dups, message: 'Tudo duplicado, nada salvo' });
    }
    const { data, error } = await supa.from('transactions').insert(cleaned).select();
    if (error) throw error;
    return NextResponse.json({ ok: true, data, duplicados: dups });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const supa = getSupa();
    const { id, status, data_pagamento } = await req.json();
    const { data, error } = await supa.from('transactions').update({ status, data_pagamento: data_pagamento || new Date().toISOString().slice(0,10) }).eq('id', id).select();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const supa = getSupa();
    const { id } = await req.json();
    const { error } = await supa.from('transactions').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
