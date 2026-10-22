import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { configureSupabaseClient, createSupabaseClient, getSupabaseErrorMessage, PHOTO_BUCKET } from '../lib/supabase';
import CollectionsPanel from './CollectionsPanel';
import BountyFeed from './BountyFeed';
import FamilyTreeCanvas from './FamilyTreeCanvas';
import KinfolkWorldMap from './KinfolkWorldMap';
import UploadCountrySelector from './UploadCountrySelector';
import LocationSettings from './LocationSettings';
import Messenger from './Messenger';
import ReportReviewPanel from './ReportReviewPanel';
import { countryName, normalizeCountryCode } from '../lib/countries';
import type { CommentDocument, CommentRow, FamilyRow, PhotoDocument, ProfileClaimRequestRow, ProfileDocument, ProfileRow } from '../types/database';

type AppStatus = 'loading' | 'signedOut' | 'pending' | 'ready' | 'setup' | 'error';
interface AppUser {
	$id: string;
	name: string;
	email: string;
}

interface FamilyAppProps {
	view?: 'feed' | 'tree' | 'person' | 'collections' | 'bounties' | 'map' | 'settings' | 'messenger';
	personId?: string;
	collectionId?: string;
}

export function AppIcon({ name, size = 20 }: { name: 'home' | 'tree' | 'book' | 'plus' | 'search' | 'bullseye' | 'settings' | 'arrow' | 'image' | 'bubble' | 'close' | 'lock' | 'logout'; size?: number }) {
	const paths: Record<typeof name, string> = {
		home: 'M3 10.5 12 3l9 7.5M5 9v11h14V9M9 20v-6h6v6',
		tree: 'M12 21v-7m0-4V3m0 7-5-4m5 4 5-4M5 7l-2 2m14-2 2 2M9 14H6m9 0h3',
		book: 'M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5zm0 0v16M8 7h8M8 11h8',
		plus: 'M12 5v14m-7-7h14',
		search: 'm20 20-4.5-4.5M18 10.5a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z',
		bullseye: 'M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18Zm0 4a5 5 0 1 0 0 10 5 5 0 1 0 0-10Zm0 4a1 1 0 1 0 0 2 1 1 0 1 0 0-2Z',
		settings: 'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z',
		arrow: 'M5 12h14m-7-7 7 7-7 7',
		image: 'M4 5h16v14H4zM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm11.5 5-5-5-8 9',
		bubble: 'M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 4v-4H6.5A2.5 2.5 0 0 1 4 12.5z',
		close: 'm18 6-12 12M6 6l12 12',
		lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
		logout: 'M10 17l5-5-5-5m5 5H3m9-9h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7',
	};

	return (
		<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
			<path d={paths[name]} />
			{name === 'settings' && <circle cx="12" cy="12" r="3" />}
		</svg>
	);
}

