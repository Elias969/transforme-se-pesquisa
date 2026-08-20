# Transforme-se — Pesquisa de validação

Aplicação web responsiva para validar uma ideia do programa **Transforme-se (Senac Recife)** com dois fluxos de pesquisa: **Alunos** e **Empreendedors**. A interface reutiliza a linguagem visual da Ponte: tipografia editorial, base clara, coral, amarelo, cartões arredondados e navegação simples.

## O que está implementado

A tela inicial permite escolher entre “Sou Aluno” e “Sou Empreendedor”. Cada fluxo possui perguntas obrigatórias, avanço por etapas e lógica condicional. No fluxo do aluno, a turma só aparece quando a pessoa responde que participa do Transforme-se. No fluxo do empreendedor, as perguntas sobre impedimentos aparecem para quem não possui site ou tem apenas catálogo, enquanto as perguntas sobre resultados aparecem para quem já possui site profissional. O campo de nome e WhatsApp aparece somente quando o empreendedor demonstra interesse.

As perguntas de múltipla escolha exibem percentuais acumulados de respostas anteriores. A versão imediata salva respostas no `localStorage` do navegador para permitir uma apresentação sem depender de configuração externa. O painel Admin local exibe métricas, respostas mais frequentes, empreendedors interessados e exportação CSV.

> **Importante:** esta entrega está pronta para demonstração local. O armazenamento atual é local ao navegador e a senha do Admin é uma credencial de demonstração. Para uso real com várias pessoas, siga a seção de migração para banco abaixo.

## Requisitos e execução

Instale o Node.js LTS 20 ou superior. No Windows PowerShell, se `pnpm` não estiver no PATH, use o caminho completo:

```powershell
npm install --global pnpm
cd "C:\caminho\para\transforme-se-pesquisa"
& "$env:APPDATA\npm\pnpm.cmd" install
& "$env:APPDATA\npm\pnpm.cmd" dev
```

O script já usa `cross-env`, portanto `NODE_ENV` funciona em Windows, macOS e Linux. Abra o endereço mostrado pelo terminal, normalmente `http://localhost:3000`.

Valide antes de publicar:

```powershell
pnpm check
pnpm test
pnpm build
```

O painel local usa a senha demonstrativa `transforme2026`. Troque essa senha no arquivo `client/src/pages/Home.tsx` antes de entregar uma versão pública baseada apenas em armazenamento local.

## Dados locais e exportação

As respostas são armazenadas na chave `transforme-responses` do `localStorage`. O botão Admin exporta todas as respostas para `transforme-se-respostas.csv`. Para limpar a demonstração, entre no painel Admin e clique em “limpar respostas locais da demonstração”, ou remova a chave pelo DevTools em **Application → Local Storage**.

## Banco de dados recomendado para produção

Para produção, recomendo Supabase Postgres com autenticação do Admin. Crie um projeto em [supabase.com](https://supabase.com), abra o SQL Editor e execute:

```sql
create extension if not exists pgcrypto;

create table if not exists public.survey_responses (
  id uuid primary key default gen_random_uuid(),
  audience text not null check (audience in ('Aluno', 'Empreendedor')),
  answers jsonb not null default '{}'::jsonb,
  contact_name text,
  contact_whatsapp text,
  created_at timestamptz not null default now()
);

create index if not exists survey_responses_audience_idx
  on public.survey_responses (audience);
create index if not exists survey_responses_created_at_idx
  on public.survey_responses (created_at desc);

alter table public.survey_responses enable row level security;

create policy "public can insert survey responses"
  on public.survey_responses for insert
  to anon, authenticated
  with check (audience in ('Aluno', 'Empreendedor'));

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

create policy "admins can read admin_users"
  on public.admin_users for select
  to authenticated
  using (auth.uid() = user_id);

create policy "admins can read survey responses"
  on public.survey_responses for select
  to authenticated
  using (exists (
    select 1 from public.admin_users a where a.user_id = auth.uid()
  ));
```

Depois crie um usuário em **Authentication → Users** no Supabase e insira seu UUID em `admin_users`:

```sql
insert into public.admin_users (user_id)
values ('COLE_AQUI_O_UUID_DO_USUARIO_ADMIN');
```

Nunca coloque a `service_role` key no frontend. No navegador, use somente a chave pública `anon`. Operações administrativas devem ficar protegidas por RLS e autenticação.

## Variáveis de ambiente

Para a versão com Supabase, crie `.env.local` somente localmente:

```env
VITE_SUPABASE_URL=https://SEU_PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SUA_CHAVE_ANON_PUBLICA
```

O arquivo `.env.example` pode ser enviado ao GitHub contendo apenas nomes:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

A versão entregue ainda opera com `localStorage`; a integração Supabase deve substituir as funções locais de leitura e gravação por `insert`, `select` e consultas agregadas.

## Deploy no Vercel

Importe o repositório em [vercel.com/new](https://vercel.com/new). Use `pnpm install` na instalação e `pnpm build` no build. Cadastre `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` em **Settings → Environment Variables** e faça redeploy. Para o servidor Express completo, mantenha o modo Node do template e o comando `pnpm start`; para uma entrega somente frontend, publique a saída estática do Vite conforme a configuração da plataforma.

## Deploy no Netlify

Importe o repositório em [app.netlify.com](https://app.netlify.com), configure `pnpm build`, cadastre as duas variáveis `VITE_` e publique. Se quiser manter o Express como servidor persistente, prefira uma plataforma Node ou adapte a aplicação para funções serverless.

## Publicar no GitHub

```powershell
cd "C:\caminho\para\transforme-se-pesquisa"
git init
git branch -M main
git add .
git diff --cached --name-only
git commit -m "feat: adiciona pesquisa Transforme-se"
gh auth login
gh repo create transforme-se-pesquisa --public --source=. --remote=origin --push
```

Se criar o repositório pelo navegador:

```powershell
git remote add origin https://github.com/SEU_USUARIO/transforme-se-pesquisa.git
git push -u origin main
```

## Arquivos que não devem ser enviados

Não envie `node_modules/`, `dist/`, `.env`, `.env.local`, arquivos `*.local`, logs, dumps de banco, tokens, senhas ou chaves privadas. Antes do commit, confira:

```powershell
git status --short --ignored
Get-ChildItem -Force -Recurse -File | Where-Object { $_.Name -match "\.env|secret|token|password|credential" } | Select-Object FullName
```

## Estrutura principal

| Caminho | Responsabilidade |
| --- | --- |
| `client/src/pages/Home.tsx` | Fluxos, condições, armazenamento local, Admin e CSV |
| `client/src/index.css` | Identidade visual, responsividade e componentes da pesquisa |
| `client/src/App.tsx` | Provedores e roteamento base |
| `server/` e `drizzle/` | Infraestrutura do template para futura persistência server-side |
| `todo.md` | Escopo verificável da entrega |

## Próxima evolução

Para coletar respostas reais de várias pessoas, integre Supabase Auth para o Admin e troque `localStorage` por uma API server-side com validação, rate limiting, RLS e consultas agregadas. Em seguida, o painel pode ganhar gráficos históricos, filtros por período e exportação XLSX.
