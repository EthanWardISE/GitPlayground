create or replace function public.add_chat_participant(
	p_chat_id uuid,
	p_user_id uuid,
	p_role text default 'member'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_chat public.chats%rowtype;
begin
	select * into v_chat
	from public.chats
	where id = p_chat_id
		and family_id = public.current_family_id()
		and type in ('direct', 'group');

	if not found or p_role not in ('admin', 'member') then
		raise exception 'This chat is unavailable.';
	end if;

	if not (
		public.is_chat_admin(p_chat_id, auth.uid())
		or v_chat.created_by = auth.uid()
	) then
		raise exception 'Only a chat administrator or its creator can add participants.';
	end if;

	if not exists (
		select 1
		from public.family_members
		where family_id = v_chat.family_id
			and user_id = p_user_id
	) then
		raise exception 'Only members of this family can join a chat.';
	end if;

	insert into public.chat_participants (chat_id, user_id, role)
	values (p_chat_id, p_user_id, p_role)
	on conflict (chat_id, user_id) do update set role = excluded.role;
end;
$$;

revoke all on function public.add_chat_participant(uuid, uuid, text) from public, anon;
grant execute on function public.add_chat_participant(uuid, uuid, text) to authenticated;
