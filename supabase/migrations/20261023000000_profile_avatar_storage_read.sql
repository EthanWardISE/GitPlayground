drop policy if exists "Family can read profile avatars" on storage.objects;
create policy "Family can read profile avatars"
on storage.objects for select to authenticated
using (
	bucket_id = 'family-photos'
	and (select public.is_family_member())
	and name like '%/profile-avatars/%.webp'
);
