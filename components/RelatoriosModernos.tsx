"use client";

import React, { useState, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { 
  Calendar, Filter, Building2, TrendingUp, TrendingDown, DollarSign, PieChart as PieChartIcon 
} from 'lucide-react';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

interface RelatoriosModernosProps {
  contas: any[];
}

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1', '#14b8a6', '#f97316', '#84cc16'];

export default function RelatoriosModernos({ contas }: RelatoriosModernosProps) {
  // Configuração inicial de datas (Mês Atual por padrão)
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

  const [dataInicio, setDataInicio] = useState(firstDay);
  const [dataFim, setDataFim] = useState(lastDay);
  const [empresaFiltro, setEmpresaFiltro] = useState('TODAS');
  
  // Extrair todas as empresas
  const empresas = useMemo(() => {
    const set = new Set<string>();
    contas.forEach(c => { if (c.empresa) set.add(c.empresa); });
    return ['TODAS', ...Array.from(set).sort()];
  }, [contas]);

  // Aplicar Filtros
  const filtradas = useMemo(() => {
    return contas.filter(t => {
      const dataRef = (t.data_vencimento || t.data || '').slice(0, 10);
      if (dataRef < dataInicio || dataRef > dataFim) return false;
      if (empresaFiltro !== 'TODAS' && t.empresa !== empresaFiltro) return false;
      return true;
    });
  }, [contas, dataInicio, dataFim, empresaFiltro]);

  // Calcular KPIs e DRE Dinâmica
  const metrics = useMemo(() => {
    let receita = 0;
    let deducoes = 0;
    let cmv = 0;
    let despOperacionais = 0;
    let resFinanceiro = 0;
    let impostos = 0;
    let despesasChart: Record<string, number> = {};
    let fluxoChart: Record<string, { Entrada: number, Saida: number }> = {};

    filtradas.forEach(t => {
      const val = Number(t.valor) || 0;
      const cat = (t.categoria || '').toUpperCase();
      const desc = (t.descricao || '').toUpperCase();
      const mes = (t.data_vencimento || t.data || '').slice(0, 7); // YYYY-MM
      
      if (!fluxoChart[mes]) fluxoChart[mes] = { Entrada: 0, Saida: 0 };

      if (t.tipo === 'Entrada') {
        receita += val;
        fluxoChart[mes].Entrada += val;
      } else {
        fluxoChart[mes].Saida += val;
        despesasChart[t.categoria || 'Sem Categoria'] = (despesasChart[t.categoria || 'Sem Categoria'] || 0) + val;

        if (cat.startsWith('3 -') || cat.startsWith('223') || cat.includes('IMPOSTO SOBRE VENDA') || cat.includes('SIMPLES NACIONAL')) deducoes += val;
        else if (cat.startsWith('121') || cat.includes('FORNECEDOR') || cat.includes('TECIDO') || cat.includes('EMBALAGEM') || cat.includes('FRETE')) cmv += val;
        else if (cat.includes('TARIFA') || cat.includes('JUROS') || cat.includes('FINANCEIRO')) resFinanceiro += val;
        else if (desc.includes('IRPJ') || desc.includes('CSLL')) impostos += val;
        else despOperacionais += val;
      }
    });

    const recLiq = receita - deducoes;
    const lucroBruto = recLiq - cmv;
    const ebitda = lucroBruto - despOperacionais;
    const lucroLiquido = ebitda - resFinanceiro - impostos;
    const margem = receita > 0 ? (lucroLiquido / receita) * 100 : 0;

    // Formatar Dados para Gráficos
    const fluxoData = Object.entries(fluxoChart).sort((a,b)=>a[0].localeCompare(b[0])).map(([m, v]) => ({
      name: `${m.slice(5,7)}/${m.slice(2,4)}`,
      Receitas: v.Entrada,
      Despesas: v.Saida
    }));

    const despesasData = Object.entries(despesasChart)
      .map(([name, value]) => ({ name, value }))
      .sort((a,b) => b.value - a.value)
      .slice(0, 10); // Top 10 categorias

    return {
      receita, deducoes, cmv, despOperacionais, resFinanceiro, impostos,
      recLiq, lucroBruto, ebitda, lucroLiquido, margem,
      fluxoData, despesasData
    };
  }, [filtradas]);

  return (
    <div className="p-2 sm:p-6 max-w-7xl mx-auto space-y-6">
      
      {/* Barra de Filtros Avançados */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-zinc-200 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs font-semibold text-zinc-500 mb-1 uppercase tracking-wider"><Calendar className="w-3 h-3 inline mr-1"/> Data Inicial</label>
          <input type="date" value={dataInicio} onChange={e=>setDataInicio(e.target.value)} className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 outline-none transition" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-zinc-500 mb-1 uppercase tracking-wider"><Calendar className="w-3 h-3 inline mr-1"/> Data Final</label>
          <input type="date" value={dataFim} onChange={e=>setDataFim(e.target.value)} className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 outline-none transition" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-zinc-500 mb-1 uppercase tracking-wider"><Building2 className="w-3 h-3 inline mr-1"/> Empresa</label>
          <select value={empresaFiltro} onChange={e=>setEmpresaFiltro(e.target.value)} className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 outline-none transition cursor-pointer">
            {empresas.map(emp => <option key={emp} value={emp}>{emp}</option>)}
          </select>
        </div>
        
        <div className="ml-auto flex items-center gap-2">
           <div className="text-xs text-zinc-500">
             <span className="font-bold text-zinc-800">{filtradas.length}</span> registros no período
           </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-zinc-200 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition"><TrendingUp className="w-16 h-16 text-emerald-500"/></div>
          <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Receita Bruta</p>
          <p className="text-2xl font-black text-emerald-600">{BRL.format(metrics.receita)}</p>
        </div>
        
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-zinc-200 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition"><TrendingDown className="w-16 h-16 text-red-500"/></div>
          <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Custos (CMV + D.Op)</p>
          <p className="text-2xl font-black text-red-600">{BRL.format(metrics.cmv + metrics.despOperacionais)}</p>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-zinc-200 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition"><DollarSign className="w-16 h-16 text-violet-500"/></div>
          <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Lucro Líquido</p>
          <p className={`text-2xl font-black ${metrics.lucroLiquido >= 0 ? 'text-violet-600' : 'text-red-600'}`}>{BRL.format(metrics.lucroLiquido)}</p>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-zinc-200 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition"><PieChartIcon className="w-16 h-16 text-blue-500"/></div>
          <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Margem Líquida</p>
          <p className={`text-2xl font-black ${metrics.margem >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{metrics.margem.toFixed(2)}%</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-zinc-200">
          <h3 className="text-sm font-bold text-zinc-800 mb-6 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-violet-500"/> Evolução: Entradas vs Saídas</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.fluxoData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#71717a'}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#71717a'}} tickFormatter={(val) => `R$ ${(val/1000).toFixed(0)}k`} />
                <RechartsTooltip cursor={{fill: '#f4f4f5'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} formatter={(value: number) => BRL.format(value)} />
                <Legend iconType="circle" wrapperStyle={{fontSize: '12px', paddingTop: '20px'}} />
                <Bar dataKey="Receitas" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-zinc-200">
          <h3 className="text-sm font-bold text-zinc-800 mb-6 flex items-center gap-2"><PieChartIcon className="w-4 h-4 text-blue-500"/> Top 10 Categorias de Despesa</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={metrics.despesasData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2} dataKey="value" stroke="none">
                  {metrics.despesasData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} formatter={(value: number) => BRL.format(value)} />
                <Legend layout="vertical" verticalAlign="middle" align="right" iconType="circle" wrapperStyle={{fontSize: '11px', lineHeight: '24px'}} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* DRE Dinâmica */}
      <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
        <div className="bg-zinc-50 border-b border-zinc-200 p-4">
          <h3 className="text-sm font-bold text-zinc-800 flex items-center gap-2"><Filter className="w-4 h-4 text-emerald-500"/> DRE Estruturada (Período Selecionado)</h3>
        </div>
        <div className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-zinc-100 hover:bg-zinc-50"><td className="py-3 px-4 font-bold text-emerald-700">= Receita Bruta</td><td className="py-3 px-4 text-right font-bold text-emerald-700">{BRL.format(metrics.receita)}</td></tr>
              <tr className="border-b border-zinc-100 hover:bg-zinc-50"><td className="py-3 px-4 text-red-600 pl-8">- Deduções / Impostos sobre Venda</td><td className="py-3 px-4 text-right text-red-600">{BRL.format(metrics.deducoes)}</td></tr>
              <tr className="border-b border-zinc-100 hover:bg-zinc-50 bg-zinc-50"><td className="py-3 px-4 font-bold text-zinc-800">= Receita Líquida</td><td className="py-3 px-4 text-right font-bold text-zinc-800">{BRL.format(metrics.recLiq)}</td></tr>
              <tr className="border-b border-zinc-100 hover:bg-zinc-50"><td className="py-3 px-4 text-red-600 pl-8">- Custo das Mercadorias (CMV)</td><td className="py-3 px-4 text-right text-red-600">{BRL.format(metrics.cmv)}</td></tr>
              <tr className="border-b border-zinc-100 hover:bg-zinc-50 bg-zinc-50"><td className="py-3 px-4 font-bold text-zinc-800">= Lucro Bruto</td><td className="py-3 px-4 text-right font-bold text-zinc-800">{BRL.format(metrics.lucroBruto)}</td></tr>
              <tr className="border-b border-zinc-100 hover:bg-zinc-50"><td className="py-3 px-4 text-red-600 pl-8">- Despesas Operacionais</td><td className="py-3 px-4 text-right text-red-600">{BRL.format(metrics.despOperacionais)}</td></tr>
              <tr className="border-b border-zinc-100 hover:bg-zinc-50 bg-violet-50"><td className="py-3 px-4 font-bold text-violet-800">= EBITDA (Lucro Operacional)</td><td className="py-3 px-4 text-right font-bold text-violet-800">{BRL.format(metrics.ebitda)}</td></tr>
              <tr className="border-b border-zinc-100 hover:bg-zinc-50"><td className="py-3 px-4 text-red-600 pl-8">- Resultado Financeiro (Juros/Tarifas)</td><td className="py-3 px-4 text-right text-red-600">{BRL.format(metrics.resFinanceiro)}</td></tr>
              <tr className="border-b border-zinc-100 hover:bg-zinc-50"><td className="py-3 px-4 text-red-600 pl-8">- IRPJ / CSLL</td><td className="py-3 px-4 text-right text-red-600">{BRL.format(metrics.impostos)}</td></tr>
              <tr className="hover:bg-zinc-50 bg-zinc-100"><td className="py-4 px-4 font-black text-zinc-900 text-base">= LUCRO LÍQUIDO</td><td className={`py-4 px-4 text-right font-black text-base ${metrics.lucroLiquido >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{BRL.format(metrics.lucroLiquido)}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