function initials(name: string) {
	return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function formatBirthDate(value?: string) {
	if (!value) return '';
	const date = new Date(`${value}T00:00:00`);
	return Number.isNaN(date.getTime())
		? ''
		: date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

function createUuid() {
	const bytes = new Uint8Array(16);
	crypto.getRandomValues(bytes);
	bytes[6] = (bytes[6] & 0x0f) | 0x40;
	bytes[8] = (bytes[8] & 0x3f) | 0x80;
	const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function getMessage(error: unknown): string {
	return getSupabaseErrorMessage(error);
}

function isMissingStorageObject(error: unknown): boolean {
	return typeof error === 'object'
		&& error !== null
		&& 'message' in error
		&& typeof error.message === 'string'
		&& /object not found|not found/i.test(error.message);
}

function toAppUser(user: User): AppUser {
	return {
		$id: user.id,
		name: typeof user.user_metadata.full_name === 'string' ? user.user_metadata.full_name : user.email ?? 'Family member',
		email: user.email ?? '',
	};
}

function toProfile(profile: ProfileRow): ProfileDocument {
	return {
		$id: profile.id,
		name: profile.name,
		avatarFileId: profile.avatar_file_path ?? undefined,
		bio: profile.bio ?? undefined,
		birthYear: profile.birth_year ?? undefined,
		userId: profile.user_id ?? undefined,
		birthDate: profile.birth_date ?? undefined,
	};
}

function toComment(comment: CommentRow): CommentDocument {
	return {
		$id: comment.id,
		photoId: comment.photo_id,
		authorId: comment.author_id,
		authorName: comment.author_name,
		content: comment.content,
		createdAt: comment.created_at,
	};
}

export default function FamilyApp({ view = 'feed', personId, collectionId }: FamilyAppProps) {
	const [status, setStatus] = useState<AppStatus>('loading');
	const [user, setUser] = useState<AppUser | null>(null);
	const [isAdmin, setIsAdmin] = useState(false);
	const [families, setFamilies] = useState<FamilyRow[]>([]);
	const [activeFamilyId, setActiveFamilyId] = useState('');
	const [error, setError] = useState('');
	const [loadWarning, setLoadWarning] = useState('');
	const [authNotice, setAuthNotice] = useState('');
	const [profiles, setProfiles] = useState<ProfileDocument[]>([]);
	const [photos, setPhotos] = useState<PhotoDocument[]>([]);
	const [selectedPhoto, setSelectedPhoto] = useState<PhotoDocument | null>(null);
	const [yearFilter, setYearFilter] = useState('all');
	const [personFilter, setPersonFilter] = useState<string[]>([]);
	const [showUpload, setShowUpload] = useState(false);
	const [showCreateProfile, setShowCreateProfile] = useState(false);
	const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');

	const loadFamilyData = useCallback(async () => {
		const supabase = createSupabaseClient();
		const [profileResult, photoResult] = await Promise.all([
			supabase.from('profiles').select('*').order('name').limit(100),
			supabase.rpc('get_photos_with_resolved_country'),
		]);
		if (profileResult.error) throw profileResult.error;
		if (photoResult.error) throw photoResult.error;

		let missingStorageObjects = 0;
		const [photoDocuments, profileDocuments] = await Promise.all([
			Promise.all(photoResult.data.map(async (photo): Promise<PhotoDocument | null> => {
				const { data, error: signedUrlError } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(photo.file_path, 60 * 60);
				if (signedUrlError) {
					if (isMissingStorageObject(signedUrlError)) {
						missingStorageObjects += 1;
						return null;
					}
					throw signedUrlError;
				}
				return {
					$id: photo.id,
					title: photo.title ?? undefined,
					fileId: photo.file_path,
					year: photo.year,
					uploadedBy: photo.uploaded_by,
					taggedProfiles: photo.tagged_profiles,
					countryCode: normalizeCountryCode(photo.country_code) ?? undefined,
					imageUrl: data.signedUrl,
				};
			})),
			Promise.all(profileResult.data.map(async (profile) => {
				const document = toProfile(profile);
				if (document.avatarFileId) {
					const { data, error: avatarError } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(
						document.avatarFileId,
						60 * 60,
					);
					if (avatarError) {
						if (!isMissingStorageObject(avatarError)) throw avatarError;
						missingStorageObjects += 1;
					} else {
						document.avatarUrl = data.signedUrl;
					}
				}
				return document;
			})),
		]);

		setProfiles(profileDocuments);
		setPhotos(photoDocuments.filter((photo): photo is PhotoDocument => photo !== null));
		setLoadWarning(missingStorageObjects > 0
			? 'Some images could not be read from Supabase Storage. The album is open, but affected photos are hidden and missing profile pictures use initials. Check that this project has run migration 20261023000000_profile_avatar_storage_read.sql, then verify the local .env points to the expected Supabase project.'
			: '');
	}, []);

	const checkMembership = useCallback(async (activeUser: AppUser) => {
		const supabase = createSupabaseClient();
		const invitationToken = new URLSearchParams(window.location.search).get('invite');
		if (invitationToken) {
			const { error: invitationError } = await supabase.rpc('accept_family_invitation', { p_token: invitationToken });
			if (invitationError) throw invitationError;
			window.history.replaceState({}, '', window.location.pathname);
		}
		const { data: memberships, error: membershipError } = await supabase
			.from('family_members')
			.select('family_id, user_id, full_name, role, created_at')
			.eq('user_id', activeUser.$id)
			.order('created_at');
		if (membershipError) throw membershipError;
		setUser(activeUser);
		if (!memberships.length) {
			setFamilies([]);
			setActiveFamilyId('');
			setIsAdmin(false);
			setStatus('pending');
			return;
		}
		const familyIds = memberships.map((membership) => membership.family_id);
		const { data: familyRows, error: familiesError } = await supabase
			.from('families')
			.select('*')
			.in('id', familyIds)
			.order('created_at');
		if (familiesError) throw familiesError;
		const { data: currentFamily, error: currentFamilyError } = await supabase.rpc('current_family_id');
		if (currentFamilyError) throw currentFamilyError;
		const nextFamilyId = typeof currentFamily === 'string' && familyIds.includes(currentFamily)
			? currentFamily
			: familyIds[0];
		if (nextFamilyId !== currentFamily) {
			const { error: switchError } = await supabase.rpc('switch_family', { p_family_id: nextFamilyId });
			if (switchError) throw switchError;
		}
		const membership = memberships.find((item) => item.family_id === nextFamilyId);
		setFamilies(familyRows);
		setActiveFamilyId(nextFamilyId);
		setIsAdmin(membership?.role === 'admin');
		await loadFamilyData();
		setStatus('ready');
	}, [loadFamilyData]);

	const switchFamily = useCallback(async (familyId: string) => {
		if (familyId === activeFamilyId) return;
		const { error: switchError } = await createSupabaseClient().rpc('switch_family', { p_family_id: familyId });
		if (switchError) {
			setError(getMessage(switchError));
			return;
		}
		setActiveFamilyId(familyId);
		setProfiles([]);
		setPhotos([]);
		setSelectedPhoto(null);
		setStatus('loading');
		try {
			await loadFamilyData();
			setIsAdmin(false);
			const { data: membership } = await createSupabaseClient()
				.from('family_members')
				.select('role')
				.eq('user_id', user?.$id ?? '')
				.eq('family_id', familyId)
				.maybeSingle();
			setIsAdmin(membership?.role === 'admin');
			setStatus('ready');
		} catch (loadError) {
			setError(getMessage(loadError));
			setStatus('error');
		}
	}, [activeFamilyId, loadFamilyData, user?.$id]);

	useEffect(() => {
		async function restoreSession() {
			try {
				const configResponse = await fetch('/api/runtime-config', { cache: 'no-store' });
				const config = await configResponse.json() as {
					configured?: boolean;
					url?: string;
					publishableKey?: string;
				};
				if (configResponse.status === 503 && config.configured === false) {
					setStatus('setup');
					return;
				}
				if (!configResponse.ok) {
					throw new Error(`Could not load app configuration (HTTP ${configResponse.status}).`);
				}
				if (!config.url || !config.publishableKey) {
					throw new Error('The app configuration response is missing the Supabase URL or publishable key.');
				}
				configureSupabaseClient({ url: config.url, publishableKey: config.publishableKey });

				const supabase = createSupabaseClient();
				const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
				if (sessionError) throw sessionError;
				if (!sessionData.session) {
					setError('');
					setStatus('signedOut');
					return;
				}

				const { data, error: authError } = await supabase.auth.getUser();
				if (authError) throw authError;
				if (!data.user) {
					setError('');
					setStatus('signedOut');
					return;
				}
				await checkMembership(toAppUser(data.user));
			} catch (authError) {
				setError(getMessage(authError));
				setStatus('error');
			}
		}
		void restoreSession();
	}, [checkMembership]);

	useEffect(() => {
		function closeMenus(event: PointerEvent | KeyboardEvent) {
			if (event instanceof KeyboardEvent && event.key !== 'Escape') return;
			const activeMenu = event instanceof PointerEvent && event.target instanceof Element
				? event.target.closest('.person-filter')
				: null;
			document.querySelectorAll<HTMLDetailsElement>('.person-filter[open]').forEach((menu) => {
				if (!activeMenu || !activeMenu.contains(menu)) menu.open = false;
			});
		}
		document.addEventListener('pointerdown', closeMenus);
		document.addEventListener('keydown', closeMenus);
		return () => {
			document.removeEventListener('pointerdown', closeMenus);
			document.removeEventListener('keydown', closeMenus);
		};
	}, []);

	const years = useMemo(
		() => [...new Set(photos.map((photo) => photo.year))].sort((a, b) => b - a),
		[photos],
	);
	const filteredPhotos = useMemo(() => photos.filter((photo) => {
		const matchesYear = yearFilter === 'all' || photo.year === Number(yearFilter);
		const matchesPeople = personFilter.length === 0 || personFilter.some((id) => photo.taggedProfiles.includes(id));
		return matchesYear && matchesPeople;
	}), [photos, personFilter, yearFilter]);
	const selectedPerson = profiles.find((profile) => profile.$id === personId);
	const taggedPhotos = photos.filter((photo) => photo.taggedProfiles.includes(personId ?? ''));

	async function submitAuth(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError('');
		const data = new FormData(event.currentTarget);
		const email = String(data.get('email') ?? '').trim();
		const password = String(data.get('password') ?? '');
		const name = String(data.get('name') ?? '').trim();
		try {
			const supabase = createSupabaseClient();
			if (authMode === 'signup') {
				const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
					email,
					password,
					options: {
						data: { full_name: name },
						emailRedirectTo: window.location.origin,
					},
				});
				if (signUpError) throw signUpError;
				if (!signUpData.user) throw new Error('Supabase did not return the new account. Please try signing up again.');
				if (!signUpData.session) {
					setAuthNotice('Account created. Check your email to confirm your address, then sign in here.');
					setAuthMode('login');
					return;
				}
				await checkMembership(toAppUser(signUpData.user));
				return;
			}
			const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
			if (signInError) throw signInError;
			await checkMembership(toAppUser(signInData.user));
		} catch (authError) {
			setError(getMessage(authError));
		}
	}

	async function signOut() {
		try {
			const { error: signOutError } = await createSupabaseClient().auth.signOut();
			if (signOutError) throw signOutError;
			setUser(null);
			setStatus('signedOut');
		} catch (signOutError) {
			setError(getMessage(signOutError));
		}
	}

	const pageTitle = view === 'tree' ? 'Our family tree' : view === 'person' ? selectedPerson?.name ?? 'Family member' : view === 'collections' ? 'Family photobooks' : view === 'bounties' ? 'Memory bounties' : view === 'map' ? 'Memory map' : view === 'settings' ? 'General settings' : view === 'messenger' ? 'Messages' : 'The family album';

	if (status === 'loading') {
		return <main className="screen-state"><img className="loading-logo" src="/logo.svg" alt="" /><p className="loading-message">Gathering your family memories…</p></main>;
	}

	if (status === 'setup') {
		return (
			<main className="setup-screen">
				<div className="setup-card">
					<a className="brand" href="/"><img className="brand-mark-image" src="/logo.svg" alt="" /><span>kinfolk</span></a>
					<div className="eyebrow">A little place for your people</div>
					<h1>Your family stories<br />belong together.</h1>
					<p className="setup-copy">Connect this app to your private Supabase project to open your family album.</p>
					<div className="setup-instructions">
						<strong>One quick setup step</strong>
						<span>Set <code>PUBLIC_SUPABASE_URL</code> and <code>PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> in this app's runtime environment.</span>
					</div>
					<a className="text-link" href="https://supabase.com/docs/guides/getting-started" target="_blank" rel="noreferrer">Read the Supabase setup guide <AppIcon name="arrow" size={16} /></a>
				</div>
			</main>
		);
	}

	if (status === 'signedOut') {
		return (
			<main className="auth-screen">
				<section className="auth-story">
					<a className="brand brand-light" href="/"><img className="brand-mark-image" src="/logo.svg" alt="" /><span>kinfolk</span></a>
					<div className="story-content">
						<div className="eyebrow eyebrow-light">A little place for your people</div>
						<h1>Every family<br />has a story.</h1>
						<p>Keep the little moments, the big milestones, and all the people who make it yours.</p>
						<div className="story-photo" role="img" aria-label="Family gathered outdoors">
							<div className="photo-caption"><span>THE GOOD OLD DAYS</span><b>Memories, made together.</b></div>
						</div>
						<div className="photo-credit">A private album for your favourite people</div>
					</div>
					<span className="auth-decoration">✳</span>
				</section>
				<section className="auth-form-panel">
					<div className="auth-form-wrap">
						<div className="mobile-brand"><a className="brand" href="/"><img className="brand-mark-image" src="/logo.svg" alt="" /><span>kinfolk</span></a></div>
						<div className="eyebrow">{authMode === 'login' ? 'Welcome back' : 'You belong here'}</div>
						<h2>{authMode === 'login' ? 'Come on in.' : 'Join your family.'}</h2>
						<p className="muted">{authMode === 'login' ? 'Sign in to see what everyone has been up to.' : 'Create an account to request access to the family album.'}</p>
						<form className="auth-form" onSubmit={submitAuth}>
							{authMode === 'signup' && <label>Your name<input name="name" autoComplete="name" required placeholder="How should we call you?" /></label>}
							<label>Email address<input name="email" type="email" autoComplete="email" required placeholder="you@example.com" /></label>
							<label>Password<input name="password" type="password" autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} minLength={8} required placeholder="At least 8 characters" /></label>
							{error && <p className="form-error" role="alert">{error}</p>}
							{authNotice && <p className="auth-notice" role="status">{authNotice}</p>}
							<button className="button button-primary button-wide" type="submit">{authMode === 'login' ? 'Sign in to your album' : 'Create account'} <AppIcon name="arrow" size={17} /></button>
						</form>
						<p className="auth-switch">
							{authMode === 'login' ? 'New to the family album?' : 'Already have an account?'}
							<button type="button" onClick={() => { setError(''); setAuthNotice(''); setAuthMode(authMode === 'login' ? 'signup' : 'login'); }}>
								{authMode === 'login' ? 'Create an account' : 'Sign in'}
							</button>
						</p>
						<div className="private-note"><AppIcon name="lock" size={15} /> Just for your family. Always.</div>
					</div>
				</section>
			</main>
		);
	}

	if (status === 'pending') {
		return (
			<main className="screen-state">
				<a className="brand" href="/"><img className="brand-mark-image" src="/logo.svg" alt="" /><span>kinfolk</span></a>
				<div className="pending-icon"><AppIcon name="lock" size={25} /></div>
				<div className="eyebrow">Almost there</div>
				<h1>Make a place for your people.</h1>
				<p className="muted">Your account is ready{user?.name ? `, ${user.name.split(' ')[0]}` : ''}. Create a family space, or ask an existing family admin to invite you.</p>
				<FamilyCreationPanel onCreated={async () => {
					if (user) await checkMembership(user);
				}} />
				<button className="button button-quiet" onClick={signOut}><AppIcon name="logout" size={17} /> Sign out</button>
			</main>
		);
	}

	if (status === 'error') {
		return (
			<main className="screen-state">
				<a className="brand" href="/"><img className="brand-mark-image" src="/logo.svg" alt="" /><span>kinfolk</span></a>
				<div className="eyebrow">We hit a little snag</div>
				<h1>Couldn’t open<br />the family album.</h1>
				<p className="form-error" role="alert">{error}</p>
				<button className="button button-primary" onClick={() => window.location.reload()}>Try again</button>
			</main>
		);
	}

	return (
		<div className="app-shell">
			<aside className="sidebar">
				<a className="brand" href="/"><img className="brand-mark-image" src="/logo.svg" alt="" /><span>kinfolk</span></a>
				<FamilySwitcher families={families} activeFamilyId={activeFamilyId} onSwitch={(familyId) => void switchFamily(familyId)} />
				<div className="sidebar-section-label">YOUR SPACE</div>
				<nav className="side-nav" aria-label="Main navigation">
					<a href="/" className={`nav-link ${view === 'feed' ? 'active' : ''}`} aria-current={view === 'feed' ? 'page' : undefined}><AppIcon name="home" /> Family album</a>
					<a href="/tree" className={`nav-link ${view === 'tree' ? 'active' : ''}`} aria-current={view === 'tree' ? 'page' : undefined}><AppIcon name="tree" /> Family tree</a>
					<a href="/collections" className={`nav-link ${view === 'collections' ? 'active' : ''}`} aria-current={view === 'collections' ? 'page' : undefined}><AppIcon name="book" /> Photobooks</a>
					<a href="/map" className={`nav-link ${view === 'map' ? 'active' : ''}`} aria-current={view === 'map' ? 'page' : undefined}><AppIcon name="search" /> Memory map</a>
					<a href="/bounties" className={`nav-link ${view === 'bounties' ? 'active' : ''}`} aria-current={view === 'bounties' ? 'page' : undefined}><AppIcon name="bullseye" /> Memory bounties</a>
					<a href="/messenger" className={`nav-link ${view === 'messenger' ? 'active' : ''}`} aria-current={view === 'messenger' ? 'page' : undefined}><AppIcon name="bubble" /> Messages</a>
					<a href="/settings" className={`nav-link nav-link-secondary ${view === 'settings' ? 'active' : ''}`} aria-current={view === 'settings' ? 'page' : undefined}><AppIcon name="settings" size={17} /> General settings</a>
				</nav>
				<div className="sidebar-family">
					<div className="sidebar-section-label">IN THE ALBUM <span>{profiles.length}</span></div>
					<div className="family-mini-list">
						{profiles.slice(0, 7).map((profile, index) => (
							<a href={`/person/${profile.$id}`} className="family-mini" key={profile.$id}>
								{profile.avatarUrl
									? <img className="avatar family-mini-avatar" src={profile.avatarUrl} alt="" loading="lazy" />
									: <span className={`avatar avatar-${index % 5}`}>{initials(profile.name)}</span>}
								<span>{profile.name}</span>
							</a>
						))}
					</div>
				</div>
				<div className="sidebar-bottom">
					<div className="privacy-card"><AppIcon name="lock" size={16} /><span><b>Your own little corner</b><small>Only family members can see this album.</small></span></div>
					<button className="account-row" onClick={signOut}><span className="avatar avatar-user">{initials(user?.name || user?.email || 'F')}</span><span className="account-copy"><b>{user?.name || 'Family member'}</b><small>{user?.email}</small></span><AppIcon name="logout" size={17} /></button>
				</div>
			</aside>

			<nav className="mobile-nav" aria-label="Mobile navigation">
				<a href="/" className={view === 'feed' ? 'active' : ''} aria-current={view === 'feed' ? 'page' : undefined}><AppIcon name="home" size={19} /><span>Album</span></a>
				<a href="/tree" className={view === 'tree' ? 'active' : ''} aria-current={view === 'tree' ? 'page' : undefined}><AppIcon name="tree" size={19} /><span>Family tree</span></a>
				<a href="/collections" className={view === 'collections' ? 'active' : ''} aria-current={view === 'collections' ? 'page' : undefined}><AppIcon name="book" size={19} /><span>Photobooks</span></a>
				<a href="/map" className={view === 'map' ? 'active' : ''} aria-current={view === 'map' ? 'page' : undefined}><AppIcon name="search" size={19} /><span>Map</span></a>
				<a href="/bounties" className={view === 'bounties' ? 'active' : ''} aria-current={view === 'bounties' ? 'page' : undefined}><AppIcon name="bullseye" size={19} /><span>Bounties</span></a>
				<a href="/messenger" className={view === 'messenger' ? 'active' : ''} aria-current={view === 'messenger' ? 'page' : undefined}><AppIcon name="bubble" size={19} /><span>Messages</span></a>
				<a href="/settings" className={view === 'settings' ? 'active' : ''} aria-current={view === 'settings' ? 'page' : undefined}><AppIcon name="settings" size={19} /><span>Settings</span></a>
				<button type="button" onClick={signOut} aria-label={`Sign out${user?.name ? ` of ${user.name}` : ''}`}><AppIcon name="logout" size={19} /><span>Sign out</span></button>
			</nav>

			<main className="main-content">
				<header className="topbar">
					<div className="breadcrumb"><span>YOUR SPACE</span><span className="breadcrumb-divider">/</span><b>{pageTitle.toUpperCase()}</b></div>
					<div className="topbar-actions">
						<FamilySwitcher families={families} activeFamilyId={activeFamilyId} onSwitch={(familyId) => void switchFamily(familyId)} />
						<div className="member-count"><span className="online-dot" /> {profiles.length} family members</div>
						<button className="button button-primary button-small" onClick={() => setShowUpload(true)}><AppIcon name="plus" size={17} /> Add a memory</button>
					</div>
				</header>
				{loadWarning && <p className="load-warning" role="status">{loadWarning}</p>}

				{view === 'messenger' ? (
					<Messenger userId={user?.$id ?? ''} familyId={activeFamilyId} photos={photos} onOpenPhoto={setSelectedPhoto} />
				) : view === 'bounties' ? (
					<BountyFeed photos={photos} userId={user?.$id ?? ''} familyId={activeFamilyId} isAdmin={isAdmin} />
				) : view === 'map' ? (
					<KinfolkWorldMap />
				) : view === 'settings' ? (
					<section className="page-body">
						<div className="page-heading">
							<div><div className="eyebrow">Make Kinfolk feel like yours</div><h1>General settings</h1><p className="muted">Manage your family album preferences.</p></div>
						</div>
						<FamilyManagement familyId={activeFamilyId} isAdmin={isAdmin} />
						{isAdmin && <ClaimRequestsPanel familyId={activeFamilyId} profiles={profiles} onReviewed={loadFamilyData} />}
						{isAdmin && <ReportReviewPanel familyId={activeFamilyId} />}
						<section className="family-management">
							<div className="eyebrow">Another space</div>
							<h2>Create a new family</h2>
							<p className="muted">Start a separate family album. You will become its administrator and can invite members afterward.</p>
							<FamilyCreationPanel onCreated={async (familyId) => {
								if (user) await checkMembership(user);
								await switchFamily(familyId);
							}} />
						</section>
						<LocationSettings />
					</section>
				) : view === 'collections' ? (
					<CollectionsPanel collectionId={collectionId} familyId={activeFamilyId} profiles={profiles} photos={photos} onOpenPhoto={setSelectedPhoto} onPhotoAdded={loadFamilyData} />
				) : view === 'tree' ? (
					<section className="page-body">
						<div className="page-heading">
							<div><div className="eyebrow">Roots, branches & everything in between</div><h1>Our family tree</h1><p className="muted">A little map of the people who make us, us.</p></div>
							<div className="tree-heading-actions">
								<span className="heading-count">{profiles.length} PEOPLE</span>
								<button className="button button-quiet button-small" onClick={() => setShowCreateProfile(true)}><AppIcon name="plus" size={16} /> Add person</button>
							</div>
						</div>
						{profiles.length ? <FamilyTreeCanvas profiles={profiles} /> : <EmptyState title="Your tree is ready to grow" body="Add a person profile with or without a photo, then connect your family." />}
					</section>
				) : view === 'person' ? (
					<section className="page-body">
						{selectedPerson ? (
							<>
								<a className="back-link" href="/tree">← Back to family tree</a>
								<div className="person-profile">
									{selectedPerson.avatarUrl
										? <img className="avatar avatar-large person-avatar-image" src={selectedPerson.avatarUrl} alt="" />
										: <span className="avatar avatar-large">{initials(selectedPerson.name)}</span>}
									<div><div className="eyebrow">A member of the family</div><h1>{selectedPerson.name}</h1><p className="muted">{formatBirthDate(selectedPerson.birthDate) || (selectedPerson.birthYear ? `Born ${selectedPerson.birthYear}` : '')}{formatBirthDate(selectedPerson.birthDate) || selectedPerson.birthYear ? ' · ' : ''}{taggedPhotos.length} {taggedPhotos.length === 1 ? 'memory' : 'memories'} together</p></div>
								</div>
								<ProfileBio profile={selectedPerson} userId={user?.$id ?? ''} />
								<ProfileActions
									profile={selectedPerson}
									photos={photos}
									userId={user?.$id ?? ''}
									familyId={activeFamilyId}
									isAdmin={isAdmin}
									alreadyLinked={profiles.some((profile) => profile.userId === user?.$id)}
									onUpdated={loadFamilyData}
									onDeleted={() => window.location.assign('/tree')}
								/>
								<PhotoGrid photos={taggedPhotos} profiles={profiles} onOpen={setSelectedPhoto} />
							</>
						) : <EmptyState title="We can’t find that family member" body="They may not have been added to the family tree yet." />}
					</section>
				) : (
					<section className="page-body">
						<div className="welcome-banner">
							<div className="welcome-copy"><div className="eyebrow">A little hello to the whole family</div><h1>Good things are<br />better shared.</h1><p>All your favourite people, and the moments that make you one big story.</p><div className="welcome-people">{profiles.slice(0, 5).map((profile, index) => <a key={profile.$id} href={`/person/${profile.$id}`} className={`avatar avatar-${index % 5} welcome-person-avatar`} title={profile.name}>{profile.avatarUrl ? <img src={profile.avatarUrl} alt={profile.name} loading="lazy" /> : initials(profile.name)}</a>)}<a href="/tree" className="people-more">See your family <AppIcon name="arrow" size={14} /></a></div></div>
							<div className="welcome-art" aria-hidden="true"><span className="sun-shape" /><span className="art-leaf leaf-one" /><span className="art-leaf leaf-two" /><span className="art-pot" /><span className="art-flower">✳</span></div>
							<span className="banner-note">MADE OF LITTLE MOMENTS</span>
						</div>
						<div className="feed-header">
							<div><div className="eyebrow">Collected together</div><h2>Recent memories</h2></div>
							<div className="feed-filters">
								<label className="filter-select"><span className="sr-only">Filter memories by year</span><select value={yearFilter} onChange={(event) => setYearFilter(event.target.value)}><option value="all">Every year</option>{years.map((year) => <option value={year} key={year}>{year}</option>)}</select></label>
								<details className="person-filter"><summary><AppIcon name="search" size={16} /> {personFilter.length ? `${personFilter.length} people` : 'Everyone'} <span aria-hidden="true">⌄</span></summary><div className="filter-popover">{profiles.map((profile) => <label key={profile.$id}><input type="checkbox" checked={personFilter.includes(profile.$id)} onChange={() => setPersonFilter((current) => current.includes(profile.$id) ? current.filter((id) => id !== profile.$id) : [...current, profile.$id])} />{profile.name}</label>)}</div></details>
								{personFilter.length > 0 && <button className="text-link" type="button" onClick={() => setPersonFilter([])}>Clear people filter</button>}
							</div>
						</div>
						{filteredPhotos.length ? <PhotoGrid photos={filteredPhotos} profiles={profiles} onOpen={setSelectedPhoto} /> : <EmptyState title="The best memories are still to come" body="Add the first photo to start filling this family album." action={<button className="button button-primary" onClick={() => setShowUpload(true)}><AppIcon name="plus" size={17} /> Add a memory</button>} />}
					</section>
				)}
			</main>

			{showUpload && <UploadDialog profiles={profiles} familyId={activeFamilyId} onClose={() => setShowUpload(false)} onCreated={async () => { await loadFamilyData(); setShowUpload(false); }} />}
			{showCreateProfile && <CreatePersonDialog onClose={() => setShowCreateProfile(false)} onCreated={(profileId) => {
				window.location.assign(`/person/${profileId}`);
			}} />}
			{selectedPhoto && <PhotoDialog photo={selectedPhoto} profiles={profiles} user={user} onClose={() => setSelectedPhoto(null)} onDeleted={(photoId) => {
				setPhotos((current) => current.filter((photo) => photo.$id !== photoId));
				setSelectedPhoto((current) => current?.$id === photoId ? null : current);
			}} />}
		</div>
	);
}

function CreatePersonDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (profileId: string) => void }) {
	const [name, setName] = useState('');
	const [birthDate, setBirthDate] = useState('');
	const [error, setError] = useState('');
	const [saving, setSaving] = useState(false);

	async function createProfile(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const profileName = name.trim();
		if (!profileName) {
			setError('Enter a name for this person.');
			return;
		}

		setSaving(true);
		setError('');
		try {
			const { data, error: profileError } = await createSupabaseClient()
				.from('profiles')
				.insert({ name: profileName, birth_date: birthDate || null })
				.select('id')
				.single();
			if (profileError) throw profileError;
			onCreated(data.id);
		} catch (profileError) {
			setError(getMessage(profileError));
			setSaving(false);
		}
	}

	return (
		<div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
			<section className="modal-card upload-modal" role="dialog" aria-modal="true" aria-labelledby="create-person-title">
				<div className="modal-header">
					<div><div className="eyebrow">A new branch in the family</div><h2 id="create-person-title">Create a person profile</h2></div>
					<button className="icon-button" type="button" onClick={onClose} aria-label="Close" disabled={saving}><AppIcon name="close" size={17} /></button>
				</div>
				<p className="muted">No photo is needed. If this is your profile, you can request to claim it next; a family admin will review the request.</p>
				<form className="upload-form" onSubmit={(event) => void createProfile(event)}>
					<label>Person’s name<input autoFocus value={name} onChange={(event) => setName(event.target.value)} maxLength={120} required /></label>
					<label>Birth date (optional)<input type="date" max={new Date().toISOString().slice(0, 10)} value={birthDate} onChange={(event) => setBirthDate(event.target.value)} /></label>
					{error && <p className="form-error" role="alert">{error}</p>}
					<div className="modal-actions">
						<button className="button button-quiet" type="button" onClick={onClose} disabled={saving}>Cancel</button>
						<button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Creating…' : 'Create profile'}</button>
					</div>
				</form>
			</section>
		</div>
	);
}

