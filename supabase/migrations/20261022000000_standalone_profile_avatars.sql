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

	if p_avatar_path not like v_user_id::text || '/profile-avatars/%.webp'
		or not exists (
			select 1
			from storage.objects o
			where o.bucket_id = 'family-photos'
				and o.name = p_avatar_path
		)
	then
		raise exception 'Upload a valid profile picture before saving it.';
	end if;

	if p_source_photo_id is not null and not exists (
		select 1
		from public.photos p
		where p.id = p_source_photo_id
			and p.uploaded_by = v_user_id
			and p.tagged_profiles @> array[p_profile_id]
	) then
		raise exception 'Choose a photo you uploaded that tags this person.';
	end if;

	update public.profiles
	set avatar_file_path = p_avatar_path
	where id = p_profile_id;
	if not found then
		raise exception 'Person profile not found.';
	end if;
end;
$$;

revoke all on function public.set_profile_avatar(uuid, uuid, text) from public, anon;
grant execute on function public.set_profile_avatar(uuid, uuid, text) to authenticated;
