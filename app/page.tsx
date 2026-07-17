'use client';
import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Transaction, supabase } from '@/lib/supabase';
import { generateMockTransactions } from '@/lib/mock';
import { classifyWithAI } from '@/lib/classify';
import { TrendingUp, TrendingDown, BarChart3, Upload, Plus, Search, LogOut, Sparkles, Send, X, MessageCircle, Download, FileSpreadsheet, Calendar, AlertTriangle, Check, Clock, Pencil, Trash2, Undo2 } from 'lucide-react';
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Area, AreaChart } from 'recharts';
import Papa from 'papaparse';
import { CATEGORIAS } from '@/lib/categorias';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export default function Page() {
  const [logged, setLogged] = useState(false);
  const [tab, setTab] = useState<'dash'|'dre'|'contas'|'reports'>('dash');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'receita'|'despesa'>('despesa');
  const [showImport, setShowImport] = useState(false);
  const [search, setSearch] = useState("");
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiAnswer, setAiAnswer] = useState("Roberto, pergunte: 'o que está matando meu lucro?' ou 'quais contas vencem essa semana?'");
  const [aiLoading, setAiLoading] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [budgetForm, setBudgetForm] = useState({ tipo: 'Despesa', referencia: '21701 - Comunicação/Mídia Digital - Despesas Operacionais/Fecebook/Email/Mailship/Agencia/Programas e apps', valor: '' });
  const [flowView, setFlowView] = useState<'diario'|'semanal'|'acumulado'>('diario');
  const [form, setForm] = useState({ descricao: "", valor: "", data: new Date().toISOString().slice(0,10), vencimento: new Date().toISOString().slice(0,10), tipo: "Saída" as any, categoria: "Fornecedor" as any, status: "a_pagar" as any, observacao: "", itens: "", impostos: "", empresa: "BOAH MATRIZ", recorrente: false });
  const [comprovanteFile, setComprovanteFile] = useState<File|null>(null);
  const [csvPreview, setCsvPreview] = useState<Transaction[]>([]);
  const [mesFiltro, setMesFiltro] = useState<string>(new Date().toISOString().slice(0,7));
  const [empresaFiltro, setEmpresaFiltro] = useState<string>('TODAS');
  const [dupWarning, setDupWarning] = useState<string>("");
  const [editingId, setEditingId] = useState<string|null>(null);

  useEffect(() => {
    fetch('/api/transactions', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setTransactions(d); })
      .catch(() => {});
      
    fetch('/api/budgets', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setBudgets(d); })
      .catch(() => {});
      
    if (supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) setLogged(true);
      });
      supabase.auth.onAuthStateChange((_event, session) => {
        setLogged(!!session);
      });
    }
  }, []);

  const filtered = useMemo(()=> transactions.filter(t => t.descricao.toLowerCase().includes(search.toLowerCase())).slice(0,50), [transactions, search]);

  const contas = useMemo(()=>{
    let tr = transactions;
    if (empresaFiltro !== 'TODAS') tr = tr.filter(t => (t as any).empresa === empresaFiltro);
    
    const trMes = tr.filter(t => (t.data || '').startsWith(mesFiltro) || ((t as any).data_vencimento || '').startsWith(mesFiltro));
    
    const aPagar = trMes.filter(t=> t.tipo==='Saída' && ['a_pagar','vencido','previsto'].includes((t as any).status || 'a_pagar'));
    const aReceber = trMes.filter(t=> t.tipo==='Entrada' && ['a_receber','previsto'].includes((t as any).status || 'a_receber'));
    const realizadas = trMes.filter(t=> ['realizado','pago'].includes((t as any).status || 'realizado'));
    return { aPagar, aReceber, realizadas, trMes, trGeral: tr };
  }, [transactions, mesFiltro, empresaFiltro]);

  const totals = useMemo(()=> {
    const { trMes, realizadas, aPagar: cAPagar, aReceber: cAReceber, trGeral } = contas;
    const entradas = trMes.filter(t=>t.tipo==='Entrada').reduce((s,t)=>s+Number(t.valor),0);
    const saidas = trMes.filter(t=>t.tipo==='Saída').reduce((s,t)=>s+Number(t.valor),0);
    const entradasRealizadas = realizadas.filter(t=>t.tipo==='Entrada').reduce((s,t)=>s+Number(t.valor),0);
    const saidasRealizadas = realizadas.filter(t=>t.tipo==='Saída').reduce((s,t)=>s+Number(t.valor),0);
    const aReceber = cAReceber.reduce((s,t)=>s+Number(t.valor),0);
    const aPagar = cAPagar.reduce((s,t)=>s+Number(t.valor),0);
    const porCategoria = trMes.filter(t=>t.tipo==='Saída').reduce((acc: any, t)=>{ acc[t.categoria] = (acc[t.categoria]||0)+Number(t.valor); return acc; },{});
    const maiorVilao = Object.entries(porCategoria).sort((a:any,b:any)=>b[1]-a[1])[0];
    let fixo = porCategoria['Fixo']||0; let variavel = porCategoria['Variável']||0; let fornecedor = porCategoria['Fornecedor']||0; let imposto = porCategoria['Imposto']||0;
    Object.keys(porCategoria).forEach(cat => {
      const val = porCategoria[cat];
      if (cat.startsWith('11') || cat.startsWith('21')) fixo += val;
      else if (cat.startsWith('3 -') || cat.startsWith('223')) imposto += val;
      else if (cat.startsWith('121')) fornecedor += val;
      else if (cat.startsWith('12') || cat.startsWith('22') || cat.startsWith('4 -') || cat.startsWith('5 -')) variavel += val;
    });
    const lucroLiquido = entradas - saidas;
    
    const [year, month] = mesFiltro.split('-');
    const endOfMonth = new Date(parseInt(year), parseInt(month), 0).toISOString().slice(0,10);
    const trHistorico = trGeral.filter(t => ((t as any).data_vencimento || t.data) <= endOfMonth);
    const saldoHistoricoRealizado = trHistorico.filter(t => ['pago','realizado'].includes((t as any).status || 'realizado')).reduce((acc, t) => acc + (t.tipo==='Entrada' ? Number(t.valor) : -Number(t.valor)), 0);
    
    return { entradas, saidas, saldoMes: entradasRealizadas - saidasRealizadas, saldoHistoricoRealizado, lucroLiquido, receitaBruta: entradas, margem: entradas ? (lucroLiquido/entradas*100) : 0, maiorVilao: maiorVilao ? maiorVilao[0] : 'Fixo', porCategoria, fixo, variavel, fornecedor, imposto, aReceber, aPagar, lucroBruto: entradas-(fornecedor+variavel) };
  }, [contas, mesFiltro]);

  const chartData = useMemo(()=> {
    const { trMes } = contas;
    const [year, month] = mesFiltro.split('-');
    const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
    
    const map: Record<string, {entrada:number, saida:number}> = {};
    for (let i=1; i<=daysInMonth; i++) { 
      const key = `${mesFiltro}-${String(i).padStart(2,'0')}`; 
      map[key] = { entrada:0, saida:0 }; 
    }
    
    trMes.forEach(t=>{ 
      const dataKey = ((t as any).data_vencimento || t.data).slice(0,10);
      if (map[dataKey]) {
        if (t.tipo==='Entrada') map[dataKey].entrada += Number(t.valor); 
        else map[dataKey].saida += Number(t.valor); 
      }
    });
    
    let acc=0; 
    return Object.entries(map).map(([date, v])=>{ 
      acc += v.entrada - v.saida; 
      const [y,m,d] = date.split('-');
      return { date: `${d}/${m}`, entrada: v.entrada, saida: v.saida, saldo: acc }; 
    });
  }, [contas, mesFiltro]);

  function checkDuplicate(descricao: string, valor: string, data: string) {
    const hash = `${descricao.trim().toLowerCase()}_${Number(valor).toFixed(2)}_${data}`;
    const exists = transactions.find(t=> (t as any).hash_dedup === hash || (t.descricao.toLowerCase()===descricao.toLowerCase() && Number(t.valor)===Number(valor) && (t as any).data_vencimento===data));
    if (exists) { setDupWarning(`⚠️ DUPLICADO! Já existe: ${exists.descricao} - ${BRL.format(Number(exists.valor))} em ${exists.data}. Não pague 2x!`); return true; }
    setDupWarning(""); return false;
  }

  async function handleAdd() {
    if (!form.descricao || !form.valor) return alert("Preencha descrição e valor");
    
    let urlComprovante = null;
    if (comprovanteFile && supabase) {
      const ext = comprovanteFile.name.split('.').pop();
      const { data, error } = await supabase.storage.from('comprovantes').upload(`${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`, comprovanteFile);
      if (data) urlComprovante = supabase.storage.from('comprovantes').getPublicUrl(data.path).data.publicUrl;
    }
    
    if (editingId) {
      const nova: any = { id: editingId, data: form.data, descricao: form.descricao.toUpperCase(), categoria: form.categoria, tipo: form.tipo, valor: Number(form.valor), status: form.status, data_vencimento: form.vencimento, observacao: form.observacao, itens: form.itens, impostos: form.impostos ? Number(form.impostos) : null, empresa: form.empresa, recorrente: form.recorrente };
      setTransactions(transactions.map(t => t.id === editingId ? nova : t)); setShowModal(false); setEditingId(null);
      try { await fetch('/api/transactions', { method: 'PATCH', body: JSON.stringify(nova) }); } catch(e){}
    } else {
      if (checkDuplicate(form.descricao, form.valor, form.vencimento)) { if (!confirm("Detectamos duplicado! Deseja salvar mesmo assim?")) return; }
      
      const novas: any[] = [];
      const qty = form.recorrente ? 12 : 1;
      for (let i=0; i<qty; i++) {
        let vDate = new Date(form.vencimento);
        vDate.setMonth(vDate.getMonth() + i);
        let novaData = vDate.toISOString().slice(0,10);
        
        novas.push({ id: Math.random().toString(36).slice(2), data: novaData, descricao: form.descricao.toUpperCase() + (form.recorrente && i>0 ? ` (${i+1}/12)` : ''), categoria: form.categoria, tipo: form.tipo, valor: Number(form.valor), status: i===0 ? form.status : (form.tipo==='Entrada' ? 'a_receber' : 'a_pagar'), data_vencimento: novaData, observacao: form.observacao, itens: form.itens, impostos: form.impostos ? Number(form.impostos) : null, empresa: form.empresa, recorrente: form.recorrente, comprovante_url: urlComprovante });
      }

      setTransactions([...novas, ...transactions]); setShowModal(false);
      try { const r = await fetch('/api/transactions', { method: 'POST', body: JSON.stringify(novas) }); const j = await r.json(); if (j.duplicados?.length) alert(`Duplicado bloqueado no banco: ${j.duplicados[0].descricao}`); } catch(e){}
    }
    setForm({ descricao: "", valor: "", data: new Date().toISOString().slice(0,10), vencimento: new Date().toISOString().slice(0,10), tipo: "Saída", categoria: "Fornecedor", status: "a_pagar", observacao: "", itens: "", impostos: "", empresa: "BOAH MATRIZ", recorrente: false });
  }

  async function excluir(id: string) {
    if (!confirm("Tem certeza que deseja excluir?")) return;
    setTransactions([...transactions.filter(t=>t.id!==id)]);
    try { await fetch(`/api/transactions?id=${id}`, { method: 'DELETE' }); } catch(e){}
  }

  async function handleAddBudget() {
    if (!budgetForm.valor || !budgetForm.referencia) return;
    const n = { ...budgetForm, valor: Number(budgetForm.valor.replace(/\D/g, ""))/100, mes_ano: mesFiltro };
    const res = await fetch('/api/budgets', { method: 'POST', body: JSON.stringify(n) });
    const json = await res.json();
    setBudgets([json, ...budgets]);
    setBudgetForm({...budgetForm, valor: ''});
  }

  async function deleteBudget(id: string) {
    if(!confirm('Excluir meta/orçamento?')) return;
    setBudgets(budgets.filter(b=>b.id!==id));
    try { await fetch(`/api/budgets?id=${id}`, { method: 'DELETE' }); } catch(e){}
  }

  function editar(t: any) {
    setForm({ descricao: t.descricao, valor: String(t.valor), data: t.data.slice(0,10), vencimento: (t.data_vencimento||t.data).slice(0,10), tipo: t.tipo, categoria: t.categoria, status: t.status||'realizado', observacao: t.observacao||'', itens: t.itens||'', impostos: t.impostos ? String(t.impostos) : '', empresa: t.empresa || 'BOAH MATRIZ', recorrente: t.recorrente || false });
    setEditingId(t.id);
    setModalMode(t.tipo === 'Entrada' ? 'receita' : 'despesa');
    setShowModal(true);
  }

  async function toggleStatus(t: any) {
    const isPago = ['pago', 'realizado'].includes(t.status || 'realizado');
    const newStatus = isPago ? (t.tipo==='Entrada' ? 'a_receber' : 'a_pagar') : (t.tipo==='Entrada' ? 'realizado' : 'pago');
    setTransactions(transactions.map(tr=> tr.id===t.id ? {...tr, status: newStatus as any, data_pagamento: isPago ? null : new Date().toISOString().slice(0,10)} as any : tr));
    try { await fetch('/api/transactions', { method: 'PATCH', body: JSON.stringify({ id: t.id, status: newStatus, data_pagamento: isPago ? null : new Date().toISOString().slice(0,10) }) }); } catch(e){}
  }

  async function handleFileUpload(e: any) {
    const file = e.target.files?.[0]; if (!file) return;
    const isOfx = file.name.toLowerCase().endsWith('.ofx');
    
    if (isOfx) {
      const text = await file.text();
      const novasParaInserir = [];
      const idsParaBaixar = [];
      let trUpdates = [...transactions];
      
      const blocks = text.split(/<STMTTRN>/i).slice(1);
      for (const b of blocks) {
        const amtMatch = b.match(/<TRNAMT>([^<]+)/i);
        const dtMatch = b.match(/<DTPOSTED>([^<]+)/i);
        const memoMatch = b.match(/<MEMO>([^<]+)/i);
        if (amtMatch && dtMatch && memoMatch) {
          const val = Number(amtMatch[1]);
          const dt = dtMatch[1].slice(0,8);
          const date = `${dt.slice(0,4)}-${dt.slice(4,6)}-${dt.slice(6,8)}`;
          const tipo = val >= 0 ? 'Entrada' : 'Saída';
          const valorAbs = Math.abs(val);
          
          const match = trUpdates.find(t => 
            Number(t.valor) === valorAbs && t.tipo === tipo && 
            ['a_pagar', 'a_receber'].includes((t as any).status) &&
            Math.abs(new Date((t as any).data_vencimento || t.data).getTime() - new Date(date).getTime()) <= (3 * 86400000)
          );
          
          if (match) {
            idsParaBaixar.push(match.id);
            match.status = match.tipo === 'Entrada' ? 'realizado' : 'pago';
            (match as any).data_pagamento = new Date().toISOString().slice(0,10);
            try { fetch('/api/transactions', { method: 'PATCH', body: JSON.stringify({ id: match.id, status: match.status, data_pagamento: (match as any).data_pagamento }) }); } catch(e){}
          } else {
            novasParaInserir.push({ id: Math.random().toString(36).slice(2), data: date, descricao: memoMatch[1].trim().toUpperCase(), categoria: 'Outros', tipo, valor: valorAbs, status: 'realizado', data_vencimento: date, empresa: empresaFiltro !== 'TODAS' ? empresaFiltro : 'BOAH MATRIZ' });
          }
        }
      }
      if (idsParaBaixar.length) setTransactions(trUpdates);
      if (novasParaInserir.length) setCsvPreview(novasParaInserir as any);
      alert(`OFX LIDO: ${idsParaBaixar.length} contas bateram e foram baixadas automaticamente! ${novasParaInserir.length} novos lançamentos do banco.`);
      return;
    }
    
    Papa.parse(file, { header: true, complete: (res) => {
      const rows = res.data as any[];
      const parsed: Transaction[] = rows.filter(r=>r.Data && r.Valor).map(r=>({ id: Math.random().toString(36).slice(2), data: r.Data.includes('/') ? r.Data.split('/').reverse().join('-') : r.Data, descricao: (r.Descrição||r.Descricao||"").toUpperCase(), categoria: classifyWithAI(r.Descrição||r.Descricao||""), tipo: Number(String(r.Valor).replace('R$','').replace('.','').replace(',','.')) >=0 ? "Entrada" : "Saída", valor: Math.abs(Number(String(r.Valor).replace('R$','').replace('.','').replace(',','.')))||0, status: 'realizado', empresa: empresaFiltro !== 'TODAS' ? empresaFiltro : 'BOAH MATRIZ' } as any));
      setCsvPreview(parsed);
    }});
  }

  function exportCsv() {
    const csv = Papa.unparse(transactions.map(t=>({ Data: t.data, Vencimento: (t as any).data_vencimento||t.data, Descricao: t.descricao, Categoria: t.categoria, Tipo: t.tipo, Status: (t as any).status||'realizado', Valor: t.valor })));
    const blob = new Blob([csv], {type:'text/csv'}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download=`financeiro-${new Date().toISOString().slice(0,10)}.csv`; a.click();
  }

  async function askAI() {
    if (!aiQuestion.trim()) return; setAiLoading(true);
    try { const dre = { receitaBruta: totals.receitaBruta, lucroLiquido: totals.lucroLiquido, margem: totals.margem.toFixed(2), maiorVilao: totals.maiorVilao, porCategoria: totals.porCategoria, entradas: totals.entradas, saidas: totals.saidas, aPagar: totals.aPagar, aReceber: totals.aReceber }; const res = await fetch('/api/ask-ai', { method: 'POST', body: JSON.stringify({ question: aiQuestion, dre, transactions: transactions.slice(0,20) }) }); const j = await res.json(); setAiAnswer(j.answer); } catch(e){ setAiAnswer("Erro ao consultar IA."); } setAiLoading(false); setAiQuestion("");
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError(""); setIsLoggingIn(true);
    if (!supabase) { setLoginError("Supabase não configurado."); setIsLoggingIn(false); return; }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setLoginError("E-mail ou senha incorretos.");
    setIsLoggingIn(false);
  }

  if (!logged) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-4">
        <Card className="w-full max-w-sm text-center py-10 px-6">
          <div className="w-12 h-12 bg-violet-600 rounded-xl mx-auto flex items-center justify-center text-white font-bold mb-4">F</div>
          <h1 className="text-xl font-bold">Financeiro Parceiro</h1>
          <p className="text-sm text-zinc-500 mt-1 mb-8">Acesso Seguro</p>
          <form onSubmit={handleLogin} className="flex flex-col gap-3">
            <input type="email" placeholder="E-mail" required value={email} onChange={e=>setEmail(e.target.value)} className="w-full p-3 rounded-xl border bg-zinc-50 text-sm outline-none focus:border-violet-500"/>
            <input type="password" placeholder="Senha" required value={password} onChange={e=>setPassword(e.target.value)} className="w-full p-3 rounded-xl border bg-zinc-50 text-sm outline-none focus:border-violet-500"/>
            {loginError && <div className="text-red-500 text-xs font-medium text-left">{loginError}</div>}
            <button type="submit" disabled={isLoggingIn} className="w-full bg-zinc-900 text-white py-3 rounded-xl font-medium hover:bg-black transition mt-2 disabled:opacity-50">
              {isLoggingIn ? "Entrando..." : "Entrar no Sistema"}
            </button>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-zinc-100">
        <div className="max-w-[1400px] mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3"><div className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">F</div><span className="font-bold">Financeiro Parceiro</span><span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-1 rounded-full">{transactions.length} transações</span></div>
          <div className="flex flex-1 max-w-xl mx-auto md:mx-4 items-center gap-2">
            <input type="month" value={mesFiltro} onChange={e=>setMesFiltro(e.target.value)} className="bg-zinc-100 border-none rounded-xl px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-violet-600" />
            <select value={empresaFiltro} onChange={e=>setEmpresaFiltro(e.target.value)} className="bg-zinc-100 border-none rounded-xl px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-violet-600 flex-1">
              <option value="TODAS">Todas as Lojas</option><option>BOAH MATRIZ</option><option>SDB</option><option>VILAS</option><option>PASEO</option><option>BARRA</option><option>SOLAR (ADM)</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={()=>{setModalMode('receita'); setForm({...form, tipo:'Entrada', status:'a_receber', categoria:'Venda'}); setShowModal(true)}} className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-medium hover:bg-emerald-700"><Plus className="w-3.5 h-3.5"/> Receita</button>
            <button onClick={()=>{setModalMode('despesa'); setForm({...form, tipo:'Saída', status:'a_pagar', categoria:'Fornecedor'}); setShowModal(true)}} className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-zinc-900 text-white rounded-xl text-xs font-medium hover:bg-black"><Plus className="w-3.5 h-3.5"/> Despesa</button>
            <button onClick={()=>setShowImport(true)} className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-white border rounded-xl text-xs font-medium"><Upload className="w-3.5 h-3.5"/> CSV/OFX</button>
            <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 font-bold text-sm">R</div><button onClick={async ()=>{ if(supabase) await supabase.auth.signOut(); setLogged(false); }}><LogOut className="w-4 h-4"/></button>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-4 py-6">
        <div className="flex gap-2 mb-6 overflow-x-auto">
          <button onClick={()=>setTab('dash')} className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap ${tab==='dash' ? 'bg-white border shadow-sm text-zinc-900' : 'text-zinc-500'}`}>Dashboard</button>
          <button onClick={()=>setTab('contas')} className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap flex items-center gap-2 ${tab==='contas' ? 'bg-white border shadow-sm text-zinc-900' : 'text-zinc-500'}`}><Clock className="w-4 h-4"/> Contas <span className="bg-amber-100 text-amber-700 text-[10px] px-1.5 py-0.5 rounded-full">{contas.aPagar.length+contas.aReceber.length} pendentes</span></button>
          <button onClick={()=>setTab('dre')} className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 whitespace-nowrap ${tab==='dre' ? 'bg-white border shadow-sm text-zinc-900' : 'text-zinc-500'}`}><BarChart3 className="w-4 h-4"/> DRE</button>
          <button onClick={()=>setTab('metas')} className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 whitespace-nowrap ${tab==='metas' ? 'bg-white border shadow-sm text-zinc-900' : 'text-zinc-500'}`}><TrendingUp className="w-4 h-4"/> Metas & Orçamentos</button>
          <button onClick={()=>setTab('reports')} className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 whitespace-nowrap ${tab==='reports' ? 'bg-white border shadow-sm text-zinc-900' : 'text-zinc-500'}`}><FileSpreadsheet className="w-4 h-4"/> Relatórios</button>
        </div>

        {tab==='dash' && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
              <Card className="p-5"><div className="text-xs text-zinc-500 mb-1">Saldo Realizado</div><div className={`text-xl font-bold ${totals.saldoHistoricoRealizado < 0 ? 'text-red-600' : 'text-zinc-900'}`}>{BRL.format(totals.saldoHistoricoRealizado || 0)}</div><div className="text-[10px] text-zinc-400 mt-1">Entradas - Saídas</div></Card>
              <Card className="p-5"><div className="text-xs text-zinc-500 mb-1">A Receber</div><div className="text-xl font-bold text-emerald-600">{BRL.format(totals.aReceber || 0)}</div><div className="text-[10px] text-emerald-600 mt-1">{contas.aReceber.length} títulos</div></Card>
              <Card className="p-5"><div className="text-xs text-zinc-500 mb-1">A Pagar</div><div className="text-xl font-bold text-red-600">{BRL.format(totals.aPagar || 0)}</div><div className="text-[10px] text-red-600 mt-1">{contas.aPagar.length} títulos • Vilão {totals.maiorVilao}</div></Card>
              <Card className="p-5"><div className="text-xs text-zinc-500 mb-1">Previsto Saldo</div><div className={`text-xl font-bold ${(totals.saldoHistoricoRealizado || 0) + (totals.aReceber || 0) - (totals.aPagar || 0) < 0 ? 'text-red-600' : 'text-violet-600'}`}>{BRL.format((totals.saldoHistoricoRealizado || 0) + (totals.aReceber || 0) - (totals.aPagar || 0))}</div><div className="text-[10px] text-zinc-500 mt-1">Realizado + Futuro</div></Card>
              <Card className="p-5"><div className="text-xs text-zinc-500 mb-1">Margem</div><div className={`text-xl font-bold ${totals.margem < 0 ? 'text-red-600' : 'text-zinc-900'}`}>{totals.margem.toFixed(1)}%</div><div className="text-[10px] text-zinc-500 mt-1">Lucro Líquido</div></Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2 p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-3">
                  <h3 className="font-bold text-base">Fluxo de Caixa</h3>
                  <div className="flex bg-zinc-100 rounded-xl p-1">
                    <button onClick={()=>setFlowView('diario')} className={`px-3 py-1 text-[11px] rounded-lg font-medium ${flowView==='diario' ? 'bg-white shadow-sm' : 'text-zinc-500'}`}>Diário</button>
                    <button onClick={()=>setFlowView('semanal')} className={`px-3 py-1 text-[11px] rounded-lg font-medium ${flowView==='semanal' ? 'bg-white shadow-sm' : 'text-zinc-500'}`}>Semanal</button>
                    <button onClick={()=>setFlowView('acumulado')} className={`px-3 py-1 text-[11px] rounded-lg font-medium ${flowView==='acumulado' ? 'bg-white shadow-sm' : 'text-zinc-500'}`}>Acumulado</button>
                  </div>
                </div>
                <div className="h-[320px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    {flowView === 'acumulado' ? (
                      <AreaChart data={chartData}><CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" /><XAxis dataKey="date" tick={{fontSize:11, fill:'#888'}} axisLine={false} tickLine={false}/><YAxis tick={{fontSize:11, fill:'#888'}} axisLine={false} tickLine={false} tickFormatter={(v)=>`R$${(v/1000).toFixed(0)}k`}/><Tooltip content={({active,payload,label}:any)=> active && payload ? (<div className="bg-zinc-900 text-white text-xs p-3 rounded-xl"><div className="font-bold mb-1">{label}</div>{payload.map((p:any)=><div key={p.dataKey}>{p.name}: {BRL.format(p.value)}</div>)}</div>) : null }/><Area type="monotone" dataKey="saldo" stroke="#7c3aed" fill="#7c3aed" fillOpacity={0.1} strokeWidth={2.5} dot={false}/></AreaChart>
                    ) : (
                      <ComposedChart data={chartData}><CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" /><XAxis dataKey="date" tick={{fontSize:11}} axisLine={false} tickLine={false}/><YAxis tick={{fontSize:11}} axisLine={false} tickLine={false} tickFormatter={(v)=>`R$${(v/1000).toFixed(0)}k`}/><Tooltip content={({active,payload,label}:any)=> active && payload ? (<div className="bg-zinc-900 text-white text-xs p-3 rounded-xl"><div className="font-bold mb-1">{label}</div>{payload.map((p:any)=><div key={p.dataKey} className="flex justify-between gap-4"><span>{p.name}:</span><span>{BRL.format(p.value)}</span></div>)}</div>) : null }/><Bar dataKey="entrada" fill="#10b981" radius={[4,4,0,0]} barSize={12} name="Entrada"/><Bar dataKey="saida" fill="#ef4444" radius={[4,4,0,0]} barSize={12} name="Saída"/><Line type="monotone" dataKey="saldo" stroke="#7c3aed" strokeWidth={2.5} dot={false} strokeDasharray="6 4" name="Saldo"/></ComposedChart>
                    )}
                  </ResponsiveContainer>
                </div>
              </Card>
              <Card className="p-6"><h3 className="font-semibold text-sm mb-4">Top Categorias</h3><div className="space-y-3">{Object.entries(totals.porCategoria).sort((a:any,b:any)=>b[1]-a[1]).slice(0,5).map(([cat, val]:any)=>{ const pct = totals.saidas ? (val/totals.saidas*100) : 0; return (<div key={cat}><div className="flex justify-between text-xs mb-1"><span>{cat}</span><span>{pct.toFixed(0)}%</span></div><div className="w-full h-2 bg-zinc-100 rounded-full"><div className="h-full bg-violet-600 rounded-full" style={{width:`${pct}%`}}></div></div><div className="text-[11px] text-zinc-500">{BRL.format(val)}</div></div>)})}</div></Card>
            </div>
          </>
        )}

        {tab==='contas' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-6"><h3 className="font-bold mb-1 flex items-center gap-2"><span className="w-2 h-2 bg-red-500 rounded-full"></span>Contas a Pagar ({contas.aPagar.length}) - {BRL.format(totals.aPagar)}</h3><p className="text-[11px] text-zinc-500 mb-4">Despesas previstas e pendentes. Clique em PAGO pra dar baixa.</p><div className="space-y-2 max-h-[500px] overflow-auto">{contas.aPagar.slice(0,20).map(t=><div key={t.id} className={`flex justify-between items-center p-3 rounded-xl ${((t as any).data_vencimento || t.data) < new Date().toISOString().slice(0,10) ? 'bg-red-100 border border-red-200 animate-pulse' : 'bg-zinc-50'}`}><div><div className="font-medium text-xs flex items-center gap-1">{t.descricao} {(t as any).comprovante_url && <a href={(t as any).comprovante_url} target="_blank" className="text-violet-600" title="Comprovante">📎</a>}</div><div className="text-[11px] text-zinc-500">{(t as any).data_vencimento ? new Date((t as any).data_vencimento).toLocaleDateString('pt-BR') : new Date(t.data).toLocaleDateString('pt-BR')} • {(t as any).status}</div></div><div className="text-right"><div className="font-bold text-xs text-red-600">{BRL.format(Number(t.valor))}</div><button onClick={()=>toggleStatus(t)} className="mt-1 text-[10px] bg-zinc-900 text-white px-2 py-1 rounded-lg hover:bg-black">Marcar PAGO</button></div></div>)}</div></Card>
            <Card className="p-6"><h3 className="font-bold mb-1 flex items-center gap-2"><span className="w-2 h-2 bg-emerald-500 rounded-full"></span>Contas a Receber ({contas.aReceber.length}) - {BRL.format(totals.aReceber)}</h3><p className="text-[11px] text-zinc-500 mb-4">Receitas previstas. Dê baixa quando receber.</p><div className="space-y-2 max-h-[500px] overflow-auto">{contas.aReceber.slice(0,20).map(t=><div key={t.id} className="flex justify-between items-center p-3 bg-emerald-50 rounded-xl"><div><div className="font-medium text-xs">{t.descricao}</div><div className="text-[11px] text-zinc-500">{(t as any).data_vencimento ? new Date((t as any).data_vencimento).toLocaleDateString('pt-BR') : new Date(t.data).toLocaleDateString('pt-BR')} • {(t as any).status}</div></div><div className="text-right"><div className="font-bold text-xs text-emerald-700">{BRL.format(Number(t.valor))}</div><button onClick={()=>toggleStatus(t)} className="mt-1 text-[10px] bg-emerald-600 text-white px-2 py-1 rounded-lg">Recebido</button></div></div>)}</div></Card>
          </div>
        )}

        {tab==='dre' && (
          <Card className="p-6"><h2 className="font-bold text-lg mb-4">DRE Gerencial</h2><table className="w-full text-sm"><tbody className="divide-y"><tr className="bg-emerald-50/50"><td className="py-3 px-3 font-bold">Receita Bruta</td><td className="py-3 px-3 text-right font-bold">{BRL.format(totals.receitaBruta)}</td></tr><tr><td className="py-3 px-3 pl-6">(-) Fornecedores</td><td className="py-3 px-3 text-right text-red-600">- {BRL.format(totals.fornecedor)}</td></tr><tr><td className="py-3 px-3 pl-6">(-) Variável</td><td className="py-3 px-3 text-right text-red-600">- {BRL.format(totals.variavel)}</td></tr><tr className="bg-zinc-50 font-semibold"><td className="py-3 px-3">Lucro Bruto</td><td className="py-3 px-3 text-right">{BRL.format(totals.lucroBruto)}</td></tr><tr><td className="py-3 px-3 pl-6">(-) Fixos</td><td className="py-3 px-3 text-right text-red-600">- {BRL.format(totals.fixo)}</td></tr><tr><td className="py-3 px-3 pl-6">(-) Impostos</td><td className="py-3 px-3 text-right text-red-600">- {BRL.format(totals.imposto)}</td></tr><tr className="bg-zinc-900 text-white font-bold"><td className="py-4 px-3 rounded-l-xl">Lucro Líquido</td><td className="py-4 px-3 text-right rounded-r-xl">{BRL.format(totals.lucroLiquido)} ({totals.margem.toFixed(1)}%)</td></tr></tbody></table></Card>
        )}

        {tab==='reports' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6"><Card className="p-6"><h3 className="font-bold mb-2">Exportar</h3><button onClick={exportCsv} className="w-full bg-zinc-900 text-white py-3 rounded-xl text-sm flex items-center justify-center gap-2"><Download className="w-4 h-4"/> Baixar CSV</button></Card><Card className="p-6"><h3 className="font-bold mb-2">Resumo</h3><div className="space-y-2 text-xs"><div className="flex justify-between"><span>Receita:</span><b>{BRL.format(totals.receitaBruta)}</b></div><div className="flex justify-between"><span>Despesas:</span><b>{BRL.format(totals.saidas)}</b></div><div className="flex justify-between border-t pt-2"><span>Resultado:</span><b>{BRL.format(totals.lucroLiquido)}</b></div></div><button onClick={()=>window.print()} className="w-full mt-4 border py-3 rounded-xl text-sm">Imprimir PDF</button></Card><Card className="p-6 bg-violet-600 text-white"><h3 className="font-bold mb-2">Saldo Futuro</h3><div className="text-2xl font-bold">{BRL.format((totals.saldoHistoricoRealizado||0) + (totals.aReceber||0) - (totals.aPagar||0))}</div><div className="text-xs opacity-70">Realizado + A Receber - A Pagar</div></Card></div>
        )}

        {tab==='metas' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="p-6 lg:col-span-1">
              <h3 className="font-bold text-lg mb-4">Novo Orçamento/Meta</h3>
              <div className="space-y-3">
                <div className="flex bg-zinc-100 rounded-xl p-1">
                  <button onClick={()=>setBudgetForm({...budgetForm, tipo:'Receita', referencia:'BOAH MATRIZ'})} className={`flex-1 py-2 text-xs rounded-lg font-medium ${budgetForm.tipo==='Receita' ? 'bg-white shadow-sm text-emerald-700' : 'text-zinc-500'}`}>Meta de Venda</button>
                  <button onClick={()=>setBudgetForm({...budgetForm, tipo:'Despesa', referencia:'21701 - Comunicação/Mídia Digital - Despesas Operacionais/Fecebook/Email/Mailship/Agencia/Programas e apps'})} className={`flex-1 py-2 text-xs rounded-lg font-medium ${budgetForm.tipo==='Despesa' ? 'bg-white shadow-sm text-red-700' : 'text-zinc-500'}`}>Orçamento de Custo</button>
                </div>
                <div>
                  <label className="text-[11px] text-zinc-500">{budgetForm.tipo==='Receita' ? 'Qual Loja?' : 'Qual Categoria/Centro de Custo?'}</label>
                  <select value={budgetForm.referencia} onChange={e=>setBudgetForm({...budgetForm, referencia: e.target.value})} className="w-full border rounded-xl p-3 text-sm truncate">
                    {budgetForm.tipo === 'Receita' ? <><option>BOAH MATRIZ</option><option>SDB</option><option>VILAS</option><option>PASEO</option><option>BARRA</option><option>SOLAR (ADM)</option></> : CATEGORIAS.map(c=><option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-zinc-500">Valor Projetado (R$)</label>
                  <input type="text" value={budgetForm.valor ? Number(budgetForm.valor).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2}) : ""} onChange={e=>{ let v = e.target.value.replace(/\D/g, ""); if(!v) { setBudgetForm({...budgetForm, valor: ""}); return; } setBudgetForm({...budgetForm, valor: (parseInt(v)/100).toString()}); }} placeholder="0,00" className="w-full border rounded-xl p-3 text-sm"/>
                </div>
                <button onClick={handleAddBudget} className="w-full bg-zinc-900 text-white py-3 rounded-xl text-sm font-bold hover:bg-black">Adicionar para {new Date(mesFiltro+'-02').toLocaleString('pt-BR',{month:'long'})}</button>
              </div>
            </Card>
            <Card className="p-6 lg:col-span-2">
              <h3 className="font-bold text-lg mb-1">Acompanhamento: {new Date(mesFiltro+'-02').toLocaleString('pt-BR',{month:'long', year:'numeric'})}</h3>
              <p className="text-[11px] text-zinc-500 mb-4">Veja como as lojas estão performando e se os departamentos estão dentro do orçamento.</p>
              <div className="space-y-4 max-h-[500px] overflow-auto">
                {budgets.filter(b=>b.mes_ano === mesFiltro).length === 0 && <div className="text-center py-10 text-zinc-400 text-sm border-2 border-dashed rounded-xl">Nenhuma meta ou orçamento definido para este mês.</div>}
                {budgets.filter(b=>b.mes_ano === mesFiltro).map(b => {
                  let atual = 0;
                  if (b.tipo === 'Receita') {
                    atual = transactions.filter(t => t.tipo === 'Entrada' && t.empresa === b.referencia).reduce((acc, t) => acc + Number(t.valor), 0);
                  } else {
                    atual = transactions.filter(t => t.tipo === 'Saída' && t.categoria === b.referencia).reduce((acc, t) => acc + Number(t.valor), 0);
                  }
                  const pct = b.valor > 0 ? (atual / b.valor * 100) : 0;
                  const isOver = pct > 100;
                  return (
                    <div key={b.id} className="p-4 border rounded-xl bg-zinc-50">
                      <div className="flex justify-between mb-2">
                        <div>
                          <div className="text-xs font-bold flex items-center gap-2">{b.tipo === 'Receita' ? <TrendingUp className="w-4 h-4 text-emerald-600"/> : <TrendingDown className="w-4 h-4 text-red-600"/>} {b.referencia}</div>
                          <div className="text-[10px] text-zinc-500 mt-1">{b.tipo === 'Receita' ? 'Meta de Vendas' : 'Orçamento Liberado'}</div>
                        </div>
                        <div className="text-right">
                          <div className={`font-bold text-sm ${b.tipo === 'Despesa' && isOver ? 'text-red-600' : ''}`}>{BRL.format(atual)} <span className="text-xs font-normal text-zinc-500">de {BRL.format(Number(b.valor))}</span></div>
                          <button onClick={()=>deleteBudget(b.id)} className="text-[10px] text-red-500 hover:underline mt-1">Excluir</button>
                        </div>
                      </div>
                      <div className="w-full h-3 bg-zinc-200 rounded-full overflow-hidden">
                        <div className={`h-full ${b.tipo === 'Receita' ? (pct>=100 ? 'bg-emerald-500' : 'bg-emerald-300') : (isOver ? 'bg-red-500' : 'bg-violet-600')}`} style={{width: `${Math.min(pct, 100)}%`}}></div>
                      </div>
                      <div className="flex justify-between mt-1 text-[10px] font-bold">
                        <span className={b.tipo === 'Despesa' && isOver ? 'text-red-600' : 'text-zinc-600'}>{pct.toFixed(1)}% {b.tipo === 'Receita' ? 'atingido' : 'utilizado'}</span>
                        {b.tipo === 'Despesa' && <span className={isOver ? 'text-red-600' : 'text-emerald-600'}>{isOver ? `Estourou ${BRL.format(atual - Number(b.valor))}` : `Restam ${BRL.format(Number(b.valor) - atual)}`}</span>}
                        {b.tipo === 'Receita' && <span className={pct >= 100 ? 'text-emerald-600' : 'text-amber-600'}>{pct >= 100 ? `Superou em ${BRL.format(atual - Number(b.valor))}` : `Faltam ${BRL.format(Number(b.valor) - atual)}`}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        )}

        <Card className="mt-6"><div className="flex justify-between p-4"><h3 className="font-semibold">Todas Transações</h3><div className="relative"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar duplicado..." className="pl-9 pr-3 py-2 bg-zinc-50 border rounded-xl text-sm w-64"/></div></div><div className="overflow-x-auto px-4 pb-4"><table className="w-full text-sm"><thead><tr className="text-zinc-400 text-xs"><th className="text-left py-2">Venc.</th><th className="text-left py-2">Descrição</th><th className="text-left py-2">Status</th><th className="text-right py-2">Valor</th><th className="text-right py-2 w-24">Ações</th></tr></thead><tbody>{filtered.map(t=><tr key={t.id} className="border-t hover:bg-zinc-50 group"><td className="py-3 text-xs">{(t as any).data_vencimento ? new Date((t as any).data_vencimento).toLocaleDateString('pt-BR') : new Date(t.data).toLocaleDateString('pt-BR')}</td><td className="py-3 font-medium text-xs">{t.descricao}</td><td className="py-3"><span className={`px-2 py-1 rounded-full text-[10px] ${(t as any).status==='a_pagar' ? 'bg-amber-100 text-amber-700' : (t as any).status==='a_receber' ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100'}`}>{(t as any).status||'realizado'}</span></td><td className="py-3 text-right font-bold text-xs">{BRL.format(Number(t.valor))}</td><td className="py-3 text-right text-zinc-400 flex justify-end gap-3 opacity-10 md:opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={()=>toggleStatus(t)} className="hover:text-emerald-600" title="Conciliar / Desconciliar">{['pago','realizado'].includes((t as any).status||'realizado') ? <Undo2 className="w-4 h-4"/> : <Check className="w-4 h-4"/>}</button><button onClick={()=>editar(t)} className="hover:text-violet-600" title="Editar"><Pencil className="w-4 h-4"/></button><button onClick={()=>excluir(t.id)} className="hover:text-red-600" title="Excluir"><Trash2 className="w-4 h-4"/></button></td></tr>)}</tbody></table></div></Card>
      </main>

      <button onClick={()=>setChatOpen(!chatOpen)} className="fixed bottom-6 right-6 bg-violet-600 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-2xl z-30"><MessageCircle className="w-6 h-6"/></button>
      <button onClick={()=>{setModalMode('despesa'); setShowModal(true)}} className="fixed bottom-6 right-24 bg-zinc-900 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-xl z-30"><Plus/></button>

      {chatOpen && (<div className="fixed bottom-24 right-6 w-[92vw] md:w-[380px] z-40"><Card className="shadow-2xl border-violet-200 overflow-hidden flex flex-col max-h-[70vh]"><div className="bg-violet-600 p-4 flex justify-between items-center text-white"><div className="flex items-center gap-2"><Sparkles className="w-4 h-4"/><span className="font-bold text-sm">Controller IA</span></div><button onClick={()=>setChatOpen(false)}><X className="w-4 h-4"/></button></div><div className="p-4 overflow-y-auto flex-1 bg-violet-50/30 text-sm whitespace-pre-wrap">{aiLoading ? "Analisando..." : aiAnswer}</div><div className="p-3 border-t bg-white flex gap-2"><input value={aiQuestion} onChange={e=>setAiQuestion(e.target.value)} onKeyDown={e=>e.key==='Enter'&&askAI()} placeholder="Pergunte algo..." className="flex-1 border rounded-xl px-3 py-2.5 text-sm"/><button onClick={askAI} className="bg-violet-600 text-white p-2.5 rounded-xl"><Send className="w-4 h-4"/></button></div></Card></div>)}

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="bg-white w-full md:max-w-md rounded-t-2xl md:rounded-2xl p-6 space-y-4 max-h-[90vh] overflow-auto">
            <h3 className="font-bold text-lg flex items-center gap-2">{modalMode==='receita' ? 'Nova Receita' : 'Nova Despesa'} {modalMode==='receita' ? <TrendingUp className="w-4 h-4 text-emerald-600"/> : <TrendingDown className="w-4 h-4 text-red-600"/>}</h3>
            
            <div className="flex bg-zinc-100 rounded-xl p-1">
              <button onClick={()=>{setModalMode('receita'); setForm({...form, tipo:'Entrada', status:'a_receber'})}} className={`flex-1 py-2 text-xs rounded-lg font-medium ${modalMode==='receita' ? 'bg-white shadow-sm text-emerald-700' : 'text-zinc-500'}`}>💰 Receita</button>
              <button onClick={()=>{setModalMode('despesa'); setForm({...form, tipo:'Saída', status:'a_pagar'})}} className={`flex-1 py-2 text-xs rounded-lg font-medium ${modalMode==='despesa' ? 'bg-white shadow-sm text-red-700' : 'text-zinc-500'}`}>💸 Despesa</button>
            </div>

            <div>
              <label className="text-[11px] text-zinc-500">Descrição / Título do Lançamento</label>
              <input value={form.descricao} onChange={e=>setForm({...form, descricao: e.target.value})} onBlur={e=>checkDuplicate(e.target.value, form.valor, form.vencimento)} placeholder={modalMode==='receita' ? "Ex: PIX CLIENTE LOJA SILVA" : "Ex: FORNECEDOR ATACADÃO"} className="w-full border rounded-xl p-3 text-sm"/>
            </div>
            {dupWarning && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0"/>{dupWarning}</div>}
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] text-zinc-500">Valor (R$)</label>
                <input type="text" value={form.valor ? Number(form.valor).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2}) : ""} onChange={e=>{ let v = e.target.value.replace(/\D/g, ""); if(!v) { setForm({...form, valor: ""}); return; } setForm({...form, valor: (parseInt(v)/100).toString()}); }} onBlur={e=>checkDuplicate(form.descricao, form.valor, form.vencimento)} placeholder="0,00" className="w-full border rounded-xl p-3 text-sm"/>
              </div>
              <div><label className="text-[11px] text-zinc-500">Empresa</label><select value={form.empresa} onChange={e=>setForm({...form, empresa: e.target.value})} className="w-full border rounded-xl p-3 pr-8 text-sm truncate"><option>BOAH MATRIZ</option><option>SDB</option><option>VILAS</option><option>PASEO</option><option>BARRA</option><option>SOLAR (ADM)</option></select></div>
              <div className="col-span-2 md:col-span-1"><label className="text-[11px] text-zinc-500">Status</label><select value={form.status} onChange={e=>setForm({...form, status: e.target.value})} className="w-full border rounded-xl p-3 pr-8 text-sm truncate">
                {modalMode==='receita' ? <><option value="a_receber">A Receber (Previsto)</option><option value="realizado">Recebido (Realizado)</option></> : <><option value="a_pagar">A Pagar (Previsto)</option><option value="pago">Pago (Realizado)</option><option value="previsto">Previsto</option></>}
              </select></div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-[11px] text-zinc-500">Vencimento</label><input type="date" value={form.vencimento} onChange={e=>setForm({...form, vencimento: e.target.value})} className="w-full border rounded-xl p-3 text-sm"/></div>
              <div><label className="text-[11px] text-zinc-500">Categoria</label><select value={form.categoria} onChange={e=>setForm({...form, categoria: e.target.value})} className="w-full border rounded-xl p-3 pr-8 text-sm truncate"><optgroup label="Gerais"><option>Fixo</option><option>Variável</option><option>Venda</option><option>Fornecedor</option><option>Imposto</option><option>Outros</option></optgroup><optgroup label="Plano de Contas">{CATEGORIAS.map(c=><option key={c} value={c}>{c}</option>)}</optgroup></select></div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-[11px] text-zinc-500">Peças / Itens (Opcional)</label><input value={form.itens} onChange={e=>setForm({...form, itens: e.target.value})} placeholder="Ex: 50 Camisetas" className="w-full border rounded-xl p-3 text-sm"/></div>
              <div><label className="text-[11px] text-zinc-500">Impostos (Opcional)</label><input type="number" value={form.impostos} onChange={e=>setForm({...form, impostos: e.target.value})} placeholder="R$" className="w-full border rounded-xl p-3 text-sm"/></div>
            </div>

            <div className="flex flex-col md:flex-row gap-3 items-center">
              <input value={form.observacao} onChange={e=>setForm({...form, observacao: e.target.value})} placeholder="Observação / Nº Boleto (opcional)" className="w-full md:flex-1 border rounded-xl p-3 text-sm"/>
              <label className="w-full md:w-auto flex items-center justify-center gap-2 text-sm text-zinc-600 bg-zinc-50 px-4 py-3 rounded-xl border cursor-pointer hover:bg-zinc-100 transition"><input type="file" className="hidden" onChange={e=>setComprovanteFile(e.target.files?.[0]||null)}/> 📎 {comprovanteFile ? comprovanteFile.name : 'Anexar Recibo'}</label>
              <label className="w-full md:w-auto flex items-center justify-center gap-2 text-sm text-zinc-600 bg-zinc-50 px-4 py-3 rounded-xl border cursor-pointer hover:bg-zinc-100 transition"><input type="checkbox" checked={form.recorrente} onChange={e=>setForm({...form, recorrente: e.target.checked})} className="w-4 h-4 rounded text-violet-600"/> Repetir Mensalmente</label>
            </div>

            <div className="flex gap-2 pt-2"><button onClick={()=>setShowModal(false)} className="flex-1 border py-3 rounded-xl text-sm">Cancelar</button><button onClick={handleAdd} className={`flex-1 py-3 rounded-xl text-sm font-bold text-white ${modalMode==='receita' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-zinc-900 hover:bg-black'}`}>{modalMode==='receita' ? 'Salvar Receita' : 'Salvar Despesa'}</button></div>
            <p className="text-[10px] text-zinc-400 text-center">Sistema bloqueia duplicado automaticamente por descrição+valor+data</p>
          </div>
        </div>
      )}

      {showImport && (<div className="fixed inset-0 z-50 bg-black/40 flex items-end md:items-center justify-center p-0 md:p-4"><div className="bg-white w-full md:max-w-2xl rounded-t-2xl md:rounded-2xl p-6 space-y-4 max-h-[85vh] overflow-auto"><h3 className="font-bold text-lg">Importar CSV / OFX</h3><input type="file" accept=".csv,.ofx" onChange={handleFileUpload} className="w-full text-sm border-2 border-dashed rounded-xl p-4"/>{csvPreview.length>0 && <><div className="border rounded-xl overflow-auto max-h-64"><table className="w-full text-xs"><thead><tr className="bg-zinc-50"><th className="p-2 text-left">Data</th><th className="p-2">Descrição</th><th className="p-2">Valor</th></tr></thead><tbody>{csvPreview.map(t=><tr key={t.id} className="border-t"><td className="p-2">{t.data}</td><td className="p-2">{t.descricao}</td><td className="p-2">{BRL.format(t.valor)}</td></tr>)}</tbody></table></div><button onClick={async()=>{ const res = await fetch('/api/transactions', { method: 'POST', body: JSON.stringify(csvPreview.map(c=>({...c, status: c.tipo==='Entrada'?'a_receber':'a_pagar', data_vencimento: c.data}))) }); const j = await res.json(); alert(j.duplicados?.length ? `${j.duplicados.length} duplicados bloqueados` : 'Importado!'); setTransactions([...(j.data||csvPreview), ...transactions]); setCsvPreview([]); setShowImport(false); }} className="w-full bg-violet-600 text-white py-3 rounded-xl">Importar {csvPreview.length} (bloqueia duplicados)</button></>}<button onClick={()=>setShowImport(false)} className="w-full border py-3 rounded-xl">Fechar</button></div></div>)}
    </div>
  );
}
