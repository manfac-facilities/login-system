# Sistema Conversor de OS — Design

> Status: aprovado. Pronto para virar plano de implementação.

## Contexto

Novo módulo do hub Manfac chamado **Conversor OS**. Converte planilhas de OS de clientes (DPSP e D1000) para o formato de importação do Field Control.

Hoje esse processo é manual. O PCM filtra a planilha do cliente e o sistema deve fazer apenas o de/para das colunas — filtros operacionais continuam sendo responsabilidade do PCM (com exceção dos filtros específicos do D1000 descritos abaixo, que são regras fixas de negócio, não decisões do PCM).

- **Repositório:** `C:\Users\joao-\projeto-01-elite-da-ia` (hub Manfac, Next.js + Supabase)
- **Pasta de referência:** `sistema-os/` com premissa, planilhas DPSP, D1000 e modelo Field Control

---

## Seção 1 — Arquitetura geral

### Rotas novas
```
/conversor-os               → Módulo principal (upload + conversão + download)
/conversor-os/historico     → Log de importações
/admin/acessos              → Gestão de acessos (admin only)
```

### Dashboard
- Card **Conversor OS** adicionado ao `/dashboard`
- Card **Admin** visível apenas para admins

### Proteção de acesso
- Middleware verifica `hub_system_access` antes de entrar em `/conversor-os`
- `/admin/acessos` requer `user_metadata.is_admin = true`

### API
- `POST /api/conversor-os/processar` — recebe `multipart/form-data` (arquivo + cliente selecionado no dropdown)
- Processa com `exceljs` no servidor
- Server Action salva log no Supabase e o arquivo gerado no Supabase Storage

### Banco de dados (2 tabelas novas)
```sql
conversor_os_imports (
  id, user_id, user_email, cliente, filename,
  imported_at, total_rows, converted_rows,
  errors, duplicates_removed, storage_path, created_at
)

hub_system_access (
  id, user_email, system_slug, has_access,
  granted_by, created_at
)
-- system_slug ex: 'conversor-os', 'sofia'
```

### Mapeamento de colunas

#### Planilha DPSP → Field Control
- **Aba:** `Extrato do CICLO OS Corretiva+Prev - JG` (única aba)
- **Cabeçalho:** linha 4 (buscar por "Nº Chamado" na Col A)
- **Dados:** a partir da linha 5

| Field Control | Coluna | Origem DPSP |
|---|---|---|
| A — Identificador | A | Col A — Nº Chamado |
| B — Tipo de OS | B | Fixo: "Manutenção Corretiva" |
| C — Documento do cliente | C | Vazio |
| D — Nome do cliente | D | Fixo: "DPSP" |
| E — Nome da localização | E | Col H — Sobrenome do Solicitante |
| F — Número de série | F | Vazio |
| G — Nome do colaborador | G | Vazio |
| H — Colaboradores secundários | H | Vazio |
| I — Data de agendamento | I | Vazio |
| J — Hora de agendamento | J | Vazio |
| K — Descrição | K | Col F — Descrição |
| L — Descrição da tarefa | L | Vazio |
| M — Etiquetas | M | Vazio |

**Campos obrigatórios DPSP:** Col A, Col H, Col F

#### Planilha D1000 → Field Control
- **Aba:** `CHAMADOS`
- **Cabeçalho:** linha 1
- **Dados:** a partir da linha 2

**Filtros (regras fixas de negócio, aplicados antes da conversão):**
- Coluna D (Grupo Analista Atual) deve conter "MANFAC"
- Coluna B (Bandeira) ≠ "ROSARIO"

**Concatenação de localização:**
```
TAMOIO    → TMO
DROGASMIL → DML
FARMALIFE → FML
Formato:  {ABREVIAÇÃO}-{NÚMERO_LOJA}
Exemplo:  TMO-180, DML-611, FML-624
```

