alter table public.reports
	add column if not exists reason text;

update public.reports set reason = 'Reported by a family member' where reason is null;
alter table public.reports alter column reason set not null;

alter table public.reports drop constraint if exists reports_status_check;
alter table public.reports add constraint reports_status_check check (status in ('open', 'reviewed', 'dismissed', 'resolved'));

create or replace function public.report_chat_message(p_message_id uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_report_id uuid;
begin
	if char_length(trim(p_reason)) not between 1 and 1000 then
		raise exception 'A report reason is required.';
	end if;
	insert into public.reports (message_id, reported_by, family_id, reason)
	values (p_message_id, auth.uid(), public.current_family_id(), trim(p_reason))
	returning id into v_report_id;
	return v_report_id;
exception when unique_violation then
	raise exception 'You have already reported this message.';
end;
$$;

create or replace function public.resolve_chat_report(p_report_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
	update public.reports
	set status = 'resolved'
	where id = p_report_id
		and family_id = public.current_family_id()
		and public.is_family_admin(family_id);
	if not found then raise exception 'Report not found or admin access is required.'; end if;
end;
$$;

revoke all on function public.report_chat_message(uuid, text) from public, anon;
revoke all on function public.resolve_chat_report(uuid) from public, anon;
grant execute on function public.report_chat_message(uuid, text) to authenticated;
grant execute on function public.resolve_chat_report(uuid) to authenticated;
