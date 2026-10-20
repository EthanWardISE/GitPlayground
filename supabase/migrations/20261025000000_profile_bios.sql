alter table public.profiles
	add column if not exists bio text
	check (bio is null or char_length(bio) <= 1000);

create or replace function public.update_my_profile_bio(p_bio text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_user_id uuid := auth.uid();
	v_bio text := nullif(trim(p_bio), '');
begin
	if v_user_id is null or not public.is_family_member() then
		raise exception 'An approved family account is required.';
	end if;
	if v_bio is not null and char_length(v_bio) > 1000 then
		raise exception 'Your bio must be 1,000 characters or fewer.';
	end if;

	update public.profiles
	set bio = v_bio
	where user_id = v_user_id;
	if not found then
		raise exception 'Claim a person profile before adding your bio.';
	end if;
end;
$$;

revoke all on function public.update_my_profile_bio(text) from public, anon;
grant execute on function public.update_my_profile_bio(text) to authenticated;
