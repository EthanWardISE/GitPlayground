type AppIconName = 'home' | 'tree' | 'book' | 'plus' | 'search' | 'bullseye' | 'settings' | 'arrow' | 'image' | 'bubble' | 'trash' | 'close' | 'lock' | 'logout';

export default function AppIcon({ name, size = 20 }: { name: AppIconName; size?: number }) {
	const paths: Record<AppIconName, string> = {
		home: 'M3 10.5 12 3l9 7.5M5 9v11h14V9M9 20v-6h6v6',
		tree: 'M12 21v-7m0-4V3m0 7-5-4m5 4 5-4M5 7l-2 2m14-2 2 2M9 14H6m9 0h3',
		book: 'M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5zm0 0v16M8 7h8M8 11h8',
		plus: 'M12 5v14m-7-7h14',
		search: 'm20 20-4.5-4.5M18 10.5a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z',
		bullseye: 'M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18Zm0 4a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm0 4a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z',
		settings: 'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z',
		arrow: 'M5 12h14m-7-7 7 7-7 7',
		image: 'M4 5h16v14H4zM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm11.5 5-5-5-8 9',
		bubble: 'M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 4v-4H6.5A2.5 2.5 0 0 1 4 12.5z',
		trash: 'M4 7h16m-10 4v6m4-6v6M9 7V4h6v3m-9 0 1 13h10l1-13',
		close: 'm18 6-12 12M6 6l12 12',
		lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
		logout: 'M10 17l5-5-5-5m5 5H3m9-9h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7',
	};

	return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} />{name === 'settings' && <circle cx="12" cy="12" r="3" />}</svg>;
}
