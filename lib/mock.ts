export type Categoria = "Fixo" | "Variável" | "Venda" | "Fornecedor" | "Imposto" | "Outros";

export type Transaction = {
  id: string;
  data: string;
  descricao: string;
  categoria: Categoria;
  tipo: "Entrada" | "Saída";
  valor: number;
};

const mockDescriptions = [
  { desc: "PIX RECEBIDO CLIENTE MARIA", cat: "Venda", tipo: "Entrada" },
  { desc: "PGTO ALUGUEL GALPÃO", cat: "Fixo", tipo: "Saída" },
  { desc: "PAGAMENTO FORNECEDOR ATACADAO", cat: "Fornecedor", tipo: "Saída" },
  { desc: "PAGAMENTO DAS MEI", cat: "Imposto", tipo: "Saída" },
  { desc: "UBER CLIENTE REUNIAO", cat: "Variável", tipo: "Saída" },
  { desc: "VENDA BALCAO DINHEIRO", cat: "Venda", tipo: "Entrada" },
  { desc: "CONTA DE LUZ", cat: "Fixo", tipo: "Saída" },
  { desc: "COMPRA SUPRIMENTOS KABUM", cat: "Fornecedor", tipo: "Saída" },
  { desc: "IFOOD ALMOCO EQUIPE", cat: "Variável", tipo: "Saída" },
  { desc: "PIX RECEBIDO JOAO", cat: "Venda", tipo: "Entrada" },
  { desc: "CONTABILIDADE MENSAL", cat: "Fixo", tipo: "Saída" },
  { desc: "PAGAMENTO DARF", cat: "Imposto", tipo: "Saída" },
  { desc: "COMBUSTIVEL POSTO IPIRANGA", cat: "Variável", tipo: "Saída" },
  { desc: "VENDA CARTAO DE CREDITO", cat: "Venda", tipo: "Entrada" },
  { desc: "FORNECEDOR EMBALAGENS", cat: "Fornecedor", tipo: "Saída" }
];

export function generateMockTransactions(): Transaction[] {
  const transactions: Transaction[] = [];
  const today = new Date();
  
  for (let i = 0; i < 35; i++) {
    // Random date in the last 30 days
    const daysAgo = Math.floor(Math.random() * 30);
    const date = new Date(today);
    date.setDate(today.getDate() - daysAgo);
    
    // Pick random mock template
    const template = mockDescriptions[Math.floor(Math.random() * mockDescriptions.length)];
    
    // Random value between 80 and 5500
    const rawValue = Math.random() * (5500 - 80) + 80;
    const valor = parseFloat(rawValue.toFixed(2));
    
    transactions.push({
      id: Math.random().toString(36).substring(2, 9),
      data: date.toISOString().split('T')[0],
      descricao: template.desc,
      categoria: template.cat as Categoria,
      tipo: template.tipo as "Entrada" | "Saída",
      valor
    });
  }
  
  // Sort by date descending
  return transactions.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
}
