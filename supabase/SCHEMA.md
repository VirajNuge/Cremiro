# Supabase Schema Setup

Run these SQL blocks in order in **Supabase Dashboard → SQL Editor → New query**.

---

## 1. Profiles Table

```sql
create table public.profiles (
  id           uuid        default gen_random_uuid() primary key,
  user_id      uuid        references auth.users(id) on delete cascade not null unique,
  username     text        not null unique,
  username_hash text       not null,
  first_name   text        not null,
  last_name    text        not null,
  full_name    text        not null,
  email        text        not null,
  created_at   timestamptz default now() not null,
  updated_at   timestamptz default now() not null
);
```

---

## 2. Indexes

```sql
-- Fast uniqueness checks on username (used on every signup)
create index profiles_username_idx on public.profiles (username);

-- Fast profile lookups by auth user ID (used on every /api/auth/me call)
create index profiles_user_id_idx on public.profiles (user_id);

-- Fast lookups by email (useful for admin queries)
create index profiles_email_idx on public.profiles (email);
```

---

## 3. Row Level Security

```sql
-- Enable RLS — no access is granted until policies below are added
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

-- Users can never delete their own profile directly (admin only via service role)
-- No delete policy = delete is blocked for all non-service-role callers

-- The signup API route uses the service role key which bypasses RLS.
-- No insert policy needed for anon/authenticated roles.
```

---

## 4. Auto-update `updated_at`

```sql
-- Function to stamp updated_at on every row update
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

-- Trigger: fire before every UPDATE on profiles
create trigger profiles_updated_at
  before update on public.profiles
  for each row
  execute function public.handle_updated_at();
```

---

## 5. Protect `user_id` and `email` from being changed

```sql
-- Prevent users from reassigning their profile to a different auth user
-- or changing the stored email via a direct UPDATE
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

## 6. Verify Setup

Run this to confirm everything was created correctly:

```sql
-- Should return 1 row for the profiles table with RLS enabled
select
  tablename,
  rowsecurity
from pg_tables
where schemaname = 'public' and tablename = 'profiles';

-- Should return 2 policies (view + update)
select policyname, cmd
from pg_policies
where tablename = 'profiles';

-- Should return 3 indexes
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
