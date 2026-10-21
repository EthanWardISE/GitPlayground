create table if not exists public.families (
	id uuid primary key default gen_random_uuid(),
	name text not null check (char_length(trim(name)) between 1 and 120),
	created_by uuid not null references auth.users (id) on delete restrict,
	created_at timestamptz not null default now()
);

create table if not exists public.user_family_context (
	user_id uuid primary key references auth.users (id) on delete cascade,
	family_id uuid not null references public.families (id) on delete cascade,
	updated_at timestamptz not null default now()
);

create table if not exists public.family_invitations (
	id uuid primary key default gen_random_uuid(),
	family_id uuid not null references public.families (id) on delete cascade,
	email text not null check (position('@' in email) > 1),
	token text not null unique default encode(gen_random_bytes(24), 'hex'),
	invited_by uuid not null references auth.users (id) on delete restrict,
	expires_at timestamptz not null default (now() + interval '14 days'),
	accepted_at timestamptz,
	created_at timestamptz not null default now()
);

alter table public.family_members
	add column if not exists family_id uuid references public.families (id) on delete cascade;

alter table public.profiles add column if not exists family_id uuid;
alter table public.photos add column if not exists family_id uuid;
alter table public.comments add column if not exists family_id uuid;
alter table public.person_relationships add column if not exists family_id uuid;
alter table public.tree_positions add column if not exists family_id uuid;
alter table public.profile_claim_requests add column if not exists family_id uuid;
alter table public.collections add column if not exists family_id uuid;
alter table public.collection_photos add column if not exists family_id uuid;
alter table public.bounties add column if not exists family_id uuid;
alter table public.bounty_submissions add column if not exists family_id uuid;

do $$
declare
	legacy_family_id uuid;
begin
	select id into legacy_family_id
	from public.families
	order by created_at, id
	limit 1;

	if legacy_family_id is null then
		select user_id into legacy_family_id
		from public.family_members
		order by created_at, user_id
		limit 1;

		if legacy_family_id is not null then
			insert into public.families (id, name, created_by)
			select gen_random_uuid(), 'Kinfolk family', legacy_family_id
			returning id into legacy_family_id;
		end if;
	end if;

	if legacy_family_id is not null then
		update public.family_members
		set family_id = legacy_family_id
		where family_id is null;
	end if;
end;
$$;

do $$
declare
	legacy_family_id uuid;
begin
	select id into legacy_family_id
	from public.families
	order by created_at, id
	limit 1;

	if legacy_family_id is not null then
		update public.profiles set family_id = legacy_family_id where family_id is null;
		update public.photos set family_id = legacy_family_id where family_id is null;
		update public.comments set family_id = legacy_family_id where family_id is null;
		update public.person_relationships set family_id = legacy_family_id where family_id is null;
		update public.tree_positions set family_id = legacy_family_id where family_id is null;
		update public.profile_claim_requests set family_id = legacy_family_id where family_id is null;
		update public.collections set family_id = legacy_family_id where family_id is null;
		update public.collection_photos set family_id = legacy_family_id where family_id is null;
		update public.bounties set family_id = legacy_family_id where family_id is null;
		update public.bounty_submissions set family_id = legacy_family_id where family_id is null;

		insert into public.user_family_context (user_id, family_id)
		select user_id, legacy_family_id
		from public.family_members
		where family_id = legacy_family_id
		on conflict (user_id) do nothing;
	end if;
end;
$$;

create or replace function public.current_family_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
	select c.family_id
	from public.user_family_context c
	join public.family_members m
		on m.user_id = c.user_id
		and m.family_id = c.family_id
	where c.user_id = (select auth.uid())
	limit 1;
$$;

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
			and family_id = (select public.current_family_id())
	);
$$;

create or replace function public.is_family_member(p_family_id uuid)
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
			and family_id = p_family_id
	);
$$;

