-- Inicio de sesión con Supabase Auth: miembros del hogar y registro de quién hizo qué.

-- Personas con acceso al hogar. Solo un miembro activo puede usar la app (aunque tenga cuenta en Auth).
create table if not exists miembros (
  usuario_id uuid primary key,            -- id del usuario en auth.users
  nombre     text not null,
  correo     text not null unique,
  rol        text not null default 'miembro' check (rol in ('admin','miembro')),
  activo     boolean not null default true,  -- al quitar a alguien se desactiva (sus registros conservan el nombre)
  creado     timestamptz not null default now()
);

-- Quién registró y quién editó por última vez cada movimiento y cada producto de las listas
alter table movimientos add column if not exists creado_por  uuid references miembros(usuario_id) on delete set null;
alter table movimientos add column if not exists editado_por uuid references miembros(usuario_id) on delete set null;
alter table movimientos add column if not exists editado     timestamptz;
create index if not exists idx_movimientos_creado_por on movimientos(creado_por);
create index if not exists idx_movimientos_editado_por on movimientos(editado_por);

alter table items add column if not exists creado_por  uuid references miembros(usuario_id) on delete set null;
alter table items add column if not exists editado_por uuid references miembros(usuario_id) on delete set null;
create index if not exists idx_items_creado_por on items(creado_por);
create index if not exists idx_items_editado_por on items(editado_por);

-- Historial de cambios: "María registró un egreso de $45.000", "Jaime cambió Arriendo en Dic 2026"…
create table if not exists actividad (
  id         bigint generated always as identity primary key,
  fecha      timestamptz not null default now(),
  usuario_id uuid references miembros(usuario_id) on delete set null,
  nombre     text not null,                 -- nombre de quien lo hizo en ese momento
  tipo       text not null,                 -- movimiento, presupuesto, deuda, meta, lista, plan, ajustes, miembros
  accion     text not null,                 -- "registró un egreso de $45.000"
  detalle    text not null default '',      -- "Mercado · Alimentación y Hogar"
  clave      text                           -- agrupa cambios seguidos de lo mismo (p. ej. editar una celda varias veces)
);
create index if not exists idx_actividad_fecha on actividad(fecha desc);
create index if not exists idx_actividad_usuario on actividad(usuario_id);
create index if not exists idx_actividad_clave on actividad(usuario_id, clave, fecha desc);

alter table miembros  enable row level security;
alter table actividad enable row level security;
