alter table public.profiles
	add column if not exists user_id uuid unique references auth.users (id) on delete set null,
	add column if not exists birth_date date;

create table if not exists public.person_relationships (
	id uuid primary key default gen_random_uuid(),
	person_a uuid not null references public.profiles (id) on delete cascade,
	person_b uuid not null references public.profiles (id) on delete cascade,
	relationship_type text not null check (
		relationship_type in ('parent', 'step_parent', 'guardian', 'spouse', 'sibling')
	),
	started_on date,
	ended_on date,
	created_by uuid references auth.users (id) on delete set null default auth.uid(),
	created_at timestamptz not null default now(),
	check (person_a <> person_b),
	check (ended_on is null or started_on is null or ended_on >= started_on),
	check (
		relationship_type not in ('spouse', 'sibling')
		or person_a < person_b
	)
);

create unique index if not exists person_relationships_unique_active_idx
	on public.person_relationships (person_a, person_b, relationship_type)
	where ended_on is null;
create index if not exists person_relationships_a_idx on public.person_relationships (person_a);
create index if not exists person_relationships_b_idx on public.person_relationships (person_b);

do $$
begin
	if exists (
		select 1 from information_schema.columns
		where table_schema = 'public' and table_name = 'profiles' and column_name = 'parent_id1'
	) then
		execute $sql$
			insert into public.person_relationships (person_a, person_b, relationship_type, created_by)
			select p.id, p.parent_id1, 'parent', null
			from public.profiles p
			where p.parent_id1 is not null and p.parent_id1 <> p.id
			on conflict do nothing
		$sql$;
	end if;

	if exists (
		select 1 from information_schema.columns
		where table_schema = 'public' and table_name = 'profiles' and column_name = 'parent_id2'
	) then
		execute $sql$
			insert into public.person_relationships (person_a, person_b, relationship_type, created_by)
			select p.id, p.parent_id2, 'parent', null
			from public.profiles p
			where p.parent_id2 is not null and p.parent_id2 <> p.id
			on conflict do nothing
		$sql$;
	end if;
end;
$$;

alter table public.profiles
	drop column if exists parent_id1,
	drop column if exists parent_id2;

create or replace function public.prevent_relationship_cycles()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
	if new.relationship_type not in ('parent', 'step_parent', 'guardian') or new.ended_on is not null then
		return new;
	end if;

	perform pg_advisory_xact_lock(170423);
	if exists (
		with recursive ancestors(person_id) as (
			select new.person_b
			union
			select r.person_b
			from public.person_relationships r
			join ancestors a on a.person_id = r.person_a
			where r.relationship_type in ('parent', 'step_parent', 'guardian')
				and r.ended_on is null
				and r.id <> new.id
		)
		select 1 from ancestors where person_id = new.person_a
	) then
		raise exception 'This relationship would create a family-tree cycle.';
	end if;

	return new;
end;
$$;

drop trigger if exists prevent_relationship_cycles on public.person_relationships;
create trigger prevent_relationship_cycles
before insert or update of person_a, person_b, relationship_type, ended_on
on public.person_relationships
for each row execute function public.prevent_relationship_cycles();

create table if not exists public.tree_positions (
	profile_id uuid primary key references public.profiles (id) on delete cascade,
	x double precision not null,
	y double precision not null,
	updated_by uuid not null references auth.users (id) default auth.uid(),
	updated_at timestamptz not null default now(),
	check (x between -100000 and 100000),
	check (y between -100000 and 100000)
);

create table if not exists public.profile_claim_requests (
	id uuid primary key default gen_random_uuid(),
	profile_id uuid not null references public.profiles (id) on delete cascade,
	claimant_id uuid not null references auth.users (id) on delete cascade,
	status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
	reviewed_by uuid references auth.users (id) on delete set null,
	reviewed_at timestamptz,
	created_at timestamptz not null default now()
);

create unique index if not exists profile_claim_one_pending_per_user_idx
	on public.profile_claim_requests (claimant_id)
	where status = 'pending';
create unique index if not exists profile_claim_one_pending_per_profile_idx
	on public.profile_claim_requests (profile_id)
	where status = 'pending';

