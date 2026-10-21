drop index if exists public.profile_claim_one_pending_per_user_idx;
drop index if exists public.profile_claim_one_pending_per_profile_idx;

create unique index if not exists profile_claim_one_pending_per_user_family_idx
	on public.profile_claim_requests (family_id, claimant_id)
	where status = 'pending';
create unique index if not exists profile_claim_one_pending_per_profile_family_idx
	on public.profile_claim_requests (family_id, profile_id)
	where status = 'pending';

create or replace function public.request_profile_claim(p_profile_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_user_id uuid := auth.uid();
	v_family_id uuid := public.current_family_id();
	v_request_id uuid;
begin
	if v_user_id is null or v_family_id is null or not public.is_family_member() then
		raise exception 'An approved family account is required.';
	end if;

	if exists (
		select 1
		from public.profiles
		where user_id = v_user_id
			and family_id = v_family_id
	) then
		raise exception 'Your account is already linked to a profile in this family.';
	end if;

	if not exists (
		select 1
		from public.profiles
		where id = p_profile_id
			and family_id = v_family_id
			and user_id is null
	) then
		raise exception 'This person profile is unavailable to claim.';
	end if;

	if exists (
		select 1
		from public.profile_claim_requests
		where family_id = v_family_id
			and status = 'pending'
			and (claimant_id = v_user_id or profile_id = p_profile_id)
	) then
		raise exception 'A claim request is already pending for this account or person profile.';
	end if;

	insert into public.profile_claim_requests (family_id, profile_id, claimant_id)
	values (v_family_id, p_profile_id, v_user_id)
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
	v_family_id uuid := public.current_family_id();
	v_request public.profile_claim_requests%rowtype;
begin
	if v_family_id is null
		or not exists (
			select 1
			from public.family_members
			where family_id = v_family_id
				and user_id = v_admin_id
				and role = 'admin'
		) then
		raise exception 'Only a family admin can review claims.';
	end if;

	select *
	into v_request
	from public.profile_claim_requests
	where id = p_request_id
		and family_id = v_family_id
		and status = 'pending'
	for update;

	if not found then
		raise exception 'This claim request is no longer pending in the active family.';
	end if;

	if p_approve then
		if exists (
			select 1
			from public.profiles
			where user_id = v_request.claimant_id
				and family_id = v_family_id
		) then
			raise exception 'This account is already linked to a person profile in this family.';
		end if;

		update public.profiles
		set user_id = v_request.claimant_id
		where id = v_request.profile_id
			and family_id = v_family_id
			and user_id is null;
		if not found then
			raise exception 'This person profile has already been claimed.';
		end if;
	end if;

	update public.profile_claim_requests
	set status = case when p_approve then 'approved' else 'rejected' end,
		reviewed_by = v_admin_id,
		reviewed_at = now()
	where id = p_request_id
		and family_id = v_family_id;
end;
$$;

revoke all on function public.request_profile_claim(uuid) from public, anon;
revoke all on function public.review_profile_claim(uuid, boolean) from public, anon;
grant execute on function public.request_profile_claim(uuid) to authenticated;
grant execute on function public.review_profile_claim(uuid, boolean) to authenticated;
