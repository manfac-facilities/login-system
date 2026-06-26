create table public.equipes (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  centro_custo text,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.veiculos (
  id uuid primary key default gen_random_uuid(),
  placa text not null unique,
  modelo text not null,
  ano integer,
  km_atual integer not null default 0,
  km_contratual_mensal integer,
  valor_locacao_mensal numeric(10,2),
  status text not null default 'ativo',
  equipe_id uuid references public.equipes(id),
  created_at timestamptz not null default now()
);

create table public.motoristas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cnh text,
  cnh_vencimento date,
  contato text,
  equipe_id uuid references public.equipes(id),
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.km_diario (
  id uuid primary key default gen_random_uuid(),
  data date not null default current_date,
  equipe_id uuid not null references public.equipes(id),
  veiculo_id uuid not null references public.veiculos(id),
  motorista_id uuid references public.motoristas(id),
  km_inicial integer not null,
  km_final integer,
  observacoes text,
  created_at timestamptz not null default now(),
  unique(data, equipe_id)
);

create table public.checklist (
  id uuid primary key default gen_random_uuid(),
  tipo text not null,
  data timestamptz not null default now(),
  equipe_id uuid not null references public.equipes(id),
  veiculo_id uuid not null references public.veiculos(id),
  motorista_id uuid references public.motoristas(id),
  equipe_destino_id uuid references public.equipes(id),
  motorista_destino_id uuid references public.motoristas(id),
  lataria_ok boolean,
  vidros_ok boolean,
  pneus_ok boolean,
  combustivel_ok boolean,
  itens_internos_ok boolean,
  estepe_ok boolean,
  macaco_ok boolean,
  triangulo_ok boolean,
  avaria_identificada boolean not null default false,
  avaria_descricao text,
  chave_entregue boolean,
  cartao_combustivel_entregue boolean,
  assinatura_motorista boolean not null default false,
  observacoes text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.checklist_fotos (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references public.checklist(id) on delete cascade,
  storage_path text not null,
  posicao text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  tirada_em timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.multas (
  id uuid primary key default gen_random_uuid(),
  veiculo_id uuid references public.veiculos(id),
  motorista_id uuid references public.motoristas(id),
  data date not null,
  descricao text not null,
  valor numeric(10,2) not null,
  valor_descontado numeric(10,2),
  tipo_desconto text not null default 'nenhum',
  status text not null default 'pendente',
  autorizacao_assinada boolean not null default false,
  autorizacao_storage_path text,
  ziv_task_id text,
  observacoes text,
  created_at timestamptz not null default now()
);

create table public.sinistros (
  id uuid primary key default gen_random_uuid(),
  veiculo_id uuid references public.veiculos(id),
  motorista_id uuid references public.motoristas(id),
  data date not null,
  tipo text not null default 'avaria',
  descricao text not null,
  valor_dano numeric(10,2),
  valor_descontado numeric(10,2),
  tipo_desconto text not null default 'nenhum',
  autorizacao_assinada boolean not null default false,
  autorizacao_storage_path text,
  status text not null default 'aberto',
  observacoes text,
  created_at timestamptz not null default now()
);

create table public.sinistro_fotos (
  id uuid primary key default gen_random_uuid(),
  sinistro_id uuid not null references public.sinistros(id) on delete cascade,
  storage_path text not null,
  created_at timestamptz not null default now()
);

create table public.revisoes (
  id uuid primary key default gen_random_uuid(),
  veiculo_id uuid not null references public.veiculos(id),
  tipo text not null default 'preventiva',
  fornecedor text,
  valor numeric(10,2),
  nota_fiscal_storage_path text,
  data_realizada date,
  km_realizada integer,
  proxima_data date,
  proxima_km integer,
  status text not null default 'agendada',
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.documentos_veiculo (
  id uuid primary key default gen_random_uuid(),
  veiculo_id uuid not null references public.veiculos(id),
  tipo text not null,
  numero text,
  vencimento date not null,
  storage_path text,
  created_at timestamptz not null default now()
);

create table public.abastecimentos (
  id uuid primary key default gen_random_uuid(),
  veiculo_id uuid not null references public.veiculos(id),
  data date not null default current_date,
  litros numeric(8,2) not null,
  valor numeric(10,2) not null,
  km integer,
  posto text,
  created_at timestamptz not null default now()
);

create table public.motorista_documentos (
  id uuid primary key default gen_random_uuid(),
  motorista_id uuid not null references public.motoristas(id),
  tipo text not null,
  assinado boolean not null default false,
  data_assinatura date,
  storage_path text,
  multa_id uuid references public.multas(id),
  sinistro_id uuid references public.sinistros(id),
  created_at timestamptz not null default now()
);

create table public.veiculo_responsabilidade_historico (
  id uuid primary key default gen_random_uuid(),
  veiculo_id uuid not null references public.veiculos(id),
  equipe_id uuid references public.equipes(id),
  motorista_id uuid references public.motoristas(id),
  inicio date not null,
  fim date,
  origem_checklist_id uuid references public.checklist(id),
  created_at timestamptz not null default now()
);

create table public.centro_custo_historico (
  id uuid primary key default gen_random_uuid(),
  veiculo_id uuid not null references public.veiculos(id),
  centro_custo text not null,
  vigente_desde date not null,
  created_at timestamptz not null default now()
);

create table public.pendencias (
  id uuid primary key default gen_random_uuid(),
  descricao text not null,
  origem text not null default 'manual',
  responsavel text,
  prazo date,
  proxima_acao text,
  status text not null default 'aberta',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
