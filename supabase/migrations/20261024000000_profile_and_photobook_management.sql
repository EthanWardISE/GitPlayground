create or replace function public.clear_profile_avatar(p_profile_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_user_id uuid := auth.uid();
	v_profile_user_id uuid;
	v_avatar_path text;
begin
	if v_user_id is null or not public.is_family_member() then
		raise exception 'An approved family account is required.';
	end if;

	select user_id, avatar_file_path
	into v_profile_user_id, v_avatar_path
	from public.profiles
	where id = p_profile_id
	for update;
	if not found then
		raise exception 'Person profile not found.';
	end if;

	if v_profile_user_id is distinct from v_user_id and not exists (
		select 1
		from public.family_members
		where user_id = v_user_id and role = 'admin'
	) then
		raise exception 'Only this profile owner or a family admin can remove its picture.';
	end if;

	update public.profiles
	set avatar_file_path = null
	where id = p_profile_id;

	return v_avatar_path;
end;
$$;

revoke all on function public.clear_profile_avatar(uuid) from public, anon;
grant execute on function public.clear_profile_avatar(uuid) to authenticated;