create table if not exists public.collections (
	id uuid primary key default gen_random_uuid(),
	title text not null check (char_length(trim(title)) between 1 and 120),
	description text,
	cover_photo_id uuid references public.photos (id) on delete set null,
	created_by uuid not null references auth.users (id) default auth.uid(),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create table if not exists public.collection_photos (
	collection_id uuid not null references public.collections (id) on delete cascade,
	photo_id uuid not null references public.photos (id) on delete cascade,
	added_by uuid not null references auth.users (id) default auth.uid(),
	added_at timestamptz not null default now(),
	primary key (collection_id, photo_id)
);
create index if not exists collection_photos_photo_idx on public.collection_photos (photo_id);

create or replace function public.request_profile_claim(p_profile_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_user_id uuid := auth.uid();
	v_request_id uuid;
begin
	if v_user_id is null or not public.is_family_member() then
		raise exception 'An approved family account is required.';
	end if;

	if exists (select 1 from public.profiles where user_id = v_user_id) then
		raise exception 'Your account is already linked to a profile.';
	end if;

	if not exists (select 1 from public.profiles where id = p_profile_id and user_id is null) then
		raise exception 'This person profile is unavailable to claim.';
	end if;

	if exists (
		select 1 from public.profile_claim_requests
		where status = 'pending'
			and (claimant_id = v_user_id or profile_id = p_profile_id)
	) then
		raise exception 'A claim request is already pending for this account or person profile.';
	end if;

	insert into public.profile_claim_requests (profile_id, claimant_id)
	values (p_profile_id, v_user_id)
	returning id into v_request_id;

	return v_request_id;
end;
$$;

create or replace function public.review_profile_claim(p_request_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_admin_id uuid := auth.uid();
	v_request public.profile_claim_requests%rowtype;
begin
	if not exists (
		select 1 from public.family_members
		where user_id = v_admin_id and role = 'admin'
	) then
		raise exception 'Only a family admin can review claims.';
	end if;

	select * into v_request
	from public.profile_claim_requests
	where id = p_request_id and status = 'pending'
	for update;

	if not found then
		raise exception 'This claim request is no longer pending.';
	end if;

	if p_approve then
		if exists (select 1 from public.profiles where user_id = v_request.claimant_id) then
			raise exception 'This account is already linked to a person profile.';
		end if;

		update public.profiles set user_id = v_request.claimant_id
		where id = v_request.profile_id and user_id is null;
		if not found then
			raise exception 'This person profile has already been claimed.';
		end if;
	end if;

	update public.profile_claim_requests
	set status = case when p_approve then 'approved' else 'rejected' end,
		reviewed_by = v_admin_id,
		reviewed_at = now()
	where id = p_request_id;
end;
$$;

create or replace function public.set_profile_avatar(
	p_profile_id uuid,
	p_source_photo_id uuid,
	p_avatar_path text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
	if not public.is_family_member() then
		raise exception 'An approved family account is required.';
	end if;

	if p_avatar_path not like auth.uid()::text || '/%' or not exists (
		select 1
		from public.photos p
		join storage.objects o on o.bucket_id = 'family-photos' and o.name = p_avatar_path
		where p.id = p_source_photo_id
			and p.uploaded_by = auth.uid()
			and p.tagged_profiles @> array[p_profile_id]
	) then
		raise exception 'Choose a photo you uploaded that tags this person, then upload its cropped avatar.';
	end if;

	update public.profiles set avatar_file_path = p_avatar_path where id = p_profile_id;
	if not found then
		raise exception 'Person profile not found.';
	end if;
end;
$$;

create or replace function public.set_collection_cover(p_collection_id uuid, p_photo_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
	if not public.is_family_member() then
		raise exception 'An approved family account is required.';
	end if;
	if p_photo_id is not null and not exists (
		select 1 from public.collection_photos
		where collection_id = p_collection_id and photo_id = p_photo_id
	) then
		raise exception 'Add the photo to this collection before choosing it as the cover.';
	end if;
	update public.collections set cover_photo_id = p_photo_id, updated_at = now()
	where id = p_collection_id;
	if not found then
		raise exception 'Collection not found.';
	end if;
end;
$$;

revoke all on function public.request_profile_claim(uuid) from public, anon;
revoke all on function public.review_profile_claim(uuid, boolean) from public, anon;
revoke all on function public.set_profile_avatar(uuid, uuid, text) from public, anon;
revoke all on function public.set_collection_cover(uuid, uuid) from public, anon;
grant execute on function public.request_profile_claim(uuid) to authenticated;
grant execute on function public.review_profile_claim(uuid, boolean) to authenticated;
grant execute on function public.set_profile_avatar(uuid, uuid, text) to authenticated;
grant execute on function public.set_collection_cover(uuid, uuid) to authenticated;

alter table public.person_relationships enable row level security;
alter table public.tree_positions enable row level security;
alter table public.profile_claim_requests enable row level security;
alter table public.collections enable row level security;
alter table public.collection_photos enable row level security;

revoke all on public.person_relationships, public.tree_positions, public.profile_claim_requests,
	public.collections, public.collection_photos from anon, authenticated;
grant select, delete on public.person_relationships to authenticated;
grant insert (person_a, person_b, relationship_type, started_on, ended_on)
	on public.person_relationships to authenticated;
grant update (person_a, person_b, relationship_type, started_on, ended_on)
	on public.person_relationships to authenticated;
grant select, insert, update, delete on public.tree_positions to authenticated;
grant select, delete on public.collection_photos to authenticated;
grant insert (collection_id, photo_id) on public.collection_photos to authenticated;
grant select on public.profile_claim_requests to authenticated;
grant select, delete on public.collections to authenticated;
revoke insert, update on public.collections from authenticated;
grant insert (title, description) on public.collections to authenticated;
grant update (title, description) on public.collections to authenticated;
grant select, delete on public.profiles to authenticated;
revoke insert on public.profiles from authenticated;
grant insert (name, birth_year) on public.profiles to authenticated;
revoke update on public.profiles from authenticated;
grant update (name, birth_year, birth_date, user_id)
	on public.profiles to authenticated;

drop policy if exists "Family can update profiles" on public.profiles;
drop policy if exists "Owners and admins can update profiles" on public.profiles;
create policy "Owners and admins can update profiles"
on public.profiles for update to authenticated
using (
	(select public.is_family_member())
	and (
		user_id = (select auth.uid())
		or exists (
			select 1 from public.family_members
			where user_id = (select auth.uid()) and role = 'admin'
		)
	)
)
with check (
	(select public.is_family_member())
	and (
		user_id = (select auth.uid())
		or exists (
			select 1 from public.family_members
			where user_id = (select auth.uid()) and role = 'admin'
		)
	)
);

drop policy if exists "Family can delete profiles" on public.profiles;
drop policy if exists "Owners and admins can delete profiles" on public.profiles;
create policy "Owners and admins can delete profiles"
on public.profiles for delete to authenticated
using (
	(select public.is_family_member())
	and (
		user_id = (select auth.uid())
		or exists (
			select 1 from public.family_members
			where user_id = (select auth.uid()) and role = 'admin'
		)
	)
);

drop policy if exists "Family can read relationships" on public.person_relationships;
create policy "Family can read relationships"
on public.person_relationships for select to authenticated using ((select public.is_family_member()));
drop policy if exists "Family can create relationships" on public.person_relationships;
create policy "Family can create relationships"
on public.person_relationships for insert to authenticated
with check ((select public.is_family_member()) and created_by = (select auth.uid()));
drop policy if exists "Family can update relationships" on public.person_relationships;
create policy "Family can update relationships"
on public.person_relationships for update to authenticated using ((select public.is_family_member()))
with check ((select public.is_family_member()));
drop policy if exists "Family can delete relationships" on public.person_relationships;
create policy "Family can delete relationships"
on public.person_relationships for delete to authenticated using ((select public.is_family_member()));

drop policy if exists "Family can read tree positions" on public.tree_positions;
create policy "Family can read tree positions"
on public.tree_positions for select to authenticated using ((select public.is_family_member()));
drop policy if exists "Family can save tree positions" on public.tree_positions;
create policy "Family can save tree positions"
on public.tree_positions for insert to authenticated
with check ((select public.is_family_member()) and updated_by = (select auth.uid()));
drop policy if exists "Family can update tree positions" on public.tree_positions;
create policy "Family can update tree positions"
on public.tree_positions for update to authenticated
using ((select public.is_family_member()))
with check ((select public.is_family_member()) and updated_by = (select auth.uid()));
drop policy if exists "Family can remove tree positions" on public.tree_positions;
create policy "Family can remove tree positions"
on public.tree_positions for delete to authenticated using ((select public.is_family_member()));

drop policy if exists "Claimants and admins can read claim requests" on public.profile_claim_requests;
create policy "Claimants and admins can read claim requests"
on public.profile_claim_requests for select to authenticated
using (
	claimant_id = (select auth.uid())
	or exists (
		select 1 from public.family_members
		where user_id = (select auth.uid()) and role = 'admin'
	)
);

drop policy if exists "Family can read collections" on public.collections;
create policy "Family can read collections"
on public.collections for select to authenticated using ((select public.is_family_member()));
drop policy if exists "Family can create collections" on public.collections;
create policy "Family can create collections"
on public.collections for insert to authenticated
with check ((select public.is_family_member()) and created_by = (select auth.uid()));
drop policy if exists "Family can update collections" on public.collections;
create policy "Family can update collections"
on public.collections for update to authenticated
using ((select public.is_family_member())) with check ((select public.is_family_member()));
drop policy if exists "Family can delete collections" on public.collections;
create policy "Family can delete collections"
on public.collections for delete to authenticated using ((select public.is_family_member()));

drop policy if exists "Family can read collection photos" on public.collection_photos;
create policy "Family can read collection photos"
on public.collection_photos for select to authenticated using ((select public.is_family_member()));
drop policy if exists "Family can add collection photos" on public.collection_photos;
create policy "Family can add collection photos"
on public.collection_photos for insert to authenticated
with check ((select public.is_family_member()) and added_by = (select auth.uid()));
drop policy if exists "Family can remove collection photos" on public.collection_photos;
create policy "Family can remove collection photos"
on public.collection_photos for delete to authenticated using ((select public.is_family_member()));

drop policy if exists "Family can read album photos" on storage.objects;
create policy "Family can read album photos"
on storage.objects for select to authenticated
using (
	bucket_id = 'family-photos'
	and (select public.is_family_member())
	and (
		exists (select 1 from public.photos where file_path = name)
		or exists (select 1 from public.profiles where avatar_file_path = name)
	)
);
