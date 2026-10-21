alter table public.profiles
	add column if not exists default_country_code varchar(3) not null default 'IE';

alter table public.photos
	add column if not exists country_code varchar(3);

alter table public.collections
	add column if not exists country_code varchar(3);

alter table public.profiles
	drop constraint if exists profiles_default_country_code_format;
alter table public.profiles
	add constraint profiles_default_country_code_format
	check (default_country_code = upper(default_country_code) and char_length(default_country_code) in (2, 3));

alter table public.photos
	drop constraint if exists photos_country_code_format;
alter table public.photos
	add constraint photos_country_code_format
	check (country_code is null or (country_code = upper(country_code) and char_length(country_code) in (2, 3)));

alter table public.collections
	drop constraint if exists collections_country_code_format;
alter table public.collections
	add constraint collections_country_code_format
	check (country_code is null or (country_code = upper(country_code) and char_length(country_code) in (2, 3)));

create index if not exists photos_country_code_idx on public.photos (country_code);
create index if not exists collections_country_code_idx on public.collections (country_code);

create or replace function public.get_photos_with_resolved_country()
returns table (
	id uuid,
	title text,
	file_path text,
	year integer,
	uploaded_by uuid,
	tagged_profiles uuid[],
	created_at timestamptz,
	country_code varchar(3),
	country_source text
)
language sql
stable
security invoker
set search_path = ''
as $$
	select
		p.id,
		p.title,
		p.file_path,
		p.year,
		p.uploaded_by,
		p.tagged_profiles,
		p.created_at,
		coalesce(
			p.country_code,
			collection_country.country_code,
			profile.default_country_code
		) as country_code,
		case
			when p.country_code is not null then 'photo'
			when collection_country.country_code is not null then 'collection'
			else 'profile'
		end as country_source
	from public.photos p
	left join lateral (
		select c.country_code
		from public.collection_photos cp
		join public.collections c on c.id = cp.collection_id
		where cp.photo_id = p.id and c.country_code is not null
		order by c.updated_at desc, c.id
		limit 1
	) collection_country on true
	left join public.profiles profile on profile.user_id = p.uploaded_by
	where (select public.is_family_member());
$$;

revoke all on function public.get_photos_with_resolved_country() from public, anon;
grant execute on function public.get_photos_with_resolved_country() to authenticated;
