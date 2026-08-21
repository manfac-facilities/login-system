-- Captura de leads do site institucional (manfac.com.br).
-- Aplicar à mão no SQL Editor do projeto iyytcavcgukfjnjjrerx (produção).
-- Idempotente: pode ser reaplicado sem estragar nada.

create table if not exists public.site_leads (
  id            uuid primary key default gen_random_uuid(),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz,
  path          text not null,
  nome          text not null,
  email         text not null,
  telefone      text not null,
  consentimento boolean not null,
  consentido_em timestamptz not null,
  consentimento_texto text not null,
  empresa       text,
  cargo         text,
  localidade    text,
  unidades      text,
  resumo        text,
  etapa2_em     timestamptz
);

comment on table public.site_leads is
  'Registro de captura do formulário de /contato. Imutável do ponto de vista do CRM: o CRM cria tabelas crm_* referenciando site_leads.id em vez de alterar esta.';

comment on column public.site_leads.consentimento_texto is
  'Texto de TEXTO_CONSENTIMENTO exibido no momento do aceite. Guardar o texto, não só o booleano e o carimbo: se TEXTO_CONSENTIMENTO mudar no futuro, as linhas antigas continuam apontando para o que a pessoa realmente aceitou.';

-- Única ordenação que a tela de leitura usa.
create index if not exists site_leads_criado_em_desc on public.site_leads (criado_em desc);

-- RLS ligada e NENHUMA policy: nem anon nem authenticated leem ou escrevem.
-- Todo acesso passa por service role, dentro de Server Action ou Server Component.
-- Mesmo padrão de hub_user_roles e hub_system_access depois do fechamento de 10/08.
alter table public.site_leads enable row level security;
