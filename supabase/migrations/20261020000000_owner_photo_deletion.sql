drop policy if exists "Family can update photos" on public.photos;
create policy "Authors can update their photos"
on public.photos for update to authenticated
using (
	(select public.is_family_member())
	and uploaded_by = (select auth.uid())
)
with check (
	(select public.is_family_member())
	and uploaded_by = (select auth.uid())
);

drop policy if exists "Family can delete photos" on public.photos;
create policy "Authors can delete their photos"
on public.photos for delete to authenticated
using (
	(select public.is_family_member())
	and uploaded_by = (select auth.uid())
);

drop policy if exists "Family can read album photos" on storage.objects;
create policy "Family can read album photos"
on storage.objects for select to authenticated
using (
	bucket_id = 'family-photos'
	and (select public.is_family_member())
	and exists (
		select 1
		from public.photos
		where file_path = name
	)
);

drop policy if exists "Family can delete album photos" on storage.objects;
create policy "Authors can delete their album photos"
on storage.objects for delete to authenticated
using (
	bucket_id = 'family-photos'
	and (select public.is_family_member())
	and (
		name like (select auth.uid())::text || '/%'
		or exists (
			select 1
			from public.photos
			where file_path = name
				and uploaded_by = (select auth.uid())
		)
	)
);
