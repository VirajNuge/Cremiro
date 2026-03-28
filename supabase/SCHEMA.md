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

## Phase 2: Credit System, Requests & Job Items (run all at once)

```sql
-- ============================================================
-- 1. ADD credits_balance TO PROFILES
-- ============================================================

alter table public.profiles
  add column credits_balance bigint not null default 1000
  constraint credits_balance_non_negative check (credits_balance >= 0);

-- ============================================================
-- 2. ENUMS
-- ============================================================

create type public.job_type as enum (
  'viral_clip',
  'social_text',
  'blog_post',
  'ai_image'
);

create type public.job_status as enum (
  'pending',
  'processing',
  'completed',
  'failed'
);

create type public.request_status as enum (
  'pending',
  'processing',
  'completed',
  'partially_completed',
  'failed'
);

-- ============================================================
-- 3. REQUESTS TABLE (parent — one per user submission)
-- ============================================================

create table public.requests (
  id              uuid        default gen_random_uuid() primary key,
  user_id         uuid        references auth.users(id) on delete cascade not null,
  youtube_url     text        not null,
  status          public.request_status not null default 'pending',
  total_credits   integer     not null default 0,
  input_data      jsonb       not null default '{}'::jsonb,
  idempotency_key text        unique,
  created_at      timestamptz default now() not null,
  updated_at      timestamptz default now() not null
);

-- Indexes
create index requests_user_id_idx on public.requests (user_id);
create index requests_status_idx on public.requests (status);
create index requests_created_at_idx on public.requests (created_at desc);

-- RLS
alter table public.requests enable row level security;

create policy "Users can view own requests"
  on public.requests
  for select
  using (auth.uid() = user_id);

-- No insert/update/delete for authenticated users — all writes via service role or RPC

-- Auto-update updated_at
create trigger requests_updated_at
  before update on public.requests
  for each row
  execute function public.handle_updated_at();

-- ============================================================
-- 4. JOB_ITEMS TABLE (children — one per artifact)
-- ============================================================

create table public.job_items (
  id              uuid        default gen_random_uuid() primary key,
  request_id      uuid        references public.requests(id) on delete cascade not null,
  user_id         uuid        references auth.users(id) on delete cascade not null,
  job_type        public.job_type not null,
  status          public.job_status not null default 'pending',
  credits_cost    integer     not null default 0,
  platform        text,
  style           text,
  input_data      jsonb       not null default '{}'::jsonb,
  output_data     jsonb,
  output_refs     text[],
  error_message   text,
  started_at      timestamptz,
  completed_at    timestamptz,
  refunded_at     timestamptz,
  refund_txn_id   uuid,
  created_at      timestamptz default now() not null,
  updated_at      timestamptz default now() not null
);

-- Indexes
create index job_items_request_id_idx on public.job_items (request_id);
create index job_items_user_id_idx on public.job_items (user_id);
create index job_items_status_idx on public.job_items (status);

-- RLS
alter table public.job_items enable row level security;

create policy "Users can view own job items"
  on public.job_items
  for select
  using (auth.uid() = user_id);

-- No insert/update/delete for authenticated users — all writes via service role or RPC

-- Auto-update updated_at
create trigger job_items_updated_at
  before update on public.job_items
  for each row
  execute function public.handle_updated_at();

-- ============================================================
-- 5. CREDIT_TRANSACTIONS TABLE (audit ledger)
-- ============================================================

create table public.credit_transactions (
  id              uuid        default gen_random_uuid() primary key,
  user_id         uuid        references auth.users(id) on delete cascade not null,
  delta           integer     not null,
  reason          text        not null,
  balance_after   bigint      not null,
  request_id      uuid        references public.requests(id) on delete set null,
  job_item_id     uuid        references public.job_items(id) on delete set null,
  created_at      timestamptz default now() not null
);

-- Indexes
create index credit_txn_user_id_idx on public.credit_transactions (user_id);
create index credit_txn_request_id_idx on public.credit_transactions (request_id);
create index credit_txn_created_at_idx on public.credit_transactions (created_at desc);

-- RLS
alter table public.credit_transactions enable row level security;

create policy "Users can view own credit transactions"
  on public.credit_transactions
  for select
  using (auth.uid() = user_id);

-- No insert/update/delete for authenticated users — all writes via service role or RPC

-- ============================================================
-- 6. RPC FUNCTIONS (security definer — atomic credit operations)
-- ============================================================

-- 6a. Create request, job items, and deduct credits atomically
create or replace function public.create_request_and_deduct(
  p_user_id       uuid,
  p_youtube_url   text,
  p_total_credits integer,
  p_input_data    jsonb,
  p_job_items     jsonb,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_balance bigint;
  v_new_balance     bigint;
  v_request_id      uuid;
  v_item            jsonb;
  v_job_item_id     uuid;
  v_job_item_ids    uuid[] := '{}';
begin
  -- Idempotency check: if this key already exists, return the existing request
  if p_idempotency_key is not null then
    select id into v_request_id
    from public.requests
    where idempotency_key = p_idempotency_key;

    if v_request_id is not null then
      return jsonb_build_object(
        'request_id', v_request_id,
        'already_exists', true
      );
    end if;
  end if;

  -- Lock the profile row and check balance
  select credits_balance into v_current_balance
  from public.profiles
  where user_id = p_user_id
  for update;

  if not found then
    raise exception 'Profile not found for user %', p_user_id;
  end if;

  if v_current_balance < p_total_credits then
    raise exception 'Insufficient credits. Required: %, available: %', p_total_credits, v_current_balance;
  end if;

  -- Deduct credits
  v_new_balance := v_current_balance - p_total_credits;
  update public.profiles
  set credits_balance = v_new_balance
  where user_id = p_user_id;

  -- Create the request
  insert into public.requests (user_id, youtube_url, total_credits, input_data, idempotency_key)
  values (p_user_id, p_youtube_url, p_total_credits, p_input_data, p_idempotency_key)
  returning id into v_request_id;

  -- Create job items
  for v_item in select * from jsonb_array_elements(p_job_items)
  loop
    insert into public.job_items (
      request_id, user_id, job_type, credits_cost,
      platform, style, input_data
    )
    values (
      v_request_id,
      p_user_id,
      (v_item->>'job_type')::public.job_type,
      (v_item->>'credits_cost')::integer,
      v_item->>'platform',
      v_item->>'style',
      coalesce(v_item->'input_data', '{}'::jsonb)
    )
    returning id into v_job_item_id;

    v_job_item_ids := array_append(v_job_item_ids, v_job_item_id);
  end loop;

  -- Record credit transaction
  insert into public.credit_transactions (user_id, delta, reason, balance_after, request_id)
  values (p_user_id, -p_total_credits, 'content_generation', v_new_balance, v_request_id);

  return jsonb_build_object(
    'request_id', v_request_id,
    'job_item_ids', to_jsonb(v_job_item_ids),
    'credits_deducted', p_total_credits,
    'balance_after', v_new_balance,
    'already_exists', false
  );
end;
$$;

-- 6b. Update job item status (called from webhook)
create or replace function public.update_job_item_status(
  p_job_item_id   uuid,
  p_status        public.job_status,
  p_output_data   jsonb default null,
  p_output_refs   text[] default null,
  p_error_message text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_status  public.job_status;
  v_request_id      uuid;
  v_user_id         uuid;
  v_credits_cost    integer;
  v_total_items     integer;
  v_completed_items integer;
  v_failed_items    integer;
  v_new_request_status public.request_status;
begin
  -- Lock the job item and get current state
  select status, request_id, user_id, credits_cost
  into v_current_status, v_request_id, v_user_id, v_credits_cost
  from public.job_items
  where id = p_job_item_id
  for update;

  if not found then
    raise exception 'Job item % not found', p_job_item_id;
  end if;

  -- Enforce valid status transitions
  -- pending -> processing, completed, failed
  -- processing -> completed, failed
  -- completed -> (terminal)
  -- failed -> (terminal)
  if v_current_status in ('completed', 'failed') then
    raise exception 'Job item % is already in terminal state: %', p_job_item_id, v_current_status;
  end if;

  if v_current_status = 'pending' and p_status not in ('processing', 'completed', 'failed') then
    raise exception 'Invalid transition from pending to %', p_status;
  end if;

  if v_current_status = 'processing' and p_status not in ('completed', 'failed') then
    raise exception 'Invalid transition from processing to %', p_status;
  end if;

  -- Update the job item
  update public.job_items
  set
    status = p_status,
    output_data = coalesce(p_output_data, output_data),
    output_refs = coalesce(p_output_refs, job_items.output_refs),
    error_message = coalesce(p_error_message, error_message),
    started_at = case
      when p_status = 'processing' and started_at is null then now()
      else started_at
    end,
    completed_at = case
      when p_status in ('completed', 'failed') then now()
      else completed_at
    end
  where id = p_job_item_id;

  -- Auto-refund on failure (idempotent — check refunded_at)
  if p_status = 'failed' and v_credits_cost > 0 then
    perform public.refund_job_item(p_job_item_id);
  end if;

  -- Update parent request status based on children
  select count(*), 
         count(*) filter (where status = 'completed'),
         count(*) filter (where status = 'failed')
  into v_total_items, v_completed_items, v_failed_items
  from public.job_items
  where request_id = v_request_id;

  if v_completed_items + v_failed_items = v_total_items then
    -- All items are done
    if v_failed_items = v_total_items then
      v_new_request_status := 'failed';
    elsif v_completed_items = v_total_items then
      v_new_request_status := 'completed';
    else
      v_new_request_status := 'partially_completed';
    end if;
  elsif v_completed_items > 0 or exists (
    select 1 from public.job_items where request_id = v_request_id and status = 'processing'
  ) then
    v_new_request_status := 'processing';
  else
    v_new_request_status := 'pending';
  end if;

  update public.requests
  set status = v_new_request_status
  where id = v_request_id;

  return jsonb_build_object(
    'job_item_id', p_job_item_id,
    'status', p_status,
    'request_status', v_new_request_status
  );
end;
$$;

-- 6c. Refund a failed job item (idempotent)
create or replace function public.refund_job_item(
  p_job_item_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id       uuid;
  v_credits_cost  integer;
  v_refunded_at   timestamptz;
  v_new_balance   bigint;
  v_txn_id        uuid;
begin
  -- Get job item details with lock
  select user_id, credits_cost, refunded_at
  into v_user_id, v_credits_cost, v_refunded_at
  from public.job_items
  where id = p_job_item_id
  for update;

  if not found then
    raise exception 'Job item % not found', p_job_item_id;
  end if;

  -- Idempotent: already refunded
  if v_refunded_at is not null then
    return jsonb_build_object('already_refunded', true, 'job_item_id', p_job_item_id);
  end if;

  -- Nothing to refund
  if v_credits_cost <= 0 then
    return jsonb_build_object('nothing_to_refund', true, 'job_item_id', p_job_item_id);
  end if;

  -- Refund credits
  update public.profiles
  set credits_balance = credits_balance + v_credits_cost
  where user_id = v_user_id
  returning credits_balance into v_new_balance;

  -- Record refund transaction
  insert into public.credit_transactions (user_id, delta, reason, balance_after, job_item_id)
  values (v_user_id, v_credits_cost, 'refund_failed_job', v_new_balance, p_job_item_id)
  returning id into v_txn_id;

  -- Mark job item as refunded
  update public.job_items
  set refunded_at = now(), refund_txn_id = v_txn_id
  where id = p_job_item_id;

  return jsonb_build_object(
    'refunded', true,
    'job_item_id', p_job_item_id,
    'credits_refunded', v_credits_cost,
    'balance_after', v_new_balance,
    'txn_id', v_txn_id
  );
end;
$$;

-- ============================================================
-- 7. ENABLE REALTIME ON JOB TABLES
-- ============================================================

-- Enable Realtime for job_items so frontend can subscribe to status changes
alter publication supabase_realtime add table public.job_items;
alter publication supabase_realtime add table public.requests;

-- Set REPLICA IDENTITY FULL so Realtime sends complete row data (not just changed columns)
alter table public.job_items replica identity full;
alter table public.requests replica identity full;
```

