create table if not exists public.bounties (
	id uuid primary key default gen_random_uuid(),
	title text not null check (char_length(trim(title)) between 1 and 160),
	description text not null check (char_length(trim(description)) between 1 and 4000),
	status text not null default 'open' check (status in ('open', 'resolved')),
	requested_by uuid not null references auth.users (id) on delete restrict,
	created_at timestamptz not null default now(),
	resolved_at timestamptz
);

create table if not exists public.bounty_submissions (
	id uuid primary key default gen_random_uuid(),
	bounty_id uuid not null references public.bounties (id) on delete cascade,
	photo_id uuid not null references public.photos (id) on delete cascade,
	submitted_by uuid not null references auth.users (id) on delete restrict,
	created_at timestamptz not null default now(),
	constraint bounty_submissions_unique_photo unique (bounty_id, photo_id)
);

create index if not exists bounties_status_created_idx on public.bounties (status, created_at desc);
create index if not exists bounties_requested_by_idx on public.bounties (requested_by);
create index if not exists bounty_submissions_bounty_idx on public.bounty_submissions (bounty_id, created_at desc);

alter table public.bounties enable row level security;
alter table public.bounty_submissions enable row level security;

revoke all on public.bounties, public.bounty_submissions from anon, authenticated;
grant select, insert on public.bounties to authenticated;
grant select, insert on public.bounty_submissions to authenticated;

drop policy if exists "Family can read bounties" on public.bounties;
create policy "Family can read bounties"
on public.bounties for select to authenticated
using ((select public.is_family_member()));

drop policy if exists "Family members can request bounties" on public.bounties;
create policy "Family members can request bounties"
on public.bounties for insert to authenticated
with check (
	(select public.is_family_member())
	and requested_by = (select auth.uid())
);

drop policy if exists "Family can read bounty submissions" on public.bounty_submissions;
create policy "Family can read bounty submissions"
on public.bounty_submissions for select to authenticated
using ((select public.is_family_member()));

drop policy if exists "Family members can submit bounty photos" on public.bounty_submissions;
create policy "Family members can submit bounty photos"
on public.bounty_submissions for insert to authenticated
with check (
	(select public.is_family_member())
	and submitted_by = (select auth.uid())
	and exists (
		select 1 from public.bounties
		where id = bounty_id and status = 'open'
	)
	and exists (
		select 1 from public.photos
		where id = photo_id
	)
);

create or replace function public.resolve_bounty_after_submission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
	update public.bounties
	set status = 'resolved', resolved_at = now()
	where id = new.bounty_id and status = 'open';
	return new;
end;
$$;

revoke all on function public.resolve_bounty_after_submission() from public, anon, authenticated;

drop trigger if exists resolve_bounty_after_submission on public.bounty_submissions;
create trigger resolve_bounty_after_submission
after insert on public.bounty_submissions
for each row execute function public.resolve_bounty_after_submission();
