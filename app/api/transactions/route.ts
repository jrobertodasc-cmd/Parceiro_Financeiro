import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase client not configured' }, { status: 501 });
  }

  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .order('data', { ascending: false })
      .limit(100);

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase client not configured' }, { status: 501 });
  }

  try {
    const body = await request.json();
    const { data, error } = await supabase
      .from('transactions')
      .insert(body)
      .select();

    if (error) throw error;

    return NextResponse.json(data[0]);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
