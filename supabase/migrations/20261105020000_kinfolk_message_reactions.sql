create table if not exists public.message_reactions (
	message_id uuid not null references public.messages (id) on delete cascade,
	user_id uuid not null references auth.users (id) on delete cascade,
	emoji text not null check (emoji in ('❤️', '😂', '😊', '😮', '😢', '👏', '🙏', '🎉')),
	created_at timestamptz not null default now(),
	primary key (message_id, user_id, emoji)
);

create index if not exists message_reactions_message_idx
	on public.message_reactions (message_id, created_at);

alter table public.message_reactions enable row level security;
revoke all on public.message_reactions from anon, authenticated;
grant select, insert, delete on public.message_reactions to authenticated;

drop policy if exists "Participants can read message reactions" on public.message_reactions;
create policy "Participants can read message reactions"
on public.message_reactions for select to authenticated
using (
	exists (
		select 1
		from public.messages m
		where m.id = message_id
			and public.is_chat_participant(m.chat_id, auth.uid())
	)
);

drop policy if exists "Participants can add own reactions" on public.message_reactions;
create policy "Participants can add own reactions"
on public.message_reactions for insert to authenticated
with check (
	user_id = auth.uid()
	and exists (
		select 1
		from public.messages m
		where m.id = message_id
			and public.is_chat_participant(m.chat_id, auth.uid())
	)
);

drop policy if exists "Users can remove own reactions" on public.message_reactions;
create policy "Users can remove own reactions"
on public.message_reactions for delete to authenticated
using (user_id = auth.uid());

alter table public.message_reactions replica identity full;

do $$
begin
	if not exists (
		select 1 from pg_publication_tables
		where pubname = 'supabase_realtime'
			and schemaname = 'public'
			and tablename = 'message_reactions'
	) then
		alter publication supabase_realtime add table public.message_reactions;
	end if;
end;
$$;
