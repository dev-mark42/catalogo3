-- ============================================================
-- Elite Sport · Esquema de base de datos para Supabase
-- Ejecuta TODO este archivo en: Supabase → SQL Editor → New query → Run
-- ============================================================

-- 1) Perfiles (1 fila por usuario de Supabase Auth) ---------------------------------
create table if not exists public.perfiles (
  id        uuid primary key references auth.users(id) on delete cascade,
  nombre    text,
  email     text,
  telefono  text,
  rol       text not null default 'cliente' check (rol in ('cliente','admin')),
  creado    timestamptz not null default now()
);

-- Crea el perfil automáticamente cuando alguien se registra
create or replace function public.nuevo_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfiles (id, nombre, email, telefono)
  values (new.id, coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email,'@',1)), new.email, new.raw_user_meta_data->>'telefono')
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists al_crear_usuario on auth.users;
create trigger al_crear_usuario after insert on auth.users for each row execute function public.nuevo_usuario();

-- ¿El usuario actual es admin? (security definer evita recursión en las políticas)
create or replace function public.es_admin() returns boolean
language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and rol = 'admin');
$$;

-- 2) Catálogo ----------------------------------------------------------------------
create table if not exists public.ligas (
  clave   text primary key,
  nombre  text not null,
  logo    text default '',
  orden   int  default 0
);
create table if not exists public.productos (
  id              bigint primary key,
  titulo          text not null,
  precio          numeric not null default 0,
  stock           int not null default 0,
  liga            text not null,
  temporada       text default '2025/26',
  tallas          text[] default '{S,M}',
  imagen          text default '',
  descripcion     text default '',
  fecha_creacion  text,
  creado          timestamptz not null default now()
);
create table if not exists public.carrusel (
  id      bigint generated always as identity primary key,
  orden   int not null default 0,
  img     text default '',
  badge   text default '',
  titulo  text not null,
  texto   text default ''
);
create table if not exists public.favoritos (
  usuario_id   uuid not null references auth.users(id) on delete cascade,
  producto_id  bigint not null,
  primary key (usuario_id, producto_id)
);

-- 3) Seguridad (Row Level Security) -------------------------------------------------
alter table public.perfiles  enable row level security;
alter table public.ligas     enable row level security;
alter table public.productos enable row level security;
alter table public.carrusel  enable row level security;
alter table public.favoritos enable row level security;

-- Catálogo: lo ve cualquiera (incluso invitados); solo el admin escribe
do $$ declare t text; begin
  foreach t in array array['ligas','productos','carrusel'] loop
    execute format('drop policy if exists "leer_%1$s" on public.%1$s', t);
    execute format('drop policy if exists "admin_%1$s" on public.%1$s', t);
    execute format('create policy "leer_%1$s" on public.%1$s for select using (true)', t);
    execute format('create policy "admin_%1$s" on public.%1$s for all using (public.es_admin()) with check (public.es_admin())', t);
  end loop;
end $$;

-- Perfiles: cada quien ve y edita el suyo (sin poder cambiarse el rol); el admin ve y edita todos
drop policy if exists "perfil_propio_ver" on public.perfiles;
drop policy if exists "perfil_propio_editar" on public.perfiles;
drop policy if exists "perfil_admin" on public.perfiles;
create policy "perfil_propio_ver" on public.perfiles for select using (auth.uid() = id);
create policy "perfil_propio_editar" on public.perfiles for update using (auth.uid() = id)
  with check (auth.uid() = id and rol = (select p.rol from public.perfiles p where p.id = auth.uid()));
create policy "perfil_admin" on public.perfiles for all using (public.es_admin()) with check (public.es_admin());

-- Favoritos: solo los propios
drop policy if exists "favoritos_propios" on public.favoritos;
create policy "favoritos_propios" on public.favoritos for all using (auth.uid() = usuario_id) with check (auth.uid() = usuario_id);

