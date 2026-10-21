import { useEffect, useMemo, useState } from 'react';
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps';
import { createSupabaseClient, getResolvedPhotos, getSupabaseErrorMessage, PHOTO_BUCKET } from '../lib/supabase';
import { countryName, getCountries, normalizeCountryCode } from '../lib/countries';
import CountryPhotoGallery from './CountryPhotoGallery';
import type { ResolvedPhotoRow } from '../types/database';

type Pin = { code: string; count: number; thumbnail?: string };

const mapCountryAliases: Record<string, string> = {
	'United States of America': 'US',
	'United Kingdom': 'GB',
	'Democratic Republic of the Congo': 'CD',
	'Congo': 'CG',
	'Tanzania': 'TZ',
	'W. Sahara': 'EH',
	'Western Sahara': 'EH',
	'Czechia': 'CZ',
	'Ivory Coast': 'CI',
	'Eswatini': 'SZ',
	'North Macedonia': 'MK',
	'Russia': 'RU',
	'South Korea': 'KR',
	'North Korea': 'KP',
	'Laos': 'LA',
	'Vietnam': 'VN',
	'Turkey': 'TR',
	'Bolivia': 'BO',
	'Venezuela': 'VE',
};

function normalizeMapCountryName(name: string) {
	return name
		.replace(/\s*\([^)]*\)/g, '')
		.replace(/^the\s+/i, '')
		.replace(/[.,']/g, '')
		.trim()
		.toLowerCase();
}

function clampViewport(coordinates: [number, number], zoom: number): [number, number] {
	const zoomProgress = Math.max(0, Math.min(1, (zoom - 1) / 3));
	const maxLongitude = 100 * zoomProgress;
	const maxLatitude = 55 * zoomProgress;
	return [
		Math.max(-maxLongitude, Math.min(maxLongitude, coordinates[0])),
		Math.max(-maxLatitude, Math.min(maxLatitude, coordinates[1])),
	];
}

export default function KinfolkWorldMap() {
	const [photos, setPhotos] = useState<ResolvedPhotoRow[]>([]);
	const [pins, setPins] = useState<Pin[]>([]);
	const [selected, setSelected] = useState<string | null>(null);
	const [viewport, setViewport] = useState<{ coordinates: [number, number]; zoom: number }>({
		coordinates: [0, 0],
		zoom: 1,
	});
	const [error, setError] = useState('');

	useEffect(() => {
		let cancelled = false;
		async function load() {
			try {
				const rows = await getResolvedPhotos();
				const withUrls = await Promise.all(rows.map(async (photo) => {
					const { data, error: urlError } = await createSupabaseClient().storage.from(PHOTO_BUCKET)
						.createSignedUrl(photo.file_path, 60 * 60, { transform: { width: 96, height: 96, resize: 'cover' } });
					if (urlError) throw urlError;
					return { ...photo, country_code: normalizeCountryCode(photo.country_code), file_path: data.signedUrl };
				}));
				const grouped = new Map<string, Pin>();
				withUrls.forEach((photo) => {
					if (!photo.country_code) return;
					const current = grouped.get(photo.country_code);
					grouped.set(photo.country_code, { code: photo.country_code, count: (current?.count ?? 0) + 1, thumbnail: current?.thumbnail ?? photo.file_path });
				});
				if (!cancelled) {
					setPhotos(withUrls);
					setPins([...grouped.values()]);
				}
			} catch (loadError) {
				if (!cancelled) setError(getSupabaseErrorMessage(loadError, 'Could not load the family map.'));
			}
		}
		void load();
		return () => { cancelled = true; };
	}, []);

	const selectedPhotos = useMemo(() => photos.filter((photo) => photo.country_code === selected), [photos, selected]);
	const activeCodes = useMemo(() => new Set(pins.map((pin) => pin.code)), [pins]);
	const countries = useMemo(() => getCountries(), []);
	const exploredPercentage = countries.length ? Math.round((activeCodes.size / countries.length) * 100) : 0;
	const nameToCode = useMemo(() => {
		const result = new Map(countries.map((country) => [normalizeMapCountryName(country.name), country.code]));
		Object.entries(mapCountryAliases).forEach(([name, code]) => result.set(normalizeMapCountryName(name), code));
		return result;
	}, [countries]);

	return (
		<section className="map-page">
			<div className="map-heading">
				<div>
					<div className="eyebrow">Your family, around the world</div>
					<h1>Memory map</h1>
					<p className="muted">Every place carries a story. Tap or click a green country to open its memories; drag or pinch to explore.</p>
				</div>
				<div className="map-heading-side">
					<div className="explored-stat" aria-label={`${exploredPercentage}% of the world explored`}>
						<strong>{exploredPercentage}%</strong>
						<span>of the world explored</span>
					</div>
					<div className="map-controls" aria-label="Map controls">
						<button type="button" onClick={() => setViewport((current) => {
							const zoom = Math.min(4, current.zoom + 0.5);
							return { coordinates: clampViewport(current.coordinates, zoom), zoom };
						})} aria-label="Zoom in">+</button>
						<button type="button" onClick={() => setViewport((current) => {
							const zoom = Math.max(1, current.zoom - 0.5);
							return { coordinates: clampViewport(current.coordinates, zoom), zoom };
						})} aria-label="Zoom out">−</button>
						<button type="button" onClick={() => setViewport({ coordinates: [0, 0], zoom: 1 })}>Reset view</button>
					</div>
				</div>
			</div>
			{error && <p className="form-error" role="alert">{error}</p>}
			<div className="map-stage">
				<ComposableMap projection="geoEqualEarth" projectionConfig={{ scale: 145 }}>
					<ZoomableGroup
						center={viewport.coordinates}
						zoom={viewport.zoom}
						minZoom={1}
						maxZoom={4}
						onMoveEnd={({ coordinates, zoom: nextZoom }) => {
							if (nextZoom !== undefined) setViewport({
								coordinates: clampViewport(coordinates, nextZoom),
								zoom: nextZoom,
							});
						}}
					>
						<Geographies geography="/world-110m.json">
							{({ geographies }) => geographies.map((geography) => {
								const code = geography.properties
									? nameToCode.get(normalizeMapCountryName(geography.properties.name))
									: undefined;
								const pin = code ? pins.find((item) => item.code === code) : undefined;
								return <g key={geography.rsmKey}>
									<Geography
										geography={geography}
										className={code && activeCodes.has(code) ? 'map-country active' : 'map-country'}
										onClick={() => code && activeCodes.has(code) && setSelected(code)}
										tabIndex={code && activeCodes.has(code) ? 0 : -1}
										aria-label={code && activeCodes.has(code) ? `${countryName(code)}: ${pin?.count ?? 0} photos` : undefined}
									/>
								</g>;
							})}
						</Geographies>
					</ZoomableGroup>
				</ComposableMap>
			</div>
			{selected && <CountryPhotoGallery countryCode={selected} photos={selectedPhotos} onClose={() => setSelected(null)} />}
		</section>
	);
}
