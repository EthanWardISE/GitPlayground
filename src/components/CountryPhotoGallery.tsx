import { useMemo, useState } from 'react';
import { countryName } from '../lib/countries';
import type { ResolvedPhotoRow } from '../types/database';

export default function CountryPhotoGallery({ countryCode, photos, onClose }: {
	countryCode: string;
	photos: ResolvedPhotoRow[];
	onClose: () => void;
}) {
	const [year, setYear] = useState('all');
	const years = useMemo(() => [...new Set(photos.map((photo) => photo.year))].sort((a, b) => b - a), [photos]);
	const visible = photos.filter((photo) => year === 'all' || String(photo.year) === year);
	return (
		<aside className="country-gallery" aria-label={`${countryName(countryCode)} memories`}>
			<button className="gallery-close" type="button" onClick={onClose} aria-label="Close gallery">×</button>
			<div className="eyebrow">A place in your story</div>
			<h2>{countryName(countryCode)}</h2>
			<p className="muted">{photos.length} {photos.length === 1 ? 'memory' : 'memories'}</p>
			<label className="gallery-filter">Year
				<select value={year} onChange={(event) => setYear(event.target.value)}>
					<option value="all">All years</option>
					{years.map((item) => <option key={item} value={item}>{item}</option>)}
				</select>
			</label>
			<div className="country-photo-grid">
				{visible.map((photo) => <img key={photo.id} src={photo.file_path} alt={photo.title ?? `${countryName(countryCode)} memory`} loading="lazy" />)}
			</div>
		</aside>
	);
}
