declare module 'iso-3166-1' {
	type Country = {
		country: string;
		alpha2: string;
		alpha3: string;
		numeric: string;
	};

	const iso3166: {
		whereAlpha3(code: string): Country | undefined;
	};

	export default iso3166;
}