| Field Control | Coluna | Origem D1000 |
|---|---|---|
| A — Identificador | A | Col A — Codigo |
| B — Tipo de OS | B | Fixo: "Manutenção Corretiva" |
| C — Documento do cliente | C | Vazio |
| D — Nome do cliente | D | Fixo: "D1000" |
| E — Nome da localização | E | Bandeira abreviada + "-" + Loja (Col B + Col C) |
| F–J | F–J | Vazio |
| K — Descrição | K | Col H — Descrição do Problema |
| L — Descrição da tarefa | L | Vazio |
| M — Etiquetas | M | Vazio |

**Campos obrigatórios D1000:** Col A, Col E (resultado da concatenação), Col H

---

## Seção 2 — Fluxo de conversão detalhado

### Tela principal `/conversor-os`
1. Dropdown "Cliente": DPSP ou D1000 (seleção explícita, sem detecção automática)
2. Upload do arquivo (.xlsx)
3. Botão "Converter"

### Processamento server-side (`POST /api/conversor-os/processar`)
Ordem de execução:
1. Parse com `exceljs`; localizar aba e linha de cabeçalho conforme cliente selecionado. Se a estrutura esperada não for encontrada, abortar com erro antes de processar qualquer linha (ver Seção 3).
2. Se D1000: aplicar filtros fixos (Col D contém "MANFAC", Col B ≠ "ROSARIO")
3. Deduplicar por Identificador (Col A) — mantém a primeira ocorrência; ocorrências repetidas são contadas como "duplicados removidos"
4. Validar campos obrigatórios linha a linha — linhas inválidas são excluídas da conversão e registradas como erro com motivo (ex: "linha 23: falta Sobrenome do Solicitante")
5. Mapear colunas → formato Field Control (Seção 1)
6. Gerar o .xlsx de saída em memória + montar dados para preview

### Tela de preview (antes de confirmar download)
- Resumo: total de linhas na origem, total convertido, total excluído por erro (lista expansível com motivo por linha), total de duplicados removidos
- Tabela de preview das primeiras linhas convertidas
- Botão **"Baixar arquivo"** → salva o .xlsx no Supabase Storage, grava log em `conversor_os_imports`, dispara o download
- Botão **"Cancelar"** → descarta tudo, nada é salvo

### Tela `/conversor-os/historico`
- Lista (mais recente primeiro): data, cliente, usuário (admin vê todos; usuário comum vê só o próprio), total convertido, erros, duplicados
- Botão "baixar novamente" por item → recupera o arquivo do Supabase Storage via `storage_path`

### Tela `/admin/acessos`
- Tabela com todos os usuários do hub, um toggle por sistema (Conversor OS, Sofia, futuros)
- Mudança no toggle grava em `hub_system_access`

---

## Seção 3 — Erros e detalhes técnicos

### Arquivo não bate com o cliente selecionado
Antes de processar qualquer linha, o sistema valida a estrutura esperada (aba e cabeçalho) para o cliente escolhido no dropdown. Se não encontrar, retorna erro específico e não gera nada — por exemplo:
> `Aba "CHAMADOS" não encontrada — confira se selecionou o cliente certo`

Isso evita confundir "escolhi o cliente errado" com "todas as linhas têm erro de campo obrigatório".

### Nome do arquivo de saída
Padrão: `{cliente}-convertido-{AAAAMMDD-HHmm}.xlsx`
Exemplo: `DPSP-convertido-20260630-1432.xlsx`

### Retenção no Storage
Sem expiração na v1 — arquivos convertidos ficam disponíveis para re-download indefinidamente no histórico. Limpeza automática pode ser adicionada depois se o volume justificar.

---

## Arquivos de referência
- `sistema-os/Premissa — Sistema de Conversão de OS para Field Control.docx`
- `sistema-os/CLIENTE-DPSP_Relatório_Chamados_30-06-2026_12866.xlsx`
- `sistema-os/CLIENTE-D1000.xlsx`
- `sistema-os/modelo-ordens-de serviço (1).xlsx`
- `sistema-os/exemplo d1000.jpeg`
