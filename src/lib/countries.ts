import * as countryList from 'country-list';
import iso3166 from 'iso-3166-1';

export type Country = { code: string; name: string };

export function normalizeCountryCode(code: string | null | undefined) {
	if (!code) return null;
	const normalized = code.trim().toUpperCase();
	if (normalized.length === 2) return normalized;
	return iso3166.whereAlpha3(normalized)?.alpha2 ?? normalized;
}

export function getCountries(): Country[] {
	return countryList.getData()
		.map(({ code, name }) => ({ code, name }))
		.sort((a, b) => a.name.localeCompare(b.name));
}

export function countryName(code: string | null | undefined) {
	if (!code) return 'Unknown location';
	const alpha2 = normalizeCountryCode(code);
	return getCountries().find((country) => country.code === alpha2)?.name ?? code;
}
