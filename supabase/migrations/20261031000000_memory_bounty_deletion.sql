grant delete on public.bounties to authenticated;

drop policy if exists "Requesters and admins can delete bounties" on public.bounties;
create policy "Requesters and admins can delete bounties"
on public.bounties for delete to authenticated
using (
	(select public.is_family_member())
	and (
		requested_by = (select auth.uid())
		or exists (
			select 1
			from public.family_members
			where user_id = (select auth.uid()) and role = 'admin'
		)
	)
);