create or replace function public.create_family(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_user_id uuid := auth.uid();
	v_family_id uuid;
	v_name text := trim(p_name);
	v_full_name text;
begin
	if v_user_id is null then
		raise exception 'You must be signed in to create a family.';
	end if;
	if char_length(v_name) not between 1 and 120 then
		raise exception 'Family names must be between 1 and 120 characters.';
	end if;

	select coalesce(raw_user_meta_data ->> 'full_name', email, 'Family member')
	into v_full_name
	from auth.users
	where id = v_user_id;

	insert into public.families (name, created_by)
	values (v_name, v_user_id)
	returning id into v_family_id;

	insert into public.family_members (family_id, user_id, full_name, role)
	values (v_family_id, v_user_id, v_full_name, 'admin');

	insert into public.user_family_context (user_id, family_id)
	values (v_user_id, v_family_id)
	on conflict (user_id) do update set family_id = excluded.family_id, updated_at = now();

	return v_family_id;
end;
$$;

create or replace function public.switch_family(p_family_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
	if not public.is_family_member(p_family_id) then
		raise exception 'You are not a member of that family.';
	end if;

	insert into public.user_family_context (user_id, family_id)
	values (auth.uid(), p_family_id)
	on conflict (user_id) do update set family_id = excluded.family_id, updated_at = now();
end;
$$;

create or replace function public.create_family_invitation(p_family_id uuid, p_email text)
returns table (invitation_id uuid, invitation_token text)
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_user_id uuid := auth.uid();
	v_invitation public.family_invitations%rowtype;
	v_email text := lower(trim(p_email));
begin
	if not exists (
		select 1 from public.family_members
		where family_id = p_family_id and user_id = v_user_id and role = 'admin'
	) then
		raise exception 'Only family admins can invite members.';
	end if;
	if char_length(v_email) < 3 or position('@' in v_email) < 2 then
		raise exception 'Enter a valid email address.';
	end if;

	insert into public.family_invitations (family_id, email, invited_by)
	values (p_family_id, v_email, v_user_id)
	returning * into v_invitation;

	return query select v_invitation.id, v_invitation.token;
end;
$$;

create or replace function public.accept_family_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_user_id uuid := auth.uid();
	v_invitation public.family_invitations%rowtype;
	v_full_name text;
begin
	select * into v_invitation
	from public.family_invitations
	where token = trim(p_token)
		and accepted_at is null
		and expires_at > now()
	for update;
	if not found then
		raise exception 'This family invitation is invalid or has expired.';
	end if;
	if v_user_id is null then
		raise exception 'Sign in before accepting a family invitation.';
	end if;

	select coalesce(raw_user_meta_data ->> 'full_name', email, 'Family member')
	into v_full_name
	from auth.users
	where id = v_user_id;

	insert into public.family_members (family_id, user_id, full_name, role)
	values (v_invitation.family_id, v_user_id, v_full_name, 'member')
	on conflict (family_id, user_id) do nothing;

	update public.family_invitations set accepted_at = now() where id = v_invitation.id;
	perform public.switch_family(v_invitation.family_id);
	return v_invitation.family_id;
end;
$$;

revoke all on function public.create_family(text) from public, anon;
revoke all on function public.switch_family(uuid) from public, anon;
revoke all on function public.create_family_invitation(uuid, text) from public, anon;
revoke all on function public.accept_family_invitation(text) from public, anon;
grant execute on function public.create_family(text), public.switch_family(uuid), public.create_family_invitation(uuid, text), public.accept_family_invitation(text) to authenticated;

alter table public.profiles
	alter column family_id set default public.current_family_id(),
	alter column family_id set not null;
alter table public.photos
	alter column family_id set default public.current_family_id(),
	alter column family_id set not null;
alter table public.comments
	alter column family_id set default public.current_family_id(),
	alter column family_id set not null;
alter table public.person_relationships
	alter column family_id set default public.current_family_id(),
	alter column family_id set not null;
alter table public.tree_positions
	alter column family_id set default public.current_family_id(),
	alter column family_id set not null;
alter table public.profile_claim_requests
	alter column family_id set default public.current_family_id(),
	alter column family_id set not null;
alter table public.collections
	alter column family_id set default public.current_family_id(),
	alter column family_id set not null;
alter table public.collection_photos
	alter column family_id set default public.current_family_id(),
	alter column family_id set not null;
alter table public.bounties
	alter column family_id set default public.current_family_id(),
	alter column family_id set not null;
alter table public.bounty_submissions
	alter column family_id set default public.current_family_id(),
	alter column family_id set not null;

alter table public.family_members drop constraint if exists family_members_pkey;
do $$
begin
	if not exists (select 1 from public.family_members where family_id is null) then
		alter table public.family_members alter column family_id set not null;
		if not exists (
			select 1 from pg_constraint
			where conrelid = 'public.family_members'::regclass
				and contype = 'p'
		) then
			alter table public.family_members add primary key (family_id, user_id);
		end if;
	end if;
end;
$$;
alter table public.family_members alter column family_id set default public.current_family_id();
alter table public.profiles drop constraint if exists profiles_user_id_key;

create unique index if not exists profiles_one_claimed_profile_per_family_idx
	on public.profiles (family_id, user_id)
	where user_id is not null;
create index if not exists family_members_user_idx on public.family_members (user_id);
create index if not exists user_family_context_family_idx on public.user_family_context (family_id);

alter table public.profiles drop constraint if exists profiles_family_fk;
alter table public.profiles
	add constraint profiles_family_fk foreign key (family_id) references public.families (id) on delete cascade;
alter table public.photos drop constraint if exists photos_family_fk;
alter table public.photos
	add constraint photos_family_fk foreign key (family_id) references public.families (id) on delete cascade;
alter table public.comments drop constraint if exists comments_family_fk;
alter table public.comments
	add constraint comments_family_fk foreign key (family_id) references public.families (id) on delete cascade;
alter table public.person_relationships drop constraint if exists person_relationships_family_fk;
alter table public.person_relationships
	add constraint person_relationships_family_fk foreign key (family_id) references public.families (id) on delete cascade;
alter table public.tree_positions drop constraint if exists tree_positions_family_fk;
alter table public.tree_positions
	add constraint tree_positions_family_fk foreign key (family_id) references public.families (id) on delete cascade;
alter table public.profile_claim_requests drop constraint if exists profile_claim_requests_family_fk;
alter table public.profile_claim_requests
	add constraint profile_claim_requests_family_fk foreign key (family_id) references public.families (id) on delete cascade;
alter table public.collections drop constraint if exists collections_family_fk;
alter table public.collections
	add constraint collections_family_fk foreign key (family_id) references public.families (id) on delete cascade;
alter table public.collection_photos drop constraint if exists collection_photos_family_fk;
alter table public.collection_photos
	add constraint collection_photos_family_fk foreign key (family_id) references public.families (id) on delete cascade;
alter table public.bounties drop constraint if exists bounties_family_fk;
alter table public.bounties
	add constraint bounties_family_fk foreign key (family_id) references public.families (id) on delete cascade;
alter table public.bounty_submissions drop constraint if exists bounty_submissions_family_fk;
alter table public.bounty_submissions
	add constraint bounty_submissions_family_fk foreign key (family_id) references public.families (id) on delete cascade;

alter table public.families enable row level security;
alter table public.user_family_context enable row level security;
alter table public.family_invitations enable row level security;
revoke all on public.family_invitations from anon, authenticated;

do $$
declare
	table_name text;
	policy_name text;
begin
	foreach table_name in ARRAY ARRAY['families', 'family_members', 'user_family_context'] loop
		for policy_name in
			select policyname
			from pg_policies
			where schemaname = 'public' and tablename = table_name
		loop
			execute format('drop policy if exists %I on public.%I', policy_name, table_name);
		end loop;
	end loop;
end;
$$;

drop policy if exists "Members can read their families" on public.families;
create policy "Members can read their families"
on public.families for select to authenticated
using (exists (
	select 1
	where public.is_family_member(families.id)
));

drop policy if exists "Members can read family memberships" on public.family_members;
create policy "Members can read family memberships"
on public.family_members for select to authenticated
using ((select public.is_family_member(family_id)));

drop policy if exists "Users can read their family context" on public.user_family_context;
create policy "Users can read their family context"
on public.user_family_context for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Users can change their family context" on public.user_family_context;
create policy "Users can change their family context"
on public.user_family_context for update to authenticated
using (user_id = (select auth.uid()) and (select public.is_family_member(family_id)))
with check (user_id = (select auth.uid()) and (select public.is_family_member(family_id)));

drop policy if exists "Users can create their family context" on public.user_family_context;
create policy "Users can create their family context"
on public.user_family_context for insert to authenticated
with check (user_id = (select auth.uid()) and (select public.is_family_member(family_id)));

do $$
declare
	table_name text;
	policy_name text;
begin
	foreach table_name in ARRAY ARRAY[
		'profiles', 'photos', 'comments', 'person_relationships',
		'tree_positions', 'profile_claim_requests', 'collections',
		'collection_photos', 'bounties', 'bounty_submissions'
	] loop
		for policy_name in
			select policyname
			from pg_policies
			where schemaname = 'public' and tablename = table_name
		loop
			execute format('drop policy if exists %I on public.%I', policy_name, table_name);
		end loop;
	end loop;
end;
$$;

drop policy if exists "Authors can update their photos" on public.photos;
drop policy if exists "Authors can delete their photos" on public.photos;
drop policy if exists "Requesters and admins can delete bounties" on public.bounties;

create policy "Active family can read profiles" on public.profiles for select to authenticated
using (family_id = (select public.current_family_id()));
create policy "Active family can write profiles" on public.profiles for insert to authenticated
with check (family_id = (select public.current_family_id()) and (select public.is_family_member(family_id)));
create policy "Active family can update profiles" on public.profiles for update to authenticated
using (family_id = (select public.current_family_id()) and (select public.is_family_member(family_id)))
with check (family_id = (select public.current_family_id()) and (select public.is_family_member(family_id)));
create policy "Active family can delete profiles" on public.profiles for delete to authenticated
using (family_id = (select public.current_family_id()) and (select public.is_family_member(family_id)));

do $$
declare
	table_name text;
begin
	foreach table_name in array array['person_relationships', 'tree_positions', 'profile_claim_requests', 'collections', 'collection_photos'] loop
		execute format('create policy %I on public.%I for all to authenticated using (family_id = (select public.current_family_id()) and (select public.is_family_member(family_id))) with check (family_id = (select public.current_family_id()) and (select public.is_family_member(family_id)))', 'Active family access to ' || table_name, table_name);
	end loop;
end;
$$;

create policy "Active family can read photos" on public.photos for select to authenticated
using (family_id = (select public.current_family_id()) and (select public.is_family_member(family_id)));
create policy "Active family can add photos" on public.photos for insert to authenticated
with check (family_id = (select public.current_family_id()) and uploaded_by = (select auth.uid()) and (select public.is_family_member(family_id)));
create policy "Photo owners can update photos" on public.photos for update to authenticated
using (family_id = (select public.current_family_id()) and uploaded_by = (select auth.uid()))
with check (family_id = (select public.current_family_id()) and uploaded_by = (select auth.uid()));
create policy "Photo owners can delete photos" on public.photos for delete to authenticated
using (family_id = (select public.current_family_id()) and uploaded_by = (select auth.uid()));

create policy "Active family can read comments" on public.comments for select to authenticated
using (family_id = (select public.current_family_id()) and (select public.is_family_member(family_id)));
create policy "Active family can add comments" on public.comments for insert to authenticated
with check (family_id = (select public.current_family_id()) and author_id = (select auth.uid()) and (select public.is_family_member(family_id)));
create policy "Comment authors can update comments" on public.comments for update to authenticated
using (family_id = (select public.current_family_id()) and author_id = (select auth.uid()))
with check (family_id = (select public.current_family_id()) and author_id = (select auth.uid()));
create policy "Comment authors can delete comments" on public.comments for delete to authenticated
using (family_id = (select public.current_family_id()) and author_id = (select auth.uid()));

create policy "Active family can read bounties" on public.bounties for select to authenticated
using (family_id = (select public.current_family_id()) and (select public.is_family_member(family_id)));
create policy "Active family can add bounties" on public.bounties for insert to authenticated
with check (family_id = (select public.current_family_id()) and requested_by = (select auth.uid()) and (select public.is_family_member(family_id)));
create policy "Bounty owners and admins can delete bounties" on public.bounties for delete to authenticated
using (
	family_id = (select public.current_family_id())
	and (select public.is_family_member(family_id))
	and (
		requested_by = (select auth.uid())
		or exists (
			select 1 from public.family_members
			where family_id = bounties.family_id
				and user_id = (select auth.uid())
				and role = 'admin'
		)
	)
);

create policy "Active family can read bounty submissions" on public.bounty_submissions for select to authenticated
using (family_id = (select public.current_family_id()) and (select public.is_family_member(family_id)));
create policy "Active family can add bounty submissions" on public.bounty_submissions for insert to authenticated
with check (family_id = (select public.current_family_id()) and submitted_by = (select auth.uid()) and (select public.is_family_member(family_id)));

grant select on public.families, public.family_members, public.user_family_context to authenticated;
grant insert, update on public.user_family_context to authenticated;
grant execute on function public.current_family_id() to authenticated;
grant execute on function public.is_family_member(uuid) to authenticated;

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
declare
	v_user_id uuid := auth.uid();
begin
	if v_user_id is null or not public.is_family_member() then
		raise exception 'An approved family account is required.';
	end if;

	if p_avatar_path not like 'families/' || (select public.current_family_id())::text || '/profile-avatars/' || v_user_id::text || '/%.webp'
		or not exists (
			select 1
			from storage.objects
			where bucket_id = 'family-photos' and name = p_avatar_path
		)
	then
		raise exception 'Upload a valid profile picture before saving it.';
	end if;

	if p_source_photo_id is not null and not exists (
		select 1
		from public.photos
		where id = p_source_photo_id
			and family_id = (select public.current_family_id())
			and uploaded_by = v_user_id
			and tagged_profiles @> array[p_profile_id]
	) then
		raise exception 'Choose a photo you uploaded that tags this person.';
	end if;

	update public.profiles
	set avatar_file_path = p_avatar_path
	where id = p_profile_id
		and family_id = (select public.current_family_id());
	if not found then
		raise exception 'Person profile not found.';
	end if;
end;
$$;

revoke all on function public.set_profile_avatar(uuid, uuid, text) from public, anon;
grant execute on function public.set_profile_avatar(uuid, uuid, text) to authenticated;

drop policy if exists "Family can read album photos" on storage.objects;
drop policy if exists "Family can upload album photos" on storage.objects;
drop policy if exists "Family can update album photos" on storage.objects;
drop policy if exists "Family can delete album photos" on storage.objects;
drop policy if exists "Authors can delete their album photos" on storage.objects;
drop policy if exists "Family can read profile avatars" on storage.objects;
drop policy if exists "Active family can read storage" on storage.objects;
drop policy if exists "Active family can upload storage" on storage.objects;
drop policy if exists "Active family can update storage" on storage.objects;
drop policy if exists "Active family can delete storage" on storage.objects;

create policy "Active family can read storage" on storage.objects for select to authenticated
using (
	bucket_id = 'family-photos'
	and (select public.is_family_member())
	and (
		name like 'families/' || (select public.current_family_id())::text || '/%'
		or (
			(select public.current_family_id()) = (select id from public.families order by created_at, id limit 1)
			and (
				exists (
					select 1 from public.photos where file_path = name and family_id = (select public.current_family_id())
				)
				or exists (
					select 1
					from public.profiles
					where avatar_file_path = storage.objects.name
						and family_id = (select public.current_family_id())
				)
			)
		)
		or exists (
			select 1 from public.profiles
			where avatar_file_path = storage.objects.name and family_id = (select public.current_family_id())
		)
	)
);

create policy "Active family can upload storage" on storage.objects for insert to authenticated
with check (
	bucket_id = 'family-photos'
	and (select public.is_family_member())
	and (
		name like 'families/' || (select public.current_family_id())::text || '/%'
		or name like (select auth.uid())::text || '/profile-avatars/%'
		or (select public.current_family_id()) = (select id from public.families order by created_at, id limit 1)
	)
);

create policy "Active family can update storage" on storage.objects for update to authenticated
using (
	bucket_id = 'family-photos'
	and (select public.is_family_member())
	and (
		name like 'families/' || (select public.current_family_id())::text || '/%'
		or name like (select auth.uid())::text || '/profile-avatars/%'
	)
)
with check (
	bucket_id = 'family-photos'
	and (select public.is_family_member())
	and (
		name like 'families/' || (select public.current_family_id())::text || '/%'
		or name like (select auth.uid())::text || '/profile-avatars/%'
	)
);

create policy "Active family can delete storage" on storage.objects for delete to authenticated
using (
	bucket_id = 'family-photos'
	and (select public.is_family_member())
	and (
		name like 'families/' || (select public.current_family_id())::text || '/%'
		or (
			(select public.current_family_id()) = (select id from public.families order by created_at, id limit 1)
			and (
				name like (select auth.uid())::text || '/%'
				or exists (
					select 1 from public.photos
					where file_path = name and family_id = (select public.current_family_id()) and uploaded_by = (select auth.uid())
				)
			)
		)
	)
);