function ProfileBio({ profile, userId }: { profile: ProfileDocument; userId: string }) {
	const [bio, setBio] = useState(profile.bio ?? '');
	const [editing, setEditing] = useState(false);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState('');
	const [notice, setNotice] = useState('');
	const canEdit = Boolean(profile.userId && profile.userId === userId);

	async function saveBio(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setSaving(true);
		setError('');
		setNotice('');
		try {
			const { error: saveError } = await createSupabaseClient().rpc('update_my_profile_bio', {
				p_bio: bio.trim() || null,
			});
			if (saveError) throw saveError;
			setBio(bio.trim());
			setEditing(false);
			setNotice('Your bio is saved.');
		} catch (saveError) {
			setError(getMessage(saveError));
		} finally {
			setSaving(false);
		}
	}

	return (
		<section className="profile-bio" aria-label={`${profile.name} bio`}>
			<div className="profile-bio-heading"><h2>About {profile.name}</h2>{canEdit && !editing && <button className="text-link" type="button" onClick={() => { setBio(profile.bio ?? ''); setEditing(true); }}>{bio ? 'Edit bio' : 'Add a bio'}</button>}</div>
			{editing ? (
				<form className="profile-bio-form" onSubmit={(event) => void saveBio(event)}>
					<label htmlFor="profile-bio-input">A little about yourself</label>
					<textarea id="profile-bio-input" value={bio} onChange={(event) => setBio(event.target.value)} maxLength={1000} rows={4} placeholder="Share a few words about yourself with your family…" />
					<small>{bio.length}/1000</small>
					{error && <p className="form-error" role="alert">{error}</p>}
					<div className="profile-bio-actions">
						<button className="button button-quiet button-small" type="button" onClick={() => { setBio(profile.bio ?? ''); setEditing(false); }} disabled={saving}>Cancel</button>
						<button className="button button-primary button-small" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save bio'}</button>
					</div>
				</form>
			) : (
				<p className="muted">{bio || (canEdit ? 'Add a little introduction for your family.' : 'No bio shared yet.')}</p>
			)}
			{notice && <p className="form-notice" role="status">{notice}</p>}
		</section>
	);
}

