alter table public.person_relationships
	add column if not exists connection_source uuid references public.profiles (id) on delete cascade,
	add column if not exists source_handle text,
	add column if not exists target_handle text;

alter table public.person_relationships
	drop constraint if exists person_relationships_connection_source_check,
	add constraint person_relationships_connection_source_check
		check (connection_source is null or connection_source in (person_a, person_b)),
	drop constraint if exists person_relationships_source_handle_check,
	add constraint person_relationships_source_handle_check
		check (source_handle is null or source_handle in ('top-target', 'left-target', 'right-source', 'bottom-source')),
	drop constraint if exists person_relationships_target_handle_check,
	add constraint person_relationships_target_handle_check
		check (target_handle is null or target_handle in ('top-target', 'left-target', 'right-source', 'bottom-source'));

grant insert (person_a, person_b, relationship_type, started_on, ended_on, connection_source, source_handle, target_handle)
	on public.person_relationships to authenticated;
