# Financeiro Parceiro - Dashboard de Guerra

Um painel gerencial financeiro completo e inteligente, com suporte a IA (Google Gemini) para insights, análise e classificação automática.

## Configuração Local

1. Instale as dependências:
   ```bash
   npm install
   ```

2. Crie manualmente o arquivo `.env.local` na raiz do projeto, copiando a estrutura de `.env.local.example`:
   ```bash
   cp .env.local.example .env.local
   ```

3. Preencha o `.env.local` com suas chaves (opcional):
   - `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Credenciais do Supabase para banco de dados real.
   - `GEMINI_API_KEY`: Chave da API do Google Generative AI (Gemini).

**⚠️ Importante (Modo MOCK):** 
Se você não configurar a `GEMINI_API_KEY`, o aplicativo ainda **funcionará perfeitamente** em "modo Mock". O assistente virtual IA e a integração de banco de dados fornecerão respostas simuladas (mock) para garantir que você possa testar e visualizar o Dashboard e DRE Gerencial sem custo inicial.

## Execução

Inicie o servidor de desenvolvimento:
```bash
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000) no seu navegador.