function ProfileActions({ profile, photos, userId, familyId, isAdmin, alreadyLinked, onUpdated, onDeleted }: {
	profile: ProfileDocument;
	photos: PhotoDocument[];
	userId: string;
	familyId: string;
	isAdmin: boolean;
	alreadyLinked: boolean;
	onUpdated: () => Promise<void>;
	onDeleted: () => void;
}) {
	const [claimStatus, setClaimStatus] = useState<ProfileClaimRequestRow['status'] | null>(null);
	const [selectedPhotoId, setSelectedPhotoId] = useState('');
	const [avatarFile, setAvatarFile] = useState<File | null>(null);
	const [avatarFilePreview, setAvatarFilePreview] = useState('');
	const [cropX, setCropX] = useState(50);
	const [cropY, setCropY] = useState(50);
	const [cropZoom, setCropZoom] = useState(1);
	const [error, setError] = useState('');
	const [saving, setSaving] = useState(false);
	const [notice, setNotice] = useState('');
	const eligiblePhotos = photos.filter((photo) => photo.uploadedBy === userId && photo.taggedProfiles.includes(profile.$id));
	const selectedPhoto = eligiblePhotos.find((photo) => photo.$id === selectedPhotoId);
	const avatarPreview = avatarFilePreview || selectedPhoto?.imageUrl || '';
	const canManageProfile = isAdmin || profile.userId === userId;

	useEffect(() => {
		if (!avatarFile) {
			setAvatarFilePreview('');
			return;
		}
		const previewUrl = URL.createObjectURL(avatarFile);
		setAvatarFilePreview(previewUrl);
		return () => URL.revokeObjectURL(previewUrl);
	}, [avatarFile]);

	useEffect(() => {
		let cancelled = false;
		async function loadClaimStatus() {
			if (!userId || profile.userId) return;
			const { data, error: claimError } = await createSupabaseClient()
				.from('profile_claim_requests')
				.select('status')
				.eq('profile_id', profile.$id)
				.eq('claimant_id', userId)
				.order('created_at', { ascending: false })
				.limit(1);
			if (claimError) {
				if (!cancelled) setError(getMessage(claimError));
				return;
			}
			if (!cancelled) setClaimStatus(data[0]?.status ?? null);
		}
		void loadClaimStatus();
		return () => { cancelled = true; };
	}, [profile.$id, profile.userId, userId]);

	async function requestClaim() {
		setSaving(true);
		setError('');
		try {
			const { error: requestError } = await createSupabaseClient().rpc('request_profile_claim', {
				p_profile_id: profile.$id,
			});
			if (requestError) throw requestError;
			setClaimStatus('pending');
		} catch (requestError) {
			setError(getMessage(requestError));
		} finally {
			setSaving(false);
		}
	}

	async function setAvatar() {
		const photo = eligiblePhotos.find((item) => item.$id === selectedPhotoId);
		if ((!photo && !avatarFile) || !userId) return;
		setSaving(true);
		setError('');
		let previewUrl: string | undefined;
		let avatarPath: string | undefined;
		try {
			const supabase = createSupabaseClient();
			let source: Blob;
			if (avatarFile) {
				source = avatarFile;
			} else {
				const { data, error: sourceError } = await supabase.storage.from(PHOTO_BUCKET).download(photo!.fileId);
				if (sourceError) throw sourceError;
				source = data;
			}
			previewUrl = URL.createObjectURL(source);

			const image = new Image();
			image.src = previewUrl;
			await new Promise<void>((resolve, reject) => {
				image.onload = () => resolve();
				image.onerror = () => reject(new Error('Could not open this photo for cropping.'));
			});
			const side = Math.min(image.naturalWidth, image.naturalHeight) / cropZoom;
			if (!side) throw new Error('This image has no usable dimensions.');
			const sourceX = (image.naturalWidth - side) * cropX / 100;
			const sourceY = (image.naturalHeight - side) * cropY / 100;
			const canvas = document.createElement('canvas');
			canvas.width = 256;
			canvas.height = 256;
			const context = canvas.getContext('2d');
			if (!context) throw new Error('Your browser could not prepare the cropped avatar.');
			context.drawImage(
				image,
				sourceX,
				sourceY,
				side,
				side,
				0,
				0,
				256,
				256,
			);
			const blob = await new Promise<Blob>((resolve, reject) => {
				canvas.toBlob((result) => result ? resolve(result) : reject(new Error('Could not encode the cropped avatar.')), 'image/webp', 0.82);
			});
			avatarPath = `families/${familyId}/profile-avatars/${userId}/${createUuid()}.webp`;
			const { error: uploadError } = await supabase.storage.from(PHOTO_BUCKET).upload(avatarPath, blob, {
				contentType: 'image/webp',
				upsert: false,
			});
			if (uploadError) throw uploadError;

			const { error: updateError } = await supabase.rpc('set_profile_avatar', {
				p_profile_id: profile.$id,
				p_source_photo_id: avatarFile ? null : photo!.$id,
				p_avatar_path: avatarPath,
			});
			if (updateError) {
				const { error: cleanupError } = await supabase.storage.from(PHOTO_BUCKET).remove([avatarPath]);
				if (cleanupError) throw new Error(`${updateError.message} The unused avatar file could not be removed (${cleanupError.message}).`);
				throw updateError;
			}
			await onUpdated();
			setNotice('Profile picture updated.');
		} catch (avatarError) {
			setError(getMessage(avatarError));
		} finally {
			if (previewUrl) URL.revokeObjectURL(previewUrl);
			setSaving(false);
		}
	}

	async function removeAvatar() {
		if (!window.confirm(`Remove ${profile.name}’s profile picture?`)) return;
		setSaving(true);
		setError('');
		setNotice('');
		try {
			const { data: avatarPath, error: clearError } = await createSupabaseClient()
				.rpc('clear_profile_avatar', { p_profile_id: profile.$id });
			if (clearError) throw clearError;
			if (avatarPath && avatarPath.startsWith(`${userId}/`)) {
				const { error: removeError } = await createSupabaseClient().storage.from(PHOTO_BUCKET).remove([avatarPath]);
				if (removeError) throw new Error(`The profile picture was removed, but its stored image could not be cleaned up: ${removeError.message}`);
			}
			await onUpdated();
			setNotice('Profile picture removed.');
		} catch (removeError) {
			setError(getMessage(removeError));
			await onUpdated();
		} finally {
			setSaving(false);
		}
	}

	async function deleteProfile() {
		if (!window.confirm(`Delete ${profile.name}’s profile? This removes them from the family tree and cannot be undone. Family photos they are tagged in will remain in the album.`)) return;
		setSaving(true);
		setError('');
		try {
			const { data, error: deleteError } = await createSupabaseClient()
				.from('profiles')
				.delete()
				.eq('id', profile.$id)
				.select('id');
			if (deleteError) throw deleteError;
			if (!data.length) throw new Error('You do not have permission to delete this profile.');
			if (profile.avatarFileId?.startsWith(`${userId}/`)) {
				const { error: removeError } = await createSupabaseClient().storage.from(PHOTO_BUCKET).remove([profile.avatarFileId]);
				if (removeError) window.alert(`The profile was deleted, but its stored picture could not be cleaned up: ${removeError.message}`);
			}
			onDeleted();
		} catch (deleteError) {
			setError(getMessage(deleteError));
			setSaving(false);
		}
	}

	return (
		<div className="profile-actions">
			{!profile.userId && !alreadyLinked && (
				<div className="claim-card">
					<div><strong>Is this you?</strong><p>A family admin will review your request before linking this profile to your account.</p></div>
					{claimStatus === 'pending'
						? <span className="claim-status">Request pending review</span>
						: claimStatus === 'approved'
							? <span className="claim-status">Claim approved</span>
							: <button className="button button-quiet" onClick={requestClaim} disabled={saving}>{saving ? 'Sending…' : 'Claim this profile'}</button>}
				</div>
			)}
			{eligiblePhotos.length > 0 && (
				<div className="avatar-picker">
					<label>Set a profile picture from a photo you shared
						<select value={selectedPhotoId} onChange={(event) => { setSelectedPhotoId(event.target.value); setAvatarFile(null); setCropX(50); setCropY(50); setCropZoom(1); }}>
							<option value="">Choose a tagged photo</option>
							{eligiblePhotos.map((photo) => <option key={photo.$id} value={photo.$id}>{photo.title || `Memory from ${photo.year}`}</option>)}
						</select>
					</label>
					{avatarPreview && <div className="avatar-crop-controls">
						<img
							src={avatarPreview}
							alt="Avatar crop preview"
							style={{ objectPosition: `${cropX}% ${cropY}%`, transform: `scale(${cropZoom})` }}
						/>
						<label>Horizontal crop <input type="range" min="0" max="100" value={cropX} onChange={(event) => setCropX(Number(event.target.value))} /></label>
						<label>Vertical crop <input type="range" min="0" max="100" value={cropY} onChange={(event) => setCropY(Number(event.target.value))} /></label>
						<label>Zoom <input type="range" min="1" max="3" step="0.1" value={cropZoom} onChange={(event) => setCropZoom(Number(event.target.value))} /></label>
					</div>}
				</div>
			)}
			<div className="avatar-picker">
				<label>Or upload a profile picture directly
					<input
						type="file"
						accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
						onChange={(event) => {
							const file = event.target.files?.[0] ?? null;
							if (file && !['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'].includes(file.type)) {
								setError('Choose a JPEG, PNG, WebP, GIF, or AVIF image.');
								event.target.value = '';
								return;
							}
							if (file && file.size > 50 * 1024 * 1024) {
								setError('Choose an image smaller than 50 MiB.');
								event.target.value = '';
								return;
							}
							setError('');
							setSelectedPhotoId('');
							setAvatarFile(file);
							setCropX(50);
							setCropY(50);
							setCropZoom(1);
						}}
					/>
				</label>
				{avatarFile && <div className="avatar-crop-controls">
					<img src={avatarFilePreview} alt="Avatar crop preview" style={{ objectPosition: `${cropX}% ${cropY}%`, transform: `scale(${cropZoom})` }} />
					<label>Horizontal crop <input type="range" min="0" max="100" value={cropX} onChange={(event) => setCropX(Number(event.target.value))} /></label>
					<label>Vertical crop <input type="range" min="0" max="100" value={cropY} onChange={(event) => setCropY(Number(event.target.value))} /></label>
					<label>Zoom <input type="range" min="1" max="3" step="0.1" value={cropZoom} onChange={(event) => setCropZoom(Number(event.target.value))} /></label>
				</div>}
				<button className="button button-quiet" onClick={() => void setAvatar()} disabled={(!selectedPhotoId && !avatarFile) || saving}>{saving ? 'Saving…' : 'Crop and set avatar'}</button>
				{profile.avatarFileId && canManageProfile && <button className="text-link profile-remove-avatar" type="button" onClick={() => void removeAvatar()} disabled={saving}>Remove current picture</button>}
			</div>
			{canManageProfile && <div className="profile-management">
				<p className="muted">{isAdmin && profile.userId !== userId ? 'As a family admin, you can remove this profile.' : 'Manage this person profile.'}</p>
				<button className="button button-danger button-small" type="button" onClick={() => void deleteProfile()} disabled={saving}>{saving ? 'Deleting…' : 'Delete profile'}</button>
			</div>}
			{notice && <p className="form-notice" role="status">{notice}</p>}
			{error && <p className="form-error" role="alert">{error}</p>}
		</div>
	);
}

