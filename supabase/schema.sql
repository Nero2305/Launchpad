-- Run once in the Supabase SQL Editor. Uses only a publishable key + user JWT.
create table public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company text not null check (char_length(trim(company)) between 1 and 100),
  role text not null check (char_length(trim(role)) between 1 and 150),
  location text not null default '' check (char_length(location) <= 100),
  stage text not null default 'Saved' check (stage in ('Saved','Applied','Interview','Offer','Closed')),
  applied_on date,
  follow_up date,
  interview_on date,
  url text check (url is null or url ~ '^https?://'),
  notes text not null default '' check (char_length(notes) <= 5000),
  created_at timestamptz not null default now()
);
create index applications_owner_created on public.applications(user_id, created_at desc);
alter table public.applications enable row level security;
revoke all on public.applications from anon;
grant select, insert, update, delete on public.applications to authenticated;
create policy "Read own applications" on public.applications for select to authenticated using ((select auth.uid()) = user_id);
create policy "Insert own applications" on public.applications for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own applications" on public.applications for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Delete own applications" on public.applications for delete to authenticated using ((select auth.uid()) = user_id);
