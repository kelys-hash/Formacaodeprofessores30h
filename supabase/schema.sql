-- ==========================================================================
-- Formação de Professores — banco de dados (Supabase / PostgreSQL)
--
-- Como usar: no painel do Supabase, abra "SQL Editor", cole este arquivo
-- inteiro e clique em "Run". Pode ser executado mais de uma vez.
-- ==========================================================================

-- --------------------------------------------------------------------------
-- Tabelas
-- --------------------------------------------------------------------------

-- Um perfil por usuário cadastrado (criado automaticamente no cadastro).
create table if not exists public.perfis (
  id         uuid primary key references auth.users (id) on delete cascade,
  nome       text not null default '',
  email      text,
  escola     text not null default '',
  admin      boolean not null default false,
  criado_em  timestamptz not null default now()
);

create table if not exists public.cursos (
  id             uuid primary key default gen_random_uuid(),
  titulo         text not null,
  descricao      text not null default '',
  carga_horaria  numeric(6,1) not null default 0 check (carga_horaria >= 0),
  capa_url       text,
  publicado      boolean not null default false,
  criado_em      timestamptz not null default now()
);

create table if not exists public.aulas (
  id               uuid primary key default gen_random_uuid(),
  curso_id         uuid not null references public.cursos (id) on delete cascade,
  titulo           text not null,
  descricao        text not null default '',
  video_url        text not null,
  duracao_minutos  integer not null default 0 check (duracao_minutos >= 0),
  ordem            integer not null default 0,
  criado_em        timestamptz not null default now()
);

create index if not exists aulas_curso_ordem_idx on public.aulas (curso_id, ordem);

-- Aulas concluídas por cada cursista.
create table if not exists public.progresso (
  usuario_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  aula_id       uuid not null references public.aulas (id) on delete cascade,
  concluida_em  timestamptz not null default now(),
  primary key (usuario_id, aula_id)
);

-- Certificados emitidos. Nome, curso e carga horária ficam gravados no
-- momento da emissão, para que o certificado não mude depois.
create table if not exists public.certificados (
  id             uuid primary key default gen_random_uuid(),
  codigo         text not null unique
                   default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
  usuario_id     uuid not null references auth.users (id) on delete cascade,
  curso_id       uuid not null references public.cursos (id) on delete cascade,
  nome_cursista  text not null,
  titulo_curso   text not null,
  carga_horaria  numeric(6,1) not null,
  emitido_em     timestamptz not null default now(),
  unique (usuario_id, curso_id)
);

-- --------------------------------------------------------------------------
-- Funções auxiliares
-- --------------------------------------------------------------------------

create or replace function public.eh_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select admin from public.perfis where id = auth.uid()), false);
$$;