-- 4) Datos iniciales ----------------------------------------------------------------
insert into public.ligas (clave, nombre, logo, orden) values
 ('laliga','La Liga','assets/img/ligas/laliga.png',0),
 ('premier','Premier League','assets/img/ligas/premier.png',1),
 ('seriea','Serie A','assets/img/ligas/seriea.png',2),
 ('bundesliga','Bundesliga','assets/img/ligas/bundesliga.png',3),
 ('argentina','Liga Argentina','assets/img/ligas/argentina.png',4)
on conflict (clave) do nothing;

insert into public.productos (id,titulo,precio,stock,liga,temporada,tallas,imagen,descripcion) values
 (1,'Camiseta Real Madrid Local',380,12,'laliga','2025/26','{S,M,L,XL}','','Camiseta blanca titular con tecnología de secado rápido.'),
 (2,'Camiseta FC Barcelona Local',380,8,'laliga','2025/26','{M,L,XL}','','Los clásicos colores blaugrana, corte de jugador.'),
 (3,'Camiseta Manchester City',360,5,'premier','2025/26','{S,M,L}','','Celeste campeón, tela ligera y transpirable.'),
 (4,'Camiseta Liverpool Local',370,3,'premier','2024/25','{M,L}','','Rojo intenso con detalles dorados.'),
 (5,'Camiseta Juventus Local',350,10,'seriea','2025/26','{S,M,L,XL}','','Rayas clásicas blanquinegras.'),
 (6,'Camiseta Argentina Retro 86',420,0,'argentina','Retro','{M,L}','','Edición retro de colección, corte clásico.')
on conflict (id) do nothing;

insert into public.carrusel (orden,img,badge,titulo,texto) values
 (0,'https://images.unsplash.com/photo-1522778119026-d647f0596c20?q=80&w=1600&auto=format&fit=crop','NUEVA COLECCIÓN','Temporada 2026/27','Siente la pasión del fútbol con la mejor calidad.'),
 (1,'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?q=80&w=1600&auto=format&fit=crop','OFERTA','Hasta 30% Off','Solo por tiempo limitado en camisetas seleccionadas.'),
 (2,'','ENVÍOS','Llegamos a todo Bolivia','Compra por WhatsApp y recibe en tu puerta.');

-- 5) Permisos SQL de PostgreSQL para Supabase/PostgREST -----------------------------
-- RLS decide QUÉ filas puede ver/modificar cada usuario; GRANT permite acceder
-- a las tablas. Sin estos GRANT, Supabase devuelve:
-- "permission denied for table productos" incluso si las políticas RLS existen.

grant usage on schema public to anon, authenticated;

-- El catálogo es público: invitados y usuarios autenticados pueden leerlo.
grant select on table public.ligas, public.productos, public.carrusel
  to anon, authenticated;

-- Solo usuarios autenticados pueden intentar escribir. Las políticas RLS
-- anteriores restringen estas operaciones al administrador.
grant insert, update, delete on table public.ligas, public.productos, public.carrusel
  to authenticated;

-- Perfiles: las políticas RLS limitan cada usuario a su propio perfil
-- y permiten al administrador gestionar los demás.
grant select, insert, update, delete on table public.perfiles
  to authenticated;

-- Favoritos: únicamente usuarios autenticados, con RLS por usuario_id.
grant select, insert, update, delete on table public.favoritos
  to authenticated;

-- Necesario para insertar filas en tablas que utilicen secuencias/IDENTITY.
grant usage, select on all sequences in schema public to authenticated;

-- Recargar el esquema expuesto por la API REST de Supabase.
notify pgrst, 'reload schema';

-- 6) Crear el administrador ---------------------------------------------------------
-- a) Authentication → Users → Add user: admin@elitesport.com + una contraseña (marca "Auto confirm user")
-- b) Luego ejecuta:
--    update public.perfiles set rol = 'admin' where email = 'admin@elitesport.com';
