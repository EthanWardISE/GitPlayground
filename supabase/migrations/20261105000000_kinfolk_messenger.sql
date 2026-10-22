create table if not exists public.chats (
	id uuid primary key default gen_random_uuid(),
	family_id uuid not null references public.families (id) on delete cascade,
	type text not null check (type in ('direct', 'group')),
	name text,
	created_by uuid not null references auth.users (id) on delete restrict,
	created_at timestamptz not null default now(),
	check ((type = 'group' and char_length(trim(coalesce(name, ''))) between 1 and 120)
		or (type = 'direct' and name is null))
);

create table if not exists public.chat_participants (
	chat_id uuid not null references public.chats (id) on delete cascade,
	user_id uuid not null references auth.users (id) on delete cascade,
	role text not null default 'member' check (role in ('admin', 'member')),
	joined_at timestamptz not null default now(),
	primary key (chat_id, user_id)
);

create table if not exists public.messages (
	id uuid primary key default gen_random_uuid(),
	chat_id uuid not null references public.chats (id) on delete cascade,
	sender_id uuid not null references auth.users (id) on delete restrict,
	content text not null check (char_length(trim(content)) between 1 and 10000),
	attached_photo_id uuid references public.photos (id) on delete set null,
	is_deleted boolean not null default false,
	created_at timestamptz not null default now()
);

create table if not exists public.message_reads (
	message_id uuid not null references public.messages (id) on delete cascade,
	user_id uuid not null references auth.users (id) on delete cascade,
	read_at timestamptz not null default now(),
	primary key (message_id, user_id)
);

create table if not exists public.reports (
	id uuid primary key default gen_random_uuid(),
	message_id uuid not null references public.messages (id) on delete cascade,
	reported_by uuid not null references auth.users (id) on delete restrict,
	family_id uuid not null references public.families (id) on delete cascade,
	status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed')),
	created_at timestamptz not null default now(),
	unique (message_id, reported_by)
);

create index if not exists chats_family_created_idx on public.chats (family_id, created_at desc);
create index if not exists chat_participants_user_idx on public.chat_participants (user_id, chat_id);
create index if not exists messages_chat_created_idx on public.messages (chat_id, created_at);
create index if not exists message_reads_message_idx on public.message_reads (message_id);
create index if not exists reports_family_status_idx on public.reports (family_id, status, created_at desc);

