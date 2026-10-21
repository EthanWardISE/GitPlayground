/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}'],
	theme: {
		extend: {
			colors: {
				kinfolk: {
					cream: '#fbf9f5',
					linen: '#f2eee6',
					stone: '#e8e2d5',
					moss: '#3f5e4d',
					leaf: '#6b8968',
					ink: '#312f29',
					muted: '#817d72',
					peach: '#d8a084',
				},
			},
			fontFamily: {
				sans: ['Atkinson', 'Avenir Next', 'Avenir', 'sans-serif'],
				serif: ['Georgia', 'Times New Roman', 'serif'],
			},
			boxShadow: {
				soft: '0 24px 80px rgba(49, 47, 41, 0.12)',
				card: '0 14px 40px rgba(49, 47, 41, 0.08)',
			},
			borderRadius: {
				'4xl': '2.25rem',
			},
		},
	},
};