function ClaimRequestsPanel({ familyId, profiles, onReviewed }: { familyId: string; profiles: ProfileDocument[]; onReviewed: () => Promise<void> }) {
	const [requests, setRequests] = useState<ProfileClaimRequestRow[]>([]);
	const [names, setNames] = useState<Record<string, string>>({});
	const [error, setError] = useState('');
	const [busyId, setBusyId] = useState('');

	useEffect(() => {
		let cancelled = false;
		async function loadRequests() {
			try {
				const supabase = createSupabaseClient();
				const { data, error: requestError } = await supabase
					.from('profile_claim_requests')
					.select('*')
					.eq('family_id', familyId)
					.eq('status', 'pending')
					.order('created_at');
				if (requestError) throw requestError;
				const claimantIds = [...new Set(data.map((request) => request.claimant_id))];
				const memberNames: Record<string, string> = {};
				if (claimantIds.length) {
					const { data: members, error: membersError } = await supabase
						.from('family_members')
						.select('user_id, full_name')
						.in('user_id', claimantIds);
					if (membersError) throw membersError;
					for (const member of members) memberNames[member.user_id] = member.full_name;
				}
				if (!cancelled) {
					setRequests(data);
					setNames(memberNames);
				}
			} catch (loadError) {
				if (!cancelled) setError(getMessage(loadError));
			}
		}
		void loadRequests();
		return () => { cancelled = true; };
	}, [familyId]);

	async function review(requestId: string, approve: boolean) {
		setBusyId(requestId);
		setError('');
		try {
			const { error: reviewError } = await createSupabaseClient().rpc('review_profile_claim', {
				p_request_id: requestId,
				p_approve: approve,
			});
			if (reviewError) throw reviewError;
			setRequests((current) => current.filter((request) => request.id !== requestId));
			await onReviewed();
		} catch (reviewError) {
			setError(getMessage(reviewError));
		} finally {
			setBusyId('');
		}
	}

	return (
		<section className="claim-review-panel">
			<div className="claim-review-heading"><div className="eyebrow">Admin tools</div><strong>Profile claim requests</strong><small>Verify a claimant’s identity before approving.</small></div>
			{error && <p className="form-error" role="alert">{error}</p>}
			{requests.length === 0 && !error && <p className="muted">No pending profile claims.</p>}
			{requests.map((request) => (
				<div className="claim-review-row" key={request.id}>
					<span><strong>{names[request.claimant_id] ?? 'Family member'}</strong> wants to claim <b>{profiles.find((profile) => profile.$id === request.profile_id)?.name ?? 'a person profile'}</b></span>
					<div>
						<button className="button button-quiet" disabled={busyId === request.id} onClick={() => void review(request.id, false)}>Decline</button>
						<button className="button button-primary" disabled={busyId === request.id} onClick={() => void review(request.id, true)}>{busyId === request.id ? 'Reviewing…' : 'Approve'}</button>
					</div>
				</div>
			))}
		</section>
	);
}

