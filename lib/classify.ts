import { Categoria } from "./mock";

export function classifyWithAI(desc: string): Categoria {
  const normalized = desc.toUpperCase();

  if (normalized.includes("VENDA") || normalized.includes("PIX RECEBIDO") || normalized.includes("CLIENTE")) {
    return "Venda";
  }
  
  if (normalized.includes("ALUGUEL") || normalized.includes("LUZ") || normalized.includes("CONTADOR") || normalized.includes("CONDOMINIO")) {
    return "Fixo";
  }
  
  if (normalized.includes("FORNECEDOR") || normalized.includes("ATACAD") || normalized.includes("COMPRA")) {
    return "Fornecedor";
  }
  
  if (normalized.includes("IMPOSTO") || normalized.includes("DAS") || normalized.includes("DARF") || normalized.includes("INSS")) {
    return "Imposto";
  }
  
  if (normalized.includes("UBER") || normalized.includes("99") || normalized.includes("COMBUST") || normalized.includes("IFOOD")) {
    return "Variável";
  }

  return "Outros";
}