create or replace function public.is_family_admin(p_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
	select exists (
		select 1
		from public.family_members
		where family_id = p_family_id
			and user_id = (select auth.uid())
			and role = 'admin'
	);
$$;

create or replace function public.is_chat_participant(p_chat_id uuid, p_user_id uuid default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
	select exists (
		select 1
		from public.chat_participants cp
		join public.chats c on c.id = cp.chat_id
		join public.user_family_context ufc
			on ufc.family_id = c.family_id
			and ufc.user_id = (select auth.uid())
		where cp.chat_id = p_chat_id
			and cp.user_id = coalesce(p_user_id, (select auth.uid()))
			and c.family_id = public.current_family_id()
	);
$$;

create or replace function public.is_chat_admin(p_chat_id uuid, p_user_id uuid default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
	select exists (
		select 1
		from public.chat_participants cp
		join public.chats c on c.id = cp.chat_id
		where cp.chat_id = p_chat_id
			and cp.user_id = coalesce(p_user_id, (select auth.uid()))
			and cp.role = 'admin'
			and c.family_id = public.current_family_id()
	);
$$;

create or replace function public.set_chat_message_security()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_family_id uuid;
begin
	select family_id into v_family_id from public.chats where id = new.chat_id;
	if v_family_id is null or v_family_id <> public.current_family_id()
		or not public.is_chat_participant(new.chat_id, auth.uid()) then
		raise exception 'You must be a participant in this family chat.';
	end if;

	new.sender_id := auth.uid();
	if new.attached_photo_id is not null and not exists (
		select 1 from public.photos
		where id = new.attached_photo_id and family_id = v_family_id
	) then
		raise exception 'The attached memory is not in the active family.';
	end if;
	return new;
end;
$$;

drop trigger if exists set_chat_message_security_before_write on public.messages;
create trigger set_chat_message_security_before_write
before insert on public.messages
for each row execute function public.set_chat_message_security();

create or replace function public.set_report_family()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_family_id uuid;
begin
	select c.family_id into v_family_id
	from public.messages m
	join public.chats c on c.id = m.chat_id
	where m.id = new.message_id;

	if v_family_id is null or v_family_id <> public.current_family_id()
		or not public.is_chat_participant((select chat_id from public.messages where id = new.message_id), auth.uid()) then
		raise exception 'Only family chat participants can report a message.';
	end if;
	new.reported_by := auth.uid();
	new.family_id := v_family_id;
	return new;
end;
$$;

drop trigger if exists set_report_family_before_insert on public.reports;
create trigger set_report_family_before_insert
before insert on public.reports
for each row execute function public.set_report_family();

create or replace function public.remove_chat_participant(p_chat_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_family_id uuid;
begin
	select family_id into v_family_id from public.chats where id = p_chat_id and type = 'group';
	if v_family_id is null
		or not public.is_chat_admin(p_chat_id, auth.uid()) then
		raise exception 'Only a group chat admin can remove participants.';
	end if;

	if not exists (select 1 from public.chat_participants where chat_id = p_chat_id and user_id = p_user_id) then
		raise exception 'That person is not a participant in this chat.';
	end if;

	if exists (
		select 1 from public.chat_participants
		where chat_id = p_chat_id and user_id = p_user_id and role = 'admin'
	) and (select count(*) from public.chat_participants where chat_id = p_chat_id and role = 'admin') <= 1 then
		raise exception 'A group must retain at least one admin.';
	end if;

	delete from public.chat_participants where chat_id = p_chat_id and user_id = p_user_id;
end;
$$;

create or replace function public.add_chat_participant(p_chat_id uuid, p_user_id uuid, p_role text default 'member')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_family_id uuid;
begin
	select family_id into v_family_id from public.chats where id = p_chat_id and type = 'group';
	if v_family_id is null or p_role not in ('admin', 'member') or not public.is_chat_admin(p_chat_id, auth.uid()) then
		raise exception 'Only a group chat admin can add participants.';
	end if;
	if not exists (select 1 from public.family_members where family_id = v_family_id and user_id = p_user_id) then
		raise exception 'Only members of this family can join a chat.';
	end if;

	insert into public.chat_participants (chat_id, user_id, role)
	values (p_chat_id, p_user_id, p_role)
	on conflict (chat_id, user_id) do update set role = excluded.role;
end;
$$;

create or replace function public.report_chat_message(p_message_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_report_id uuid;
begin
	insert into public.reports (message_id, reported_by, family_id)
	values (p_message_id, auth.uid(), public.current_family_id())
	returning id into v_report_id;
	return v_report_id;
exception
	when unique_violation then
		raise exception 'You have already reported this message.';
end;
$$;

revoke all on function public.is_family_admin(uuid) from public, anon;
revoke all on function public.is_chat_participant(uuid, uuid) from public, anon;
revoke all on function public.is_chat_admin(uuid, uuid) from public, anon;
revoke all on function public.set_chat_message_security() from public, anon, authenticated;
revoke all on function public.set_report_family() from public, anon, authenticated;
revoke all on function public.remove_chat_participant(uuid, uuid) from public, anon;
revoke all on function public.add_chat_participant(uuid, uuid, text) from public, anon;
revoke all on function public.report_chat_message(uuid) from public, anon;
grant execute on function public.is_family_admin(uuid) to authenticated;
grant execute on function public.is_chat_participant(uuid, uuid) to authenticated;
grant execute on function public.is_chat_admin(uuid, uuid) to authenticated;
grant execute on function public.remove_chat_participant(uuid, uuid) to authenticated;
grant execute on function public.add_chat_participant(uuid, uuid, text) to authenticated;
grant execute on function public.report_chat_message(uuid) to authenticated;

alter table public.chats enable row level security;
alter table public.chat_participants enable row level security;
alter table public.messages enable row level security;
alter table public.message_reads enable row level security;
alter table public.reports enable row level security;

revoke all on public.chats, public.chat_participants, public.messages, public.message_reads, public.reports from anon, authenticated;
grant select, insert, update, delete on public.chats, public.chat_participants, public.messages, public.message_reads, public.reports to authenticated;

drop policy if exists "Participants can read chats" on public.chats;
create policy "Participants can read chats" on public.chats for select to authenticated
using (public.is_chat_participant(id, auth.uid()) or created_by = auth.uid());

drop policy if exists "Family members can create chats" on public.chats;
create policy "Family members can create chats" on public.chats for insert to authenticated
with check (family_id = public.current_family_id() and created_by = auth.uid());

drop policy if exists "Participants can read participant list" on public.chat_participants;
create policy "Participants can read participant list" on public.chat_participants for select to authenticated
using (public.is_chat_participant(chat_id, auth.uid()));

drop policy if exists "Participants can join created chats" on public.chat_participants;
create policy "Participants can join created chats" on public.chat_participants for insert to authenticated
with check (
	user_id = auth.uid()
	and (
		public.is_chat_participant(chat_id, auth.uid())
		or exists (
			select 1 from public.chats
			where id = chat_id and created_by = auth.uid() and family_id = public.current_family_id()
		)
	)
	and (
		not exists (select 1 from public.chats where id = chat_id and created_by = auth.uid())
		or role = 'admin'
	)
);

drop policy if exists "Group admins can delete group chats" on public.chats;
create policy "Group admins can delete group chats" on public.chats for delete to authenticated
using (type = 'group' and public.is_chat_admin(id, auth.uid()));

drop policy if exists "Participants can read messages" on public.messages;
create policy "Participants can read messages" on public.messages for select to authenticated
using (public.is_chat_participant(chat_id, auth.uid()));

drop policy if exists "Participants can send messages" on public.messages;
create policy "Participants can send messages" on public.messages for insert to authenticated
with check (public.is_chat_participant(chat_id, auth.uid()) and sender_id = auth.uid());

drop policy if exists "Senders can soft-delete messages" on public.messages;
create policy "Senders can soft-delete messages" on public.messages for update to authenticated
using (sender_id = auth.uid() and public.is_chat_participant(chat_id, auth.uid()))
with check (sender_id = auth.uid() and is_deleted = true);

drop policy if exists "Participants can read message receipts" on public.message_reads;
create policy "Participants can read message receipts" on public.message_reads for select to authenticated
using (exists (select 1 from public.messages m where m.id = message_id and public.is_chat_participant(m.chat_id, auth.uid())));

drop policy if exists "Participants can write own receipts" on public.message_reads;
create policy "Participants can write own receipts" on public.message_reads for insert to authenticated
with check (user_id = auth.uid() and exists (select 1 from public.messages m where m.id = message_id and public.is_chat_participant(m.chat_id, auth.uid())));

drop policy if exists "Users can report received messages" on public.reports;
create policy "Users can report received messages" on public.reports for insert to authenticated
with check (reported_by = auth.uid() and family_id = public.current_family_id());

drop policy if exists "Family admins can read reports" on public.reports;
create policy "Family admins can read reports" on public.reports for select to authenticated
using (public.is_family_admin(family_id));

alter table public.messages replica identity full;
alter table public.message_reads replica identity full;

do $$
begin
	if not exists (
		select 1 from pg_publication_tables
		where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
	) then
		alter publication supabase_realtime add table public.messages;
	end if;
	if not exists (
		select 1 from pg_publication_tables
		where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'message_reads'
	) then
		alter publication supabase_realtime add table public.message_reads;
	end if;
end;
$$;

-- Family admins can review reports with:
-- select r.*, m.chat_id, m.sender_id, m.content, m.created_at as message_created_at
-- from public.reports r join public.messages m on m.id = r.message_id
-- where r.family_id = public.current_family_id() order by r.created_at desc;