function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
	return <div className="empty-state"><span className="empty-icon"><AppIcon name="image" size={24} /></span><h3>{title}</h3><p>{body}</p>{action}</div>;
}

function FamilySwitcher({ families, activeFamilyId, onSwitch }: { families: FamilyRow[]; activeFamilyId: string; onSwitch: (familyId: string) => void }) {
	if (families.length < 2) return null;
	return (
		<label className="family-switcher">
			<span>Family space</span>
			<select value={activeFamilyId} onChange={(event) => onSwitch(event.target.value)}>
				{families.map((family) => <option value={family.id} key={family.id}>{family.name}</option>)}
			</select>
		</label>
	);
}

function FamilyManagement({ familyId, isAdmin }: { familyId: string; isAdmin: boolean }) {
	const [email, setEmail] = useState('');
	const [inviteLink, setInviteLink] = useState('');
	const [error, setError] = useState('');
	const [notice, setNotice] = useState('');
	const [saving, setSaving] = useState(false);

	async function createInvitation(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setSaving(true);
		setError('');
		setNotice('');
		try {
			const { data, error: invitationError } = await createSupabaseClient().rpc('create_family_invitation', {
				p_family_id: familyId,
				p_email: email.trim(),
			});
			if (invitationError) throw invitationError;
			const token = data?.[0]?.invitation_token;
			if (!token) throw new Error('The invitation was not created. Please try again.');
			setInviteLink(`${window.location.origin}/app?invite=${encodeURIComponent(token)}`);
			setNotice('Invitation created. Share the link with your family member.');
			setEmail('');
		} catch (invitationError) {
			setError(getMessage(invitationError));
		} finally {
			setSaving(false);
		}
	}

	if (!isAdmin) return null;
	return (
		<section className="family-management">
			<div className="eyebrow">Family space</div>
			<h2>Invite someone you trust</h2>
			<p className="muted">They can join this family and switch between it and any other family spaces they belong to.</p>
			<form onSubmit={createInvitation}>
				<label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="relative@example.com" required /></label>
				<button className="button button-primary button-small" type="submit" disabled={saving}>{saving ? 'Creating…' : 'Create invite link'}</button>
			</form>
			{inviteLink && <label className="invite-link-field">Invite link<input value={inviteLink} readOnly onFocus={(event) => event.currentTarget.select()} /></label>}
			{notice && <p className="form-notice" role="status">{notice}</p>}
			{error && <p className="form-error" role="alert">{error}</p>}
		</section>
	);
}

function FamilyCreationPanel({ onCreated }: { onCreated: (familyId: string) => Promise<void> }) {
	const [name, setName] = useState('');
	const [error, setError] = useState('');
	const [saving, setSaving] = useState(false);

	async function createFamily(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setSaving(true);
		setError('');
		try {
			const { data, error: createError } = await createSupabaseClient().rpc('create_family', { p_name: name.trim() });
			if (createError) throw createError;
			if (!data) throw new Error('The family was not created. Please try again.');
			await onCreated(data);
		} catch (createError) {
			setError(getMessage(createError));
		} finally {
			setSaving(false);
		}

	}

	return (
		<form className="family-create-form" onSubmit={createFamily}>
			<label>Family name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="The Ward family" maxLength={120} required /></label>
			<button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Creating…' : 'Create a family'}</button>
			{error && <p className="form-error" role="alert">{error}</p>}
		</form>
	);
}

function PhotoGrid({ photos, profiles, onOpen }: { photos: PhotoDocument[]; profiles: ProfileDocument[]; onOpen: (photo: PhotoDocument) => void }) {
	return (
		<div className="photo-grid">
			{photos.map((photo, index) => {
				const tagged = profiles.filter((profile) => photo.taggedProfiles.includes(profile.$id));
				return (
					<button className={`photo-card card-tint-${index % 4}`} key={photo.$id} onClick={() => onOpen(photo)}>
						<span className="photo-image-wrap"><img src={photo.imageUrl} alt={photo.title || `Family memory from ${photo.year}`} loading="lazy" /><span className="photo-year">{photo.year}</span></span>
						<span className="photo-card-content">
							<span className="photo-title">{photo.title || 'A moment together'}</span>
							<span className="photo-tags">{tagged.length ? tagged.map((profile) => profile.name.split(' ')[0]).join(' · ') : 'A family memory'}</span>
							{photo.countryCode && <span className="photo-location">{countryName(photo.countryCode)}</span>}
						</span>
					</button>
				);
			})}
		</div>
	);
}

function UploadDialog({ profiles, familyId, onClose, onCreated }: { profiles: ProfileDocument[]; familyId: string; onClose: () => void; onCreated: () => Promise<void> }) {
	const [selectedIds, setSelectedIds] = useState<string[]>([]);
	const [search, setSearch] = useState('');
	const [error, setError] = useState('');
	const [saving, setSaving] = useState(false);
	const [creatingProfile, setCreatingProfile] = useState(false);
	const [newProfileName, setNewProfileName] = useState('');
	const [newProfileBirthDate, setNewProfileBirthDate] = useState('');
	const [availableProfiles, setAvailableProfiles] = useState(profiles);
	const [defaultCountry, setDefaultCountry] = useState('IE');
	const [countryCode, setCountryCode] = useState<string | null>(null);
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [filePreview, setFilePreview] = useState('');

	useEffect(() => {
		if (!selectedFile) {
			setFilePreview('');
			return;
		}
		const previewUrl = URL.createObjectURL(selectedFile);
		setFilePreview(previewUrl);
		return () => URL.revokeObjectURL(previewUrl);
	}, [selectedFile]);

	useEffect(() => {
		void createSupabaseClient().auth.getUser().then(async ({ data }) => {
			if (!data.user) return;
			const result = await createSupabaseClient().from('profiles').select('default_country_code').eq('user_id', data.user.id).single();
			if (!result.error && result.data?.default_country_code) setDefaultCountry(result.data.default_country_code);
		});
	}, []);

	async function createProfile() {
		setError('');
		const name = newProfileName.trim();
		if (!name) return;
		try {
			const { data: profile, error: profileError } = await createSupabaseClient()
				.from('profiles')
				.insert({ name, birth_date: newProfileBirthDate || null })
				.select('*')
				.single();
			if (profileError) throw profileError;
			const newProfile = toProfile(profile);
			setSelectedIds((current) => [...current, newProfile.$id]);
			setAvailableProfiles((current) => [...current, newProfile]);
			setSearch('');
			setCreatingProfile(false);
			setNewProfileName('');
			setNewProfileBirthDate('');
		} catch (profileError) {
			setError(getMessage(profileError));
		}
	}

	async function upload(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setSaving(true);
		setError('');
		const form = event.currentTarget;
		const data = new FormData(form);
		const file = data.get('photo');
		if (!(file instanceof File) || !file.size) {
			setError('Choose a photo to upload.');
			setSaving(false);
			return;
		}
		if (!file.type.startsWith('image/')) {
			setError('Choose an image file.');
			setSaving(false);
			return;
		}
		if (file.size > 50 * 1024 * 1024) {
			setError('Choose an image smaller than 50 MiB.');
			setSaving(false);
			return;
		}

		const supabase = createSupabaseClient();
		const extensionByType: Record<string, string> = {
			'image/jpeg': 'jpg',
			'image/png': 'png',
			'image/webp': 'webp',
			'image/gif': 'gif',
			'image/avif': 'avif',
		};
		const extension = extensionByType[file.type];
		if (!extension) {
			setError('Choose a JPEG, PNG, WebP, GIF, or AVIF image.');
			setSaving(false);
			return;
		}
		let filePath: string | null = null;
		let fileUploaded = false;
		let photoSaved = false;

		try {
			const { data: userData, error: userError } = await supabase.auth.getUser();
			if (userError) throw userError;
			if (!userData.user) throw new Error('Your session expired. Sign in again before uploading a photo.');

			filePath = `families/${familyId}/photos/${userData.user.id}/${createUuid()}.${extension}`;
			const { error: storageError } = await supabase.storage
				.from(PHOTO_BUCKET)
				.upload(filePath, file, { contentType: file.type, upsert: false });
			if (storageError) throw storageError;
			fileUploaded = true;

			const { error: photoError } = await supabase.from('photos').insert({
				title: String(data.get('title') ?? '').trim() || null,
				file_path: filePath,
				year: Number(data.get('year')),
				uploaded_by: userData.user.id,
				tagged_profiles: selectedIds,
				country_code: countryCode,
			});
			if (photoError) throw photoError;
			photoSaved = true;
			await onCreated();
		} catch (uploadError) {
			let message = getMessage(uploadError);
			if (fileUploaded && !photoSaved && filePath) {
				const { error: cleanupError } = await supabase.storage.from(PHOTO_BUCKET).remove([filePath]);
				if (cleanupError) {
					message += ` The uploaded file could not be removed automatically (${cleanupError.message}); delete ${filePath} from Storage.`;
				}
			}
			setError(message);
			setSaving(false);
		}
	}

	const filteredProfiles = availableProfiles.filter((profile) => profile.name.toLowerCase().includes(search.toLowerCase()));

	return (
		<div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
			<section className="modal-card upload-modal" role="dialog" aria-modal="true" aria-labelledby="upload-heading">
				<header className="modal-header"><div><div className="eyebrow">Keep this one close</div><h2 id="upload-heading">Add a memory</h2></div><button className="icon-button" onClick={onClose} aria-label="Close"><AppIcon name="close" /></button></header>
				<form className="upload-form" onSubmit={upload}>
					<label className="photo-upload-field">Choose a photo<input name="photo" type="file" accept="image/*" required onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)} />{filePreview && <span className="upload-preview-bubble"><img src={filePreview} alt="Selected memory preview" /><span>{selectedFile?.name}</span></span>}</label>
					<div className="form-two"><label>Give it a little title<input name="title" placeholder="Sunday at grandma’s" /></label><label>What year was it?<input name="year" type="number" min="1800" max={new Date().getFullYear()} defaultValue={new Date().getFullYear()} required /></label></div>
					<UploadCountrySelector defaultCountry={defaultCountry} value={countryCode} onChange={setCountryCode} />
					<div className="tagging-block"><label htmlFor="profile-search">Who’s in this memory?</label><input id="profile-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search family members…" />{selectedIds.length > 0 && <div className="selected-tags">{selectedIds.map((id) => { const profile = availableProfiles.find((person) => person.$id === id); return profile ? <button type="button" className="tag-chip selected" key={id} onClick={() => setSelectedIds((current) => current.filter((item) => item !== id))}>{profile.name} <span>×</span></button> : null; })}</div>}<div className="profile-options">{filteredProfiles.map((profile) => <button type="button" className={`tag-chip ${selectedIds.includes(profile.$id) ? 'selected' : ''}`} key={profile.$id} onClick={() => setSelectedIds((current) => current.includes(profile.$id) ? current.filter((id) => id !== profile.$id) : [...current, profile.$id])}>{profile.name}</button>)}</div>{!filteredProfiles.length && search && <button className="text-link inline-link" type="button" onClick={() => { setNewProfileName(search); setCreatingProfile(true); }}>+ Add “{search}” as a new family member</button>}</div>
					{creatingProfile && <div className="inline-profile-form"><label>New family member’s name<input autoFocus value={newProfileName} onChange={(event) => setNewProfileName(event.target.value)} required /></label><label>Birth date (optional)<input type="date" max={new Date().toISOString().slice(0, 10)} value={newProfileBirthDate} onChange={(event) => setNewProfileBirthDate(event.target.value)} /></label><button className="button button-quiet" type="button" onClick={createProfile}>Create profile</button><button className="text-link" type="button" onClick={() => setCreatingProfile(false)}>Cancel</button></div>}
					{error && <p className="form-error" role="alert">{error}</p>}
					<div className="modal-actions"><button className="button button-quiet" type="button" onClick={onClose}>Cancel</button><button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Adding your memory…' : <><AppIcon name="plus" size={17} /> Add to family album</>}</button></div>
				</form>
			</section>
		</div>
	);
}

