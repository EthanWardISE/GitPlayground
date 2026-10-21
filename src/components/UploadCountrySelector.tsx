import { useMemo, useState } from 'react';
import { getCountries, countryName } from '../lib/countries';

export default function UploadCountrySelector({ defaultCountry = 'IE', value, onChange }: {
	defaultCountry?: string;
	value: string | null;
	onChange: (countryCode: string | null) => void;
}) {
	const countries = useMemo(() => getCountries(), []);
	const [outside, setOutside] = useState(value !== null);
	return (
		<fieldset className="upload-location">
			<legend>Where was it taken?</legend>
			<label className={`location-toggle-card ${outside ? 'selected' : ''}`}>
				<span className="location-toggle-copy">
					<strong>Taken outside of {countryName(defaultCountry)}?</strong>
					<small>Choose another country if this memory was made abroad.</small>
				</span>
				<input
					type="checkbox"
					checked={outside}
					onChange={(event) => {
						setOutside(event.target.checked);
						onChange(event.target.checked ? value ?? defaultCountry : null);
					}}
				/>
				<span className="location-switch" aria-hidden="true"><span /></span>
			</label>
			{outside && (
				<div className="country-dropdown">
					<label htmlFor="memory-country">Memory country</label>
					<select id="memory-country" value={value ?? defaultCountry} onChange={(event) => onChange(event.target.value)}>
						{countries.map((country) => <option key={country.code} value={country.code}>{country.name}</option>)}
					</select>
				</div>
			)}
		</fieldset>
	);
}
