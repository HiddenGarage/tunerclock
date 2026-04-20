create extension if not exists pgcrypto;

create table if not exists employees (
  id uuid primary key default gen_random_uuid(),
  discord_id text unique not null,
  discord_name text not null,
  avatar_url text,
  role text not null default 'employee',
  hourly_rate numeric(10,2) not null default 25,
  is_active boolean not null default false,
  active_days integer not null default 0,
  total_hours numeric(10,2) not null default 0,
  last_paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists shifts (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  punched_in_at timestamptz not null default now(),
  punched_out_at timestamptz,
  duration_hours numeric(10,2),
  shift_period text,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists expense_logs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'Divers',
  cost numeric(10,2) not null,
  note text,
  created_by_discord_id text,
  created_at timestamptz not null default now()
);

create table if not exists payouts (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  hours_paid numeric(10,2) not null,
  hourly_rate numeric(10,2) not null,
  amount_paid numeric(10,2) not null,
  paid_by_discord_id text,
  paid_at timestamptz not null default now()
);

create table if not exists weekly_profit_entries (
  id uuid primary key default gen_random_uuid(),
  label text,
  amount numeric(10,2) not null default 0,
  created_by_discord_id text,
  created_at timestamptz not null default now()
);

create table if not exists app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into app_settings(key, value)
values ('global_hourly_rate', '{"amount":25}')
on conflict (key) do nothing;
