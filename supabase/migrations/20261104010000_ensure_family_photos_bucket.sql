insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
	'family-photos',
	'family-photos',
	false,
	52428800,
	array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']::text[]
)
on conflict (id) do nothing;
