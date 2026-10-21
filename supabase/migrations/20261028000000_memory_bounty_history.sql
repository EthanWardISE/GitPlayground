drop trigger if exists resolve_bounty_after_submission on public.bounty_submissions;
drop function if exists public.resolve_bounty_after_submission();

create or replace function public.resolve_bounty(p_bounty_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
	if not public.is_family_member() then
		raise exception 'An approved family account is required.';
	end if;
	update public.bounties
	set status = 'resolved', resolved_at = coalesce(resolved_at, now())
	where id = p_bounty_id and status = 'open';
	if not found then
		raise exception 'This bounty is no longer open.';
	end if;
end;
$$;

revoke all on function public.resolve_bounty(uuid) from public, anon;
grant execute on function public.resolve_bounty(uuid) to authenticated;
