drop policy if exists "Active family can read storage" on storage.objects;

create policy "Active family can read storage"
on storage.objects for select to authenticated
using (
	bucket_id = 'family-photos'
	and (select public.is_family_member())
	and (
		name like 'families/' || (select public.current_family_id())::text || '/%'
		or (
			(select public.current_family_id()) = (
				select id
				from public.families
				order by created_at, id
				limit 1
			)
			and (
				exists (
					select 1
					from public.photos
					where file_path = storage.objects.name
						and family_id = (select public.current_family_id())
				)
				or exists (
					select 1
					from public.profiles
					where avatar_file_path = storage.objects.name
						and family_id = (select public.current_family_id())
				)
			)
		)
	)
);
