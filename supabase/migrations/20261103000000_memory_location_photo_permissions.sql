grant insert (title, file_path, year, uploaded_by, tagged_profiles, country_code)
	on public.photos to authenticated;
grant update (title, file_path, year, tagged_profiles, country_code)
	on public.photos to authenticated;
