import { useEffect, useMemo, useState } from 'react';
import { getSupabaseErrorMessage, updateDefaultCountry, createSupabaseClient } from '../lib/supabase';
import { getCountries } from '../lib/countries';

export default function LocationSettings() {
	const countries = useMemo(() => getCountries(), []);
	const [value, setValue] = useState('IE');
	const [status, setStatus] = useState('');
	const [error, setError] = useState('');

	useEffect(() => {
		void createSupabaseClient().from('profiles').select('default_country_code').single()
			.then(({ data, error: loadError }) => {
				if (loadError) setError(getSupabaseErrorMessage(loadError, 'Could not load location settings.'));
				else if (data?.default_country_code) setValue(data.default_country_code);
			});
	}, []);

	async function save() {
		setStatus('');
		setError('');
		try {
			await updateDefaultCountry(value);
			setStatus('Your default location has been saved.');
		} catch (saveError) {
			setError(getSupabaseErrorMessage(saveError, 'Could not save location settings.'));
		}
	}

	return (
		<section className="location-settings" aria-labelledby="location-settings-title">
			<div className="eyebrow">Your settings</div>
			<h2 id="location-settings-title">Location settings</h2>
			<p className="muted">This country is used when a photo and its photobook do not have a location.</p>
			<label className="location-field">
				Default country
				<select value={value} onChange={(event) => setValue(event.target.value)}>
					{countries.map((country) => <option key={country.code} value={country.code}>{country.name}</option>)}
				</select>
			</label>
			<button className="button button-primary button-small" type="button" onClick={() => void save()}>Save location</button>
			{status && <p className="form-notice" role="status">{status}</p>}
			{error && <p className="form-error" role="alert">{error}</p>}
		</section>
	);
}
