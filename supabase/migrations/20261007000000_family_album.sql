create table if not exists public.family_members (
	user_id uuid primary key references auth.users (id) on delete cascade,
	full_name text not null,
	role text not null default 'member' check (role in ('admin', 'member')),
	created_at timestamptz not null default now()
);

create table if not exists public.profiles (
	id uuid primary key default gen_random_uuid(),
	name text not null check (char_length(trim(name)) > 0),
	avatar_file_path text,
	birth_year integer check (birth_year between 1 and 3000),
	parent_id1 uuid references public.profiles (id) on delete set null,
	parent_id2 uuid references public.profiles (id) on delete set null,
	created_at timestamptz not null default now()
);

create table if not exists public.photos (
	id uuid primary key default gen_random_uuid(),
	title text,
	file_path text not null unique,
	year integer not null check (year between 1800 and 3000),
	uploaded_by uuid not null references auth.users (id) on delete restrict,
	tagged_profiles uuid[] not null default '{}',
	created_at timestamptz not null default now()
);

create table if not exists public.comments (
	id uuid primary key default gen_random_uuid(),
	photo_id uuid not null references public.photos (id) on delete cascade,
	author_id uuid not null references auth.users (id) on delete cascade,
	author_name text not null,
	content text not null check (char_length(trim(content)) between 1 and 2000),
	created_at timestamptz not null default now()
);

create index if not exists profiles_name_idx on public.profiles (name);
create index if not exists photos_year_idx on public.photos (year desc);
create index if not exists photos_tagged_profiles_idx on public.photos using gin (tagged_profiles);
create index if not exists photos_uploaded_by_idx on public.photos (uploaded_by);
create index if not exists comments_photo_created_idx on public.comments (photo_id, created_at);

create or replace function public.is_family_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
	select exists (
		select 1
		from public.family_members
		where user_id = (select auth.uid())
	);
$$;

create or replace function public.set_comment_author_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
	select full_name
	into new.author_name
	from public.family_members
	where user_id = (select auth.uid());

	if new.author_name is null then
		raise exception 'Only approved family members can add comments.';
	end if;

	return new;
end;
$$;

revoke all on function public.is_family_member() from public, anon;
grant execute on function public.is_family_member() to authenticated;
revoke all on function public.set_comment_author_name() from public, anon, authenticated;

drop trigger if exists set_comment_author_name_before_insert on public.comments;
create trigger set_comment_author_name_before_insert
before insert on public.comments
for each row execute function public.set_comment_author_name();

alter table public.family_members enable row level security;
alter table public.profiles enable row level security;
alter table public.photos enable row level security;
alter table public.comments enable row level security;

revoke all on public.family_members, public.profiles, public.photos, public.comments from anon, authenticated;
grant select on public.family_members to authenticated;
grant select, insert, update, delete on public.profiles, public.photos, public.comments to authenticated;
revoke update on public.comments from authenticated;
grant update (content) on public.comments to authenticated;

drop policy if exists "Family can read member list" on public.family_members;
create policy "Family can read member list"
on public.family_members for select to authenticated
using (public.is_family_member() or user_id = (select auth.uid()));

drop policy if exists "Family can read profiles" on public.profiles;
create policy "Family can read profiles"
on public.profiles for select to authenticated
using ((select public.is_family_member()));

drop policy if exists "Family can add profiles" on public.profiles;
create policy "Family can add profiles"
on public.profiles for insert to authenticated
with check ((select public.is_family_member()));

drop policy if exists "Family can update profiles" on public.profiles;
create policy "Family can update profiles"
on public.profiles for update to authenticated
using ((select public.is_family_member()))
with check ((select public.is_family_member()));

drop policy if exists "Family can delete profiles" on public.profiles;
create policy "Family can delete profiles"
on public.profiles for delete to authenticated
using ((select public.is_family_member()));

drop policy if exists "Family can read photos" on public.photos;
create policy "Family can read photos"
on public.photos for select to authenticated
using ((select public.is_family_member()));

drop policy if exists "Family can add photos as themselves" on public.photos;
create policy "Family can add photos as themselves"
on public.photos for insert to authenticated
with check (
	(select public.is_family_member())
	and uploaded_by = (select auth.uid())
);

drop policy if exists "Family can update photos" on public.photos;
create policy "Family can update photos"
on public.photos for update to authenticated
using ((select public.is_family_member()))
with check ((select public.is_family_member()));

drop policy if exists "Family can delete photos" on public.photos;
create policy "Family can delete photos"
on public.photos for delete to authenticated
using ((select public.is_family_member()));

drop policy if exists "Family can read comments" on public.comments;
create policy "Family can read comments"
on public.comments for select to authenticated
using ((select public.is_family_member()));

drop policy if exists "Family members can comment as themselves" on public.comments;
create policy "Family members can comment as themselves"
on public.comments for insert to authenticated
with check (
	(select public.is_family_member())
	and author_id = (select auth.uid())
);

drop policy if exists "Authors can update their comments" on public.comments;
create policy "Authors can update their comments"
on public.comments for update to authenticated
using (
	(select public.is_family_member())
	and author_id = (select auth.uid())
)
with check (
	(select public.is_family_member())
	and author_id = (select auth.uid())
);

drop policy if exists "Authors can delete their comments" on public.comments;
create policy "Authors can delete their comments"
on public.comments for delete to authenticated
using (
	(select public.is_family_member())
	and author_id = (select auth.uid())
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
	'family-photos',
	'family-photos',
	false,
	52428800,
	array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
)
on conflict (id) do update
set public = false,
	file_size_limit = excluded.file_size_limit,
	allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Family can read album photos" on storage.objects;
create policy "Family can read album photos"
on storage.objects for select to authenticated
using (
	bucket_id = 'family-photos'
	and (select public.is_family_member())
);

drop policy if exists "Family can upload album photos" on storage.objects;
create policy "Family can upload album photos"
on storage.objects for insert to authenticated
with check (
	bucket_id = 'family-photos'
	and (select public.is_family_member())
);

drop policy if exists "Family can update album photos" on storage.objects;
create policy "Family can update album photos"
on storage.objects for update to authenticated
using (
	bucket_id = 'family-photos'
	and (select public.is_family_member())
)
with check (
	bucket_id = 'family-photos'
	and (select public.is_family_member())
);

drop policy if exists "Family can delete album photos" on storage.objects;
create policy "Family can delete album photos"
on storage.objects for delete to authenticated
using (
	bucket_id = 'family-photos'
	and (select public.is_family_member())
);
