
-- Enable necessary extensions
create extension if not exists "uuid-ossp";

-- ROLES & USERS
-- Create a table for public profiles aligned with auth.users
create table public.profiles (
  id uuid references auth.users not null primary key,
  full_name text,
  document_id text,
  role text default 'afiliado' check (role in ('admin', 'afiliado', 'cajero')),
  sponsor_id uuid references public.profiles(id),
  branch_root_id uuid references public.profiles(id), -- La raíz de la rama
  status text default 'activo' check (status in ('activo', 'inactivo')),
  activation_date timestamp with time zone default now(),
  current_combo_id uuid, -- Foreign key se añade después
  current_rank text default 'básico',
  created_at timestamp with time zone default now()
);

-- SUCURSALES (Branches)
create table public.sucursales (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  address text,
  manager_id uuid references public.profiles(id),
  status text default 'activo' check (status in ('activo', 'inactivo')),
  created_at timestamp with time zone default now()
);

-- PRODUCTS
create table public.products (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  description text,
  price numeric(10, 2) not null default 0,
  pv_points numeric(10, 2) not null default 0, -- Puntos Volumen
  image_url text,
  status text default 'activo' check (status in ('activo', 'inactivo')),
  created_at timestamp with time zone default now()
);

-- INVENTORY (Stock per branch)
create table public.inventory (
  id uuid default uuid_generate_v4() primary key,
  branch_id uuid references public.sucursales(id) not null,
  product_id uuid references public.products(id) not null,
  stock integer not null default 0,
  updated_at timestamp with time zone default now(),
  unique(branch_id, product_id)
);

-- COMBOS (Activation Packs)
create table public.combos (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  price numeric(10, 2) not null,
  pv_awarded numeric(10, 2) default 0,
  plan_id uuid, -- Foreign key a Plan de Ganancias
  status text default 'activo' check (status in ('activo', 'inactivo')),
  created_at timestamp with time zone default now()
);

-- Now we can add the FK to profiles
alter table public.profiles 
add constraint fk_current_combo foreign key (current_combo_id) references public.combos(id);

-- GAIN PLANS (Commission Configuration)
create table public.gain_plans (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  levels integer default 1,
  config jsonb default '{}', -- Ejemplo: {"1": 10, "2": 3, "3": 2} (Nivel: Porcentaje)
  created_at timestamp with time zone default now()
);

-- Link combo to plan
alter table public.combos
add constraint fk_combo_plan foreign key (plan_id) references public.gain_plans(id);


-- SALES
create table public.sales (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id), -- Comprador
  branch_id uuid references public.sucursales(id),
  total_amount numeric(10, 2) not null,
  total_pv numeric(10, 2) default 0,
  status text default 'completado',
  created_at timestamp with time zone default now()
);

-- SALE ITEMS
create table public.sale_items (
  id uuid default uuid_generate_v4() primary key,
  sale_id uuid references public.sales(id) not null,
  product_id uuid references public.products(id),
  quantity integer not null,
  price_at_sale numeric(10, 2) not null,
  pv_at_sale numeric(10, 2) not null,
  created_at timestamp with time zone default now()
);

-- COMMISSIONS LEDGER (Earnings)
create table public.commissions (
  id uuid default uuid_generate_v4() primary key,
  beneficiary_id uuid references public.profiles(id) not null, -- Quién cobra
  source_sale_id uuid references public.sales(id), -- Origen venta
  source_user_id uuid references public.profiles(id), -- Quién compró
  amount numeric(10, 2) not null,
  commission_type text, -- 'bono_nivel', 'patrocinio_directo', 'bono_rango'
  level_depth integer, -- 1 para directo, 2 para segundo nivel, etc.
  created_at timestamp with time zone default now()
);

-- RLS POLICIES (Basic Setup)
alter table public.profiles enable row level security;
alter table public.sucursales enable row level security;
alter table public.products enable row level security;
alter table public.inventory enable row level security;
alter table public.sales enable row level security;

-- Allow users to read their own profile
create policy "Usuarios ven su propio perfil" on public.profiles
for select using (auth.uid() = id);

-- Allow admins (logic to be defined, for now open read for development)
create policy "Lectura pública temporal" on public.profiles
for select using (true);

-- Functions to handle new user signup
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role, status)
  values (
    new.id, 
    new.raw_user_meta_data->>'full_name', 
    coalesce(new.raw_user_meta_data->>'role', 'afiliado'),
    'activo'
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger for new user
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