---

## Phase 2 Verify (run separately after Phase 2)

```sql
-- Check credits_balance column exists on profiles
select column_name, data_type, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'profiles' and column_name = 'credits_balance';

-- Check new tables exist with RLS enabled
select tablename, rowsecurity
from pg_tables
where schemaname = 'public' and tablename in ('requests', 'job_items', 'credit_transactions');

-- Check RLS policies
select tablename, policyname, cmd
from pg_policies
where tablename in ('requests', 'job_items', 'credit_transactions');

-- Check enums
select typname, enumlabel
from pg_enum
join pg_type on pg_enum.enumtypid = pg_type.oid
where typname in ('job_type', 'job_status', 'request_status')
order by typname, enumsortorder;

-- Check indexes
select tablename, indexname
from pg_indexes
where tablename in ('requests', 'job_items', 'credit_transactions')
order by tablename, indexname;

-- Check RPC functions exist
select routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in ('create_request_and_deduct', 'update_job_item_status', 'refund_job_item');

-- Check Realtime publication
select * from pg_publication_tables where pubname = 'supabase_realtime';
```

Expected output (Phase 2):

| Check | Expected |
|---|---|
| `credits_balance` | `bigint`, default `1000` |
| Tables with RLS | `requests` (true), `job_items` (true), `credit_transactions` (true) |
| Policies | 3 SELECT policies (one per table, own rows only) |
| Enums | `job_type` (4 values), `job_status` (4 values), `request_status` (5 values) |
| RPC Functions | `create_request_and_deduct`, `update_job_item_status`, `refund_job_item` |
| Realtime | `job_items` and `requests` in `supabase_realtime` publication |

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
