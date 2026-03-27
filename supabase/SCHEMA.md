# Supabase Schema Setup

Paste the **Full Setup** block below into **Supabase Dashboard → SQL Editor → New query** and click **Run**.

The **Verify** block is separate — run it afterwards to confirm everything was created correctly.

---

## Full Setup (run all at once)

```sql
-- ============================================================
-- 1. PROFILES TABLE
-- ============================================================
create table public.profiles (
  id            uuid        default gen_random_uuid() primary key,
  user_id       uuid        references auth.users(id) on delete cascade not null unique,
  username      text        not null unique,
  username_hash text        not null,
  first_name    text        not null,
  last_name     text        not null,
  full_name     text        not null,
  email         text        not null,
  created_at    timestamptz default now() not null,
  updated_at    timestamptz default now() not null
);

-- ============================================================
-- 2. INDEXES
-- ============================================================

-- Fast uniqueness checks on username (used on every signup)
create index profiles_username_idx on public.profiles (username);

-- Fast profile lookups by auth user ID (used on every /api/auth/me call)
create index profiles_user_id_idx on public.profiles (user_id);

-- Fast lookups by email (useful for admin queries)
create index profiles_email_idx on public.profiles (email);

-- ============================================================
-- 3. ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS — no access until policies below are explicitly granted
alter table public.profiles enable row level security;

-- Users can read only their own profile
create policy "Users can view own profile"
  on public.profiles
  for select
  using (auth.uid() = user_id);

-- Users can update only their own profile
create policy "Users can update own profile"
  on public.profiles
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- No insert policy for anon/authenticated roles —
-- inserts are done exclusively via the service role key (bypasses RLS)
-- No delete policy — direct deletes are blocked for all non-service-role callers

-- ============================================================
-- 4. AUTO-UPDATE updated_at ON EVERY ROW CHANGE
-- ============================================================

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row
  execute function public.handle_updated_at();

-- ============================================================
-- 5. PREVENT user_id AND email FROM BEING CHANGED
-- ============================================================

create or replace function public.prevent_profile_id_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id <> old.user_id then
    raise exception 'user_id cannot be changed';
  end if;
  if new.email <> old.email then
    raise exception 'email cannot be changed directly';
  end if;
  return new;
end;
$$;

create trigger profiles_prevent_id_change
  before update on public.profiles
  for each row
  execute function public.prevent_profile_id_change();
```

---

## Verify Setup (run separately after)

```sql
-- Should show rowsecurity = true
select tablename, rowsecurity
from pg_tables
where schemaname = 'public' and tablename = 'profiles';

-- Should show 2 policies: view (SELECT) + update (UPDATE)
select policyname, cmd
from pg_policies
where tablename = 'profiles';

-- Should show 4 indexes: pkey + username + user_id + email
select indexname
from pg_indexes
where tablename = 'profiles';
```

Expected output:

| Check | Expected |
|---|---|
| `rowsecurity` | `true` |
| Policies | `Users can view own profile` (SELECT), `Users can update own profile` (UPDATE) |
| Indexes | `profiles_pkey`, `profiles_username_idx`, `profiles_user_id_idx`, `profiles_email_idx` |