-- Cria o perfil quando alguém se cadastra.
create or replace function public.criar_perfil()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.perfis (id, nome, email, escola)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nome', ''),
    new.email,
    coalesce(new.raw_user_meta_data ->> 'escola', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.criar_perfil();

-- Emite (ou devolve, se já existir) o certificado do usuário logado.
-- Só funciona quando todas as aulas do curso foram concluídas.
create or replace function public.emitir_certificado(p_curso uuid)
returns public.certificados
language plpgsql security definer set search_path = public
as $$
declare
  v_usuario uuid := auth.uid();
  v_curso   public.cursos;
  v_total   integer;
  v_feitas  integer;
  v_nome    text;
  v_cert    public.certificados;
begin
  if v_usuario is null then
    raise exception 'É preciso estar logado.';
  end if;

  select * into v_cert from public.certificados
   where usuario_id = v_usuario and curso_id = p_curso;
  if found then
    return v_cert;
  end if;

  select * into v_curso from public.cursos where id = p_curso and publicado;
  if not found then
    raise exception 'Curso não encontrado.';
  end if;

  select count(*) into v_total from public.aulas where curso_id = p_curso;
  select count(*) into v_feitas
    from public.progresso p join public.aulas a on a.id = p.aula_id
   where a.curso_id = p_curso and p.usuario_id = v_usuario;

  if v_total = 0 or v_feitas < v_total then
    raise exception 'Conclua todas as aulas para emitir o certificado (% de %).', v_feitas, v_total;
  end if;

  select nullif(trim(nome), '') into v_nome from public.perfis where id = v_usuario;
  if v_nome is null then
    raise exception 'Preencha seu nome completo no perfil antes de emitir o certificado.';
  end if;

  insert into public.certificados (usuario_id, curso_id, nome_cursista, titulo_curso, carga_horaria)
  values (v_usuario, p_curso, v_nome, v_curso.titulo, v_curso.carga_horaria)
  returning * into v_cert;

  return v_cert;
end;
$$;

-- Verificação pública de certificado pelo código (não exige login).
create or replace function public.verificar_certificado(p_codigo text)
returns table (
  codigo text, nome_cursista text, titulo_curso text,
  carga_horaria numeric, emitido_em timestamptz
)
language sql stable security definer set search_path = public
as $$
  select c.codigo, c.nome_cursista, c.titulo_curso, c.carga_horaria, c.emitido_em
    from public.certificados c
   where c.codigo = upper(trim(p_codigo));
$$;

-- Relatório de um curso para o administrador: um cursista por linha.
create or replace function public.relatorio_curso(p_curso uuid)
returns table (
  usuario_id uuid, nome text, email text, escola text,
  aulas_concluidas integer, total_aulas integer,
  minutos_concluidos integer, ultima_atividade timestamptz,
  certificado text
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.eh_admin() then
    raise exception 'Acesso restrito ao administrador.';
  end if;

  return query
  with aulas_do_curso as (
    select id, duracao_minutos from public.aulas where curso_id = p_curso
  ),
  feitas as (
    select p.usuario_id,
           count(*)::integer as qtd,
           sum(a.duracao_minutos)::integer as minutos,
           max(p.concluida_em) as ultima
      from public.progresso p join aulas_do_curso a on a.id = p.aula_id
     group by p.usuario_id
  ),
  participantes as (
    select f.usuario_id from feitas f
    union
    select c.usuario_id from public.certificados c where c.curso_id = p_curso
  )
  select pa.usuario_id, pe.nome, pe.email, pe.escola,
         coalesce(f.qtd, 0),
         (select count(*)::integer from aulas_do_curso),
         coalesce(f.minutos, 0),
         f.ultima,
         c.codigo
    from participantes pa
    join public.perfis pe on pe.id = pa.usuario_id
    left join feitas f on f.usuario_id = pa.usuario_id
    left join public.certificados c on c.usuario_id = pa.usuario_id and c.curso_id = p_curso
   order by pe.nome;
end;
$$;

-- Permite ao administrador dar ou tirar acesso de administrador a alguém.
create or replace function public.definir_admin(p_usuario uuid, p_admin boolean)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.eh_admin() then
    raise exception 'Acesso restrito ao administrador.';
  end if;
  if p_usuario = auth.uid() and not p_admin then
    raise exception 'Você não pode remover o seu próprio acesso de administrador.';
  end if;
  update public.perfis set admin = p_admin where id = p_usuario;
end;
$$;

-- --------------------------------------------------------------------------
-- Segurança (Row Level Security)
-- --------------------------------------------------------------------------

alter table public.perfis       enable row level security;
alter table public.cursos       enable row level security;
alter table public.aulas        enable row level security;
alter table public.progresso    enable row level security;
alter table public.certificados enable row level security;

-- Perfis: cada um vê e edita o próprio; o admin vê todos.
-- O campo "admin" só muda pela função definir_admin.
revoke update on public.perfis from anon, authenticated;
grant update (nome, escola) on public.perfis to authenticated;

drop policy if exists "perfil: ler" on public.perfis;
create policy "perfil: ler" on public.perfis
  for select to authenticated
  using (id = auth.uid() or public.eh_admin());

drop policy if exists "perfil: editar o próprio" on public.perfis;
create policy "perfil: editar o próprio" on public.perfis
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Cursos: todos veem os publicados; o admin vê e gerencia todos.
drop policy if exists "cursos: ler" on public.cursos;
create policy "cursos: ler" on public.cursos
  for select to anon, authenticated
  using (publicado or public.eh_admin());

drop policy if exists "cursos: admin gerencia" on public.cursos;
create policy "cursos: admin gerencia" on public.cursos
  for all to authenticated
  using (public.eh_admin()) with check (public.eh_admin());

-- Aulas: só usuários logados veem (e só de cursos publicados); admin gerencia.
drop policy if exists "aulas: ler" on public.aulas;
create policy "aulas: ler" on public.aulas
  for select to authenticated
  using (
    public.eh_admin()
    or exists (select 1 from public.cursos c where c.id = curso_id and c.publicado)
  );

drop policy if exists "aulas: admin gerencia" on public.aulas;
create policy "aulas: admin gerencia" on public.aulas
  for all to authenticated
  using (public.eh_admin()) with check (public.eh_admin());

-- Progresso: cada um registra e vê o próprio; admin vê todos.
drop policy if exists "progresso: ler" on public.progresso;
create policy "progresso: ler" on public.progresso
  for select to authenticated
  using (usuario_id = auth.uid() or public.eh_admin());

drop policy if exists "progresso: marcar" on public.progresso;
create policy "progresso: marcar" on public.progresso
  for insert to authenticated
  with check (
    usuario_id = auth.uid()
    and exists (
      select 1 from public.aulas a join public.cursos c on c.id = a.curso_id
       where a.id = aula_id and c.publicado
    )
  );

drop policy if exists "progresso: desmarcar" on public.progresso;
create policy "progresso: desmarcar" on public.progresso
  for delete to authenticated
  using (usuario_id = auth.uid());

-- Certificados: cada um vê os próprios; admin vê todos.
-- A emissão acontece só pela função emitir_certificado.
drop policy if exists "certificados: ler" on public.certificados;
create policy "certificados: ler" on public.certificados
  for select to authenticated
  using (usuario_id = auth.uid() or public.eh_admin());

-- --------------------------------------------------------------------------
-- Permissões das funções
-- --------------------------------------------------------------------------

revoke execute on function public.emitir_certificado(uuid)      from public, anon;
revoke execute on function public.relatorio_curso(uuid)         from public, anon;
revoke execute on function public.definir_admin(uuid, boolean)  from public, anon;
revoke execute on function public.criar_perfil()                from public, anon, authenticated;

grant execute on function public.emitir_certificado(uuid)      to authenticated;
grant execute on function public.relatorio_curso(uuid)         to authenticated;
grant execute on function public.definir_admin(uuid, boolean)  to authenticated;
grant execute on function public.verificar_certificado(text)   to anon, authenticated;
grant execute on function public.eh_admin()                    to anon, authenticated;

-- --------------------------------------------------------------------------
-- Primeiro administrador
--
-- Depois de criar sua conta pelo site, rode a linha abaixo (com o seu
-- e-mail) para virar administrador:
--
--   update public.perfis set admin = true where email = 'seu-email@exemplo.com';
-- --------------------------------------------------------------------------