function PhotoDialog({ photo, profiles, user, onClose, onDeleted }: { photo: PhotoDocument; profiles: ProfileDocument[]; user: AppUser | null; onClose: () => void; onDeleted: (photoId: string) => void }) {
	const [comments, setComments] = useState<CommentDocument[]>([]);
	const [error, setError] = useState('');
	const [saving, setSaving] = useState(false);
	const [deleteError, setDeleteError] = useState('');
	const [deleting, setDeleting] = useState(false);
	const tagged = profiles.filter((profile) => photo.taggedProfiles.includes(profile.$id));

	useEffect(() => {
		async function loadComments() {
			try {
				const { data, error: commentError } = await createSupabaseClient()
					.from('comments')
					.select('*')
					.eq('photo_id', photo.$id)
					.order('created_at')
					.limit(100);
				if (commentError) throw commentError;
				setComments(data.map((comment) => ({
					$id: comment.id,
					photoId: comment.photo_id,
					authorId: comment.author_id,
					authorName: comment.author_name,
					content: comment.content,
					createdAt: comment.created_at,
				})));
			} catch (commentError) {
				setError(getMessage(commentError));
			}
		}
		void loadComments();
	}, [photo.$id]);

	async function submitComment(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!user) return;
		setSaving(true);
		setError('');
		const form = event.currentTarget;
		const data = new FormData(form);
		try {
			const { data: comment, error: commentError } = await createSupabaseClient().from('comments').insert({
				photo_id: photo.$id,
				author_id: user.$id,
				author_name: user.name || user.email,
				content: String(data.get('content') ?? '').trim(),
			}).select('*').single();
			if (commentError) throw commentError;
			setComments((current) => [...current, toComment(comment)]);
			form.reset();
		} catch (commentError) {
			setError(getMessage(commentError));
		} finally {
			setSaving(false);
		}
	}

	async function deletePost() {
		if (!user || user.$id !== photo.uploadedBy) return;
		if (!window.confirm('Delete this post? This cannot be undone.')) return;

		setDeleting(true);
		setDeleteError('');
		let storageObjectRemoved = false;
		try {
			const supabase = createSupabaseClient();
			const { error: storageError } = await supabase.storage.from(PHOTO_BUCKET).remove([photo.fileId]);
			if (storageError) throw storageError;
			storageObjectRemoved = true;

			const { data: deletedPhoto, error: deleteError } = await supabase
				.from('photos')
				.delete()
				.eq('id', photo.$id)
				.eq('uploaded_by', user.$id)
				.select('id')
				.maybeSingle();
			if (deleteError) throw deleteError;
			if (!deletedPhoto) throw new Error('This post is no longer available or you do not have permission to delete it.');

			onDeleted(photo.$id);
		} catch (deleteError) {
			const message = getMessage(deleteError);
			setDeleteError(storageObjectRemoved
				? `The photo was removed, but the post could not be deleted: ${message} Please try deleting it again.`
				: message);
		} finally {
			setDeleting(false);
		}
	}

	return (
		<div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
			<section className="modal-card photo-detail-modal" role="dialog" aria-modal="true" aria-label={photo.title || 'Family memory'}>
				<button className="icon-button photo-close" onClick={onClose} aria-label="Close"><AppIcon name="close" /></button>
				<img className="detail-image" src={photo.imageUrl} alt={photo.title || `Family memory from ${photo.year}`} />
				<div className="detail-content"><div className="detail-heading"><div><div className="eyebrow">{photo.year} · SHARED WITH LOVE</div><h2>{photo.title || 'A moment together'}</h2></div>{user?.$id === photo.uploadedBy && <button className="button button-danger button-small" onClick={deletePost} disabled={deleting}>{deleting ? 'Deleting…' : 'Delete Post'}</button>}</div><div className="detail-tags">{tagged.map((profile) => <a className="tag-chip" href={`/person/${profile.$id}`} key={profile.$id}>{profile.name}</a>)}</div>
					{deleteError && <p className="form-error" role="alert">{deleteError}</p>}
					<div className="comment-section"><h3>Little notes <span>{comments.length}</span></h3>{comments.map((comment) => <div className="comment-row" key={comment.$id}><span className="avatar avatar-small">{initials(comment.authorName)}</span><p><b>{comment.authorName}</b><span>{comment.content}</span></p></div>)}{!comments.length && !error && <p className="muted comment-empty">No notes yet. Leave the first one.</p>}{error && <p className="form-error" role="alert">{error}</p>}
						<form className="comment-form" onSubmit={submitComment}><input name="content" maxLength={2000} required placeholder="Leave a little note…" aria-label="Write a comment" /><button type="submit" disabled={saving} aria-label="Send comment"><AppIcon name="arrow" size={17} /></button></form>
					</div>
				</div>
			</section>
		</div>
	);
}
