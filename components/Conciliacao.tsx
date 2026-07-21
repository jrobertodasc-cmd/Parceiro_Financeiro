"use client";

import React, { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Upload, ArrowLeftRight, Check, CheckCircle2, ChevronRight, Calculator, AlertTriangle, FileSpreadsheet, Plus } from 'lucide-react';
import { Transaction } from '@/lib/supabase';
import { CATEGORIAS } from '@/lib/categorias';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

interface ConciliacaoProps {
  contas: Transaction[];
  onSuccess: () => void;
}

export default function Conciliacao({ contas, onSuccess }: ConciliacaoProps) {
  const [bankStatements, setBankStatements] = useState<any[]>([]);
  const [selectedBank, setSelectedBank] = useState<any[]>([]);
  const [selectedSystem, setSelectedSystem] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [taxCategory, setTaxCategory] = useState('Taxa de Cartão');
  
  // Apenas as contas pendentes do sistema
  const systemPendentes = useMemo(() => {
    return contas
      .filter(t => t.status === 'a_pagar' || t.status === 'a_receber')
      .sort((a, b) => new Date(a.data_vencimento || a.data).getTime() - new Date(b.data_vencimento || b.data).getTime());
  }, [contas]);

  // Função para parsear OFX (simplificado) ou CSV
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const text = await file.text();
    const isOfx = file.name.toLowerCase().endsWith('.ofx');
    
    const parsed: any[] = [];
    
    if (isOfx) {
      const stmtTrnRegex = /<STMTTRN>[\s\S]*?<\/STMTTRN>/g;
      const matches = text.match(stmtTrnRegex) || [];
      matches.forEach(m => {
        const typeMatch = m.match(/<TRNTYPE>(.*?)(\r?\n|<)/);
        const dateMatch = m.match(/<DTPOSTED>(.*?)(\r?\n|<)/);
        const amtMatch = m.match(/<TRNAMT>(.*?)(\r?\n|<)/);
        const memoMatch = m.match(/<MEMO>(.*?)(\r?\n|<)/);
        
        if (dateMatch && amtMatch) {
          const rawDate = dateMatch[1].substring(0,8);
          const y = rawDate.substring(0,4);
          const mo = rawDate.substring(4,6);
          const d = rawDate.substring(6,8);
          parsed.push({
            id: Math.random().toString(36).substring(7),
            data: `${y}-${mo}-${d}`,
            descricao: memoMatch ? memoMatch[1].trim() : 'Transação Banco',
            valor: Math.abs(parseFloat(amtMatch[1])),
            tipo: parseFloat(amtMatch[1]) < 0 ? 'Saída' : 'Entrada',
            original: parseFloat(amtMatch[1])
          });
        }
      });
    } else {
      // Basic CSV
      const rows = text.split('\n');
      rows.forEach((r, i) => {
        if (i===0 || !r.trim()) return;
        const cols = r.split(',');
        if (cols.length >= 3) {
          const val = parseFloat(cols[2]);
          if (!isNaN(val)) {
            parsed.push({
              id: Math.random().toString(36).substring(7),
              data: cols[0],
              descricao: cols[1],
              valor: Math.abs(val),
              tipo: val < 0 ? 'Saída' : 'Entrada',
              original: val
            });
          }
        }
      });
    }
    
    setBankStatements([...bankStatements, ...parsed].sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime()));
  };

  const totalBank = selectedBank.reduce((acc, t) => acc + (t.tipo === 'Entrada' ? t.valor : -t.valor), 0);
  const totalSystem = selectedSystem.reduce((acc, t) => acc + (t.tipo === 'Entrada' ? t.valor : -t.valor), 0);
  const diferenca = totalBank - totalSystem;
  const isMatchExato = Math.abs(diferenca) < 0.01 && selectedBank.length > 0 && selectedSystem.length > 0;
  const canConciliar = selectedBank.length > 0 && selectedSystem.length > 0;

  const toggleBank = (t: any) => {
    setSelectedBank(prev => prev.find(x => x.id === t.id) ? prev.filter(x => x.id !== t.id) : [...prev, t]);
  };

  const toggleSystem = (t: Transaction) => {
    setSelectedSystem(prev => prev.find(x => x.id === t.id) ? prev.filter(x => x.id !== t.id) : [...prev, t]);
  };

  const processarConciliacao = async () => {
    setLoading(true);
    try {
      const dataPagamento = selectedBank[0]?.data || new Date().toISOString().slice(0, 10);
      
      // 1. Dar baixa nos itens do sistema selecionados
      for (const st of selectedSystem) {
        const novoStatus = st.tipo === 'Entrada' ? 'realizado' : 'pago';
        await fetch('/api/transactions', {
          method: 'PATCH',
          body: JSON.stringify({
            id: st.id,
            status: novoStatus,
            data_pagamento: dataPagamento
          })
        });
      }

      // 2. Se houver diferença (ex: Taxas de cartão, juros, descontos)
      if (Math.abs(diferenca) > 0.01) {
        // Se a diferença for negativa (ex: Recebeu menos do que a venda original, indicando Taxa)
        // Ou se pagou a mais (ex: Juros/Multa).
        // Diferença = Banco (Liquido recebido 980) - Sistema (Bruto 1000) = -20. Significa Saída de 20.
        const tipoDif = diferenca < 0 ? 'Saída' : 'Entrada';
        const payloadDiferenca = {
          data: dataPagamento,
          data_vencimento: dataPagamento,
          data_pagamento: dataPagamento,
          descricao: `[Diferença Conciliação] ${selectedBank.length === 1 ? selectedBank[0].descricao : 'Múltiplos'}`,
          valor: Math.abs(diferenca),
          tipo: tipoDif,
          categoria: taxCategory,
          status: tipoDif === 'Entrada' ? 'realizado' : 'pago',
          empresa: selectedSystem[0]?.empresa || 'BOAH MATRIZ'
        };
        await fetch('/api/transactions', {
          method: 'POST',
          body: JSON.stringify([payloadDiferenca])
        });
      }

      // 3. Limpar a tela e atualizar
      setBankStatements(prev => prev.filter(b => !selectedBank.find(x => x.id === b.id)));
      setSelectedBank([]);
      setSelectedSystem([]);
      alert("Sucesso! Títulos conciliados com perfeição.");
      onSuccess();
    } catch (e) {
      alert("Erro ao conciliar.");
      console.error(e);
    }
    setLoading(false);
  };

  const criarDireto = async (bankItem: any) => {
    setLoading(true);
    try {
      const status = bankItem.tipo === 'Entrada' ? 'realizado' : 'pago';
      const payload = {
        data: bankItem.data,
        data_vencimento: bankItem.data,
        data_pagamento: bankItem.data,
        descricao: bankItem.descricao,
        valor: bankItem.valor,
        tipo: bankItem.tipo,
        categoria: bankItem.tipo === 'Entrada' ? 'Outros' : 'Taxas e Juros',
        status: status,
        empresa: 'BOAH MATRIZ'
      };
      await fetch('/api/transactions', {
        method: 'POST',
        body: JSON.stringify([payload])
      });
      setBankStatements(prev => prev.filter(b => b.id !== bankItem.id));
      alert("Lançamento importado e baixado no sistema diretamente.");
      onSuccess();
    } catch (e) {
      alert("Erro ao importar.");
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between bg-emerald-50 border border-emerald-200 p-4 rounded-xl">
        <div>
          <h2 className="font-bold text-emerald-900 text-lg flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5"/>
            Motor de Conciliação
          </h2>
          <p className="text-emerald-700 text-sm mt-1">
            Cruze o extrato do seu banco ou lote de cartões com os títulos "A Pagar/Receber" do sistema.
          </p>
        </div>
        <div className="relative overflow-hidden">
          <input type="file" accept=".csv,.ofx" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
          <button className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 shadow-sm pointer-events-none">
            <Upload className="w-4 h-4"/> 
            Importar Extrato (OFX)
          </button>
        </div>
      </div>

      {bankStatements.length === 0 && (
        <Card className="p-12 flex flex-col items-center justify-center text-center border-dashed bg-zinc-50/50">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
            <FileSpreadsheet className="w-8 h-8"/>
          </div>
          <h3 className="font-bold text-lg text-zinc-700">Nenhum extrato importado</h3>
          <p className="text-zinc-500 mt-2 max-w-md text-sm">
            Faça o upload do extrato do seu banco no formato OFX para começar a conciliação cruzada (Split-Screen).
          </p>
        </Card>
      )}

      {bankStatements.length > 0 && (
        <>
          {/* ACTION BAR */}
          <div className={`sticky top-4 z-40 bg-zinc-900 text-white rounded-2xl shadow-2xl p-4 transition-all ${canConciliar ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0 pointer-events-none hidden'}`}>
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex gap-6 items-center">
                <div className="text-center">
                  <div className="text-xs text-zinc-400 font-medium">Líquido do Banco</div>
                  <div className={`text-lg font-bold ${totalBank >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {BRL.format(Math.abs(totalBank))} {totalBank >= 0 ? '(Entrada)' : '(Saída)'}
                  </div>
                </div>
                <div className="hidden md:flex"><Calculator className="w-5 h-5 text-zinc-500"/></div>
                <div className="text-center">
                  <div className="text-xs text-zinc-400 font-medium">A Pagar/Receber (Sistema)</div>
                  <div className={`text-lg font-bold ${totalSystem >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {BRL.format(Math.abs(totalSystem))} {totalSystem >= 0 ? '(Entrada)' : '(Saída)'}
                  </div>
                </div>
                <div className="hidden md:flex items-center text-zinc-500"><ChevronRight className="w-5 h-5"/></div>
                <div className="text-center bg-zinc-800 p-2 px-4 rounded-xl">
                  <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold mb-1">
                    {isMatchExato ? 'Match Perfeito!' : 'Diferença de Conciliação'}
                  </div>
                  {isMatchExato ? (
                    <div className="flex justify-center text-emerald-400"><CheckCircle2 className="w-6 h-6"/></div>
                  ) : (
                    <div className="text-lg font-bold text-amber-400">
                      {BRL.format(Math.abs(diferenca))}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex flex-col md:items-end gap-2 w-full md:w-auto">
                {!isMatchExato && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-400">Lançar diferença como:</span>
                    <select 
                      value={taxCategory} 
                      onChange={e => setTaxCategory(e.target.value)}
                      className="bg-zinc-800 border-none text-xs rounded-lg p-1 text-white"
                    >
                      <option>Taxa de Cartão</option>
                      <option>Taxas e Juros</option>
                      <option>Imposto Retido</option>
                      <option>Descontos Concedidos</option>
                      <option>Outros</option>
                    </select>
                  </div>
                )}
                <button 
                  onClick={processarConciliacao}
                  disabled={loading}
                  className="w-full md:w-auto px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl flex justify-center items-center gap-2 transition disabled:opacity-50"
                >
                  {loading ? 'Processando...' : isMatchExato ? 'Conciliar Exato' : 'Conciliar com Ajuste'}
                </button>
              </div>
            </div>
          </div>

          {/* SPLIT SCREEN GRIDS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* COLUNA ESQUERDA: BANCO */}
            <Card className="flex flex-col shadow-sm border-zinc-200 overflow-hidden">
              <div className="bg-zinc-100 p-4 border-b">
                <h3 className="font-bold text-zinc-800 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  Extrato do Banco ({bankStatements.length})
                </h3>
              </div>
              <div className="p-0 overflow-y-auto max-h-[600px]">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50 text-xs text-zinc-500 sticky top-0 shadow-sm">
                    <tr>
                      <th className="w-8 p-3"></th>
                      <th className="text-left p-3">Data</th>
                      <th className="text-left p-3">Lançamento do Banco</th>
                      <th className="text-right p-3">Valor Líquido</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {bankStatements.map(b => {
                      const isSel = !!selectedBank.find(x => x.id === b.id);
                      return (
                        <tr key={b.id} className={`group cursor-pointer transition ${isSel ? 'bg-blue-50' : 'hover:bg-zinc-50'}`} onClick={() => toggleBank(b)}>
                          <td className="p-3 text-center">
                            <input type="checkbox" checked={isSel} readOnly className="rounded border-zinc-300 w-4 h-4 text-blue-600 focus:ring-blue-500 pointer-events-none" />
                          </td>
                          <td className="p-3 text-zinc-500 whitespace-nowrap">{b.data.split('-').reverse().join('/')}</td>
                          <td className="p-3">
                            <div className="font-medium text-zinc-800">{b.descricao}</div>
                            <div className="text-[10px] text-zinc-400 flex items-center gap-2 mt-1">
                              <span className={`px-1.5 py-0.5 rounded ${b.tipo==='Entrada' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{b.tipo}</span>
                              <button onClick={(e)=>{e.stopPropagation(); criarDireto(b);}} className="opacity-0 group-hover:opacity-100 hover:text-emerald-600 flex items-center gap-1 font-semibold transition"><Plus className="w-3 h-3"/> Importar Direto</button>
                            </div>
                          </td>
                          <td className={`p-3 text-right font-bold ${b.tipo==='Entrada' ? 'text-emerald-600' : 'text-red-600'}`}>
                            {b.tipo==='Saída' ? '-' : '+'}{BRL.format(b.valor)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* COLUNA DIREITA: SISTEMA */}
            <Card className="flex flex-col shadow-sm border-zinc-200 overflow-hidden">
              <div className="bg-zinc-100 p-4 border-b flex justify-between items-center">
                <h3 className="font-bold text-zinc-800 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-violet-500"></span>
                  Seu Sistema (A Pagar/Receber)
                </h3>
                <span className="text-xs bg-zinc-200 text-zinc-600 px-2 py-1 rounded font-medium">{systemPendentes.length} Pendentes</span>
              </div>
              <div className="p-0 overflow-y-auto max-h-[600px]">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50 text-xs text-zinc-500 sticky top-0 shadow-sm">
                    <tr>
                      <th className="w-8 p-3"></th>
                      <th className="text-left p-3">Venc.</th>
                      <th className="text-left p-3">Título no Sistema</th>
                      <th className="text-right p-3">Valor Bruto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {systemPendentes.map(s => {
                      const isSel = !!selectedSystem.find(x => x.id === s.id);
                      return (
                        <tr key={s.id} className={`cursor-pointer transition ${isSel ? 'bg-violet-50' : 'hover:bg-zinc-50'}`} onClick={() => toggleSystem(s)}>
                          <td className="p-3 text-center">
                            <input type="checkbox" checked={isSel} readOnly className="rounded border-zinc-300 w-4 h-4 text-violet-600 focus:ring-violet-500 pointer-events-none" />
                          </td>
                          <td className="p-3 text-zinc-500 whitespace-nowrap">{(s.data_vencimento || s.data).split('-').reverse().join('/').substring(0,5)}</td>
                          <td className="p-3">
                            <div className="font-medium text-zinc-800 truncate max-w-[200px]" title={s.descricao}>{s.descricao}</div>
                            <div className="text-[10px] text-zinc-400 flex items-center gap-2 mt-1">
                              <span className={`px-1.5 py-0.5 rounded ${s.tipo==='Entrada' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{s.status}</span>
                              <span className="truncate max-w-[100px]">{s.empresa}</span>
                            </div>
                          </td>
                          <td className={`p-3 text-right font-bold ${s.tipo==='Entrada' ? 'text-emerald-600' : 'text-red-600'}`}>
                            {s.tipo==='Saída' ? '-' : '+'}{BRL.format(s.valor)}
                          </td>
                        </tr>
                      );
                    })}
                    {systemPendentes.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-zinc-400">
                          Nenhum título pendente no sistema.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

          </div>
        </>
      )}
    </div>
  );
}
