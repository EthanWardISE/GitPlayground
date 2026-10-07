import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { AppwriteException } from 'appwrite';
import type { Models } from 'appwrite';
import { appwriteConfig, createAppwriteServices, ID, Permission, Query, Role } from '../lib/appwrite';
import type { CommentDocument, PhotoDocument, ProfileDocument } from '../types/database';

type AppStatus = 'loading' | 'signedOut' | 'pending' | 'ready' | 'setup' | 'error';
type AppUser = Pick<Models.User<Models.Preferences>, '$id' | 'name' | 'email'>;

interface FamilyAppProps {
	view?: 'feed' | 'tree' | 'person';
	personId?: string;
}

function AppIcon({ name, size = 20 }: { name: 'home' | 'tree' | 'plus' | 'search' | 'heart' | 'arrow' | 'image' | 'close' | 'lock' | 'logout'; size?: number }) {
	const paths: Record<typeof name, string> = {
		home: 'M3 10.5 12 3l9 7.5M5 9v11h14V9M9 20v-6h6v6',
		tree: 'M12 21v-7m0-4V3m0 7-5-4m5 4 5-4M5 7l-2 2m14-2 2 2M9 14H6m9 0h3',
		plus: 'M12 5v14m-7-7h14',
		search: 'm20 20-4.5-4.5M18 10.5a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z',
		heart: 'M20.8 8.7c0 5.5-8.8 11-8.8 11s-8.8-5.5-8.8-11A4.7 4.7 0 0 1 12 6.2a4.7 4.7 0 0 1 8.8 2.5Z',
		arrow: 'M5 12h14m-7-7 7 7-7 7',
		image: 'M4 5h16v14H4zM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm11.5 5-5-5-8 9',
		close: 'm18 6-12 12M6 6l12 12',
		lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
		logout: 'M10 17l5-5-5-5m5 5H3m9-9h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7',
	};

	return (
		<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
			<path d={paths[name]} />
		</svg>
	);
}

function initials(name: string) {
	return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function getMessage(error: unknown): string {
	return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

function isUnauthenticated(error: unknown): boolean {
	return error instanceof AppwriteException && error.code === 401;
}

export default function FamilyApp({ view = 'feed', personId }: FamilyAppProps) {
	const [status, setStatus] = useState<AppStatus>('loading');
	const [user, setUser] = useState<AppUser | null>(null);
	const [error, setError] = useState('');
	const [profiles, setProfiles] = useState<ProfileDocument[]>([]);
	const [photos, setPhotos] = useState<PhotoDocument[]>([]);
	const [selectedPhoto, setSelectedPhoto] = useState<PhotoDocument | null>(null);
	const [yearFilter, setYearFilter] = useState('all');
	const [personFilter, setPersonFilter] = useState<string[]>([]);
	const [showUpload, setShowUpload] = useState(false);
	const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');

	const configReady = Object.values(appwriteConfig).every(Boolean);
	const photoUrl = useCallback((fileId: string) => {
		const services = createAppwriteServices();
		return services.storage.getFileView(appwriteConfig.storageBucketId, fileId);
	}, []);

	const loadFamilyData = useCallback(async () => {
		const services = createAppwriteServices();
		const [profileList, photoList] = await Promise.all([
			services.databases.listDocuments<ProfileDocument>(
				appwriteConfig.databaseId,
				appwriteConfig.profilesCollectionId,
				[Query.orderAsc('name'), Query.limit(100)],
			),
			services.databases.listDocuments<PhotoDocument>(
				appwriteConfig.databaseId,
				appwriteConfig.photosCollectionId,
				[Query.orderDesc('year'), Query.limit(100)],
			),
		]);
		setProfiles(profileList.documents);
		setPhotos(photoList.documents);
	}, []);

	const checkMembership = useCallback(async (activeUser: AppUser) => {
		const services = createAppwriteServices();
		const teamList = await services.teams.list({ total: false });
		setUser(activeUser);
		if (!teamList.teams.some((team) => team.$id === appwriteConfig.familyTeamId)) {
			setStatus('pending');
			return;
		}
		await loadFamilyData();
		setStatus('ready');
	}, [loadFamilyData]);

	useEffect(() => {
		if (!configReady) {
			setStatus('setup');
			return;
		}

		const services = createAppwriteServices();
		services.account.get()
			.then((activeUser) => checkMembership(activeUser))
			.catch((authError: unknown) => {
				if (isUnauthenticated(authError)) {
					setStatus('signedOut');
					return;
				}
				setError(getMessage(authError));
				setStatus('error');
			});
	}, [checkMembership, configReady]);

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
			const services = createAppwriteServices();
			if (authMode === 'signup') {
				await services.account.create({ userId: ID.unique(), email, password, name });
			}
			await services.account.createEmailPasswordSession({ email, password });
			await checkMembership(await services.account.get());
		} catch (authError) {
			setError(getMessage(authError));
		}
	}

	async function signOut() {
		try {
			await createAppwriteServices().account.deleteSession({ sessionId: 'current' });
			setUser(null);
			setStatus('signedOut');
		} catch (signOutError) {
			setError(getMessage(signOutError));
		}
	}

	const pageTitle = view === 'tree' ? 'Our family tree' : view === 'person' ? selectedPerson?.name ?? 'Family member' : 'The family album';

	if (status === 'loading') {
		return <main className="screen-state"><div className="loading-mark">k</div><p>Gathering your family memories…</p></main>;
	}

	if (status === 'setup') {
		return (
			<main className="setup-screen">
				<div className="setup-card">
					<a className="brand" href="/"><span className="brand-mark">k</span><span>kinfolk</span></a>
					<div className="eyebrow">A little place for your people</div>
					<h1>Your family stories<br />belong together.</h1>
					<p className="setup-copy">Connect this app to your private Appwrite project to open your family album.</p>
					<div className="setup-instructions">
						<strong>One quick setup step</strong>
						<span>Copy <code>.env.example</code> to <code>.env</code> in this project folder, then fill in the Appwrite IDs.</span>
					</div>
					<a className="text-link" href="https://appwrite.io/docs" target="_blank" rel="noreferrer">Read the Appwrite setup guide <AppIcon name="arrow" size={16} /></a>
				</div>
			</main>
		);
	}

	if (status === 'signedOut') {
		return (
			<main className="auth-screen">
				<section className="auth-story">
					<a className="brand brand-light" href="/"><span className="brand-mark">k</span><span>kinfolk</span></a>
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
						<div className="mobile-brand"><a className="brand" href="/"><span className="brand-mark">k</span><span>kinfolk</span></a></div>
						<div className="eyebrow">{authMode === 'login' ? 'Welcome back' : 'You belong here'}</div>
						<h2>{authMode === 'login' ? 'Come on in.' : 'Join your family.'}</h2>
						<p className="muted">{authMode === 'login' ? 'Sign in to see what everyone has been up to.' : 'Create an account to request access to the family album.'}</p>
						<form className="auth-form" onSubmit={submitAuth}>
							{authMode === 'signup' && <label>Your name<input name="name" autoComplete="name" required placeholder="How should we call you?" /></label>}
							<label>Email address<input name="email" type="email" autoComplete="email" required placeholder="you@example.com" /></label>
							<label>Password<input name="password" type="password" autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} minLength={8} required placeholder="At least 8 characters" /></label>
							{error && <p className="form-error" role="alert">{error}</p>}
							<button className="button button-primary button-wide" type="submit">{authMode === 'login' ? 'Sign in to your album' : 'Create account'} <AppIcon name="arrow" size={17} /></button>
						</form>
						<p className="auth-switch">
							{authMode === 'login' ? 'New to the family album?' : 'Already have an account?'}
							<button type="button" onClick={() => { setError(''); setAuthMode(authMode === 'login' ? 'signup' : 'login'); }}>
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
				<a className="brand" href="/"><span className="brand-mark">k</span><span>kinfolk</span></a>
				<div className="pending-icon"><AppIcon name="lock" size={25} /></div>
				<div className="eyebrow">Almost there</div>
				<h1>You’re on the list.</h1>
				<p className="muted">Your account is ready{user?.name ? `, ${user.name.split(' ')[0]}` : ''}. A family admin needs to add you to the Family team before you can see the album.</p>
				<button className="button button-quiet" onClick={signOut}><AppIcon name="logout" size={17} /> Sign out</button>
			</main>
		);
	}

	if (status === 'error') {
		return (
			<main className="screen-state">
				<a className="brand" href="/"><span className="brand-mark">k</span><span>kinfolk</span></a>
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
				<a className="brand" href="/"><span className="brand-mark">k</span><span>kinfolk</span></a>
				<div className="sidebar-section-label">YOUR SPACE</div>
				<nav className="side-nav" aria-label="Main navigation">
					<a href="/" className={`nav-link ${view === 'feed' ? 'active' : ''}`}><AppIcon name="home" /> Family album</a>
					<a href="/tree" className={`nav-link ${view === 'tree' ? 'active' : ''}`}><AppIcon name="tree" /> Family tree</a>
				</nav>
				<div className="sidebar-family">
					<div className="sidebar-section-label">IN THE ALBUM <span>{profiles.length}</span></div>
					<div className="family-mini-list">
						{profiles.slice(0, 7).map((profile, index) => (
							<a href={`/person/${profile.$id}`} className="family-mini" key={profile.$id}>
								<span className={`avatar avatar-${index % 5}`}>{initials(profile.name)}</span><span>{profile.name}</span>
							</a>
						))}
					</div>
				</div>
				<div className="sidebar-bottom">
					<div className="privacy-card"><AppIcon name="lock" size={16} /><span><b>Your own little corner</b><small>Only family members can see this album.</small></span></div>
					<button className="account-row" onClick={signOut}><span className="avatar avatar-user">{initials(user?.name || user?.email || 'F')}</span><span className="account-copy"><b>{user?.name || 'Family member'}</b><small>{user?.email}</small></span><AppIcon name="logout" size={17} /></button>
				</div>
			</aside>

			<main className="main-content">
				<header className="topbar">
					<div className="breadcrumb"><span>YOUR SPACE</span><span className="breadcrumb-divider">/</span><b>{pageTitle.toUpperCase()}</b></div>
					<div className="topbar-actions">
						<div className="member-count"><span className="online-dot" /> {profiles.length} family members</div>
						<button className="button button-primary button-small" onClick={() => setShowUpload(true)}><AppIcon name="plus" size={17} /> Add a memory</button>
					</div>
				</header>

				{view === 'tree' ? (
					<section className="page-body">
						<div className="page-heading">
							<div><div className="eyebrow">Roots, branches & everything in between</div><h1>Our family tree</h1><p className="muted">A little map of the people who make us, us.</p></div>
							<span className="heading-count">{profiles.length} PEOPLE</span>
						</div>
						<div className="tree-canvas">{profiles.length ? <FamilyTree profiles={profiles} /> : <EmptyState title="Your tree is ready to grow" body="Add profiles with parent details to start connecting the branches." />}</div>
					</section>
				) : view === 'person' ? (
					<section className="page-body">
						{selectedPerson ? (
							<>
								<a className="back-link" href="/tree">← Back to family tree</a>
								<div className="person-profile">
									<span className="avatar avatar-large">{initials(selectedPerson.name)}</span>
									<div><div className="eyebrow">A member of the family</div><h1>{selectedPerson.name}</h1><p className="muted">{selectedPerson.birthYear ? `Born ${selectedPerson.birthYear} · ` : ''}${taggedPhotos.length} {taggedPhotos.length === 1 ? 'memory' : 'memories'} together</p></div>
								</div>
								<PhotoGrid photos={taggedPhotos} profiles={profiles} photoUrl={photoUrl} onOpen={setSelectedPhoto} />
							</>
						) : <EmptyState title="We can’t find that family member" body="They may not have been added to the family tree yet." />}
					</section>
				) : (
					<section className="page-body">
						<div className="welcome-banner">
							<div className="welcome-copy"><div className="eyebrow">A little hello to the whole family</div><h1>Good things are<br />better shared.</h1><p>All your favourite people, and the moments that make you one big story.</p><div className="welcome-people">{profiles.slice(0, 5).map((profile, index) => <a key={profile.$id} href={`/person/${profile.$id}`} className={`avatar avatar-${index % 5}`} title={profile.name}>{initials(profile.name)}</a>)}<a href="/tree" className="people-more">See your family <AppIcon name="arrow" size={14} /></a></div></div>
							<div className="welcome-art" aria-hidden="true"><span className="sun-shape" /><span className="art-leaf leaf-one" /><span className="art-leaf leaf-two" /><span className="art-pot" /><span className="art-flower">✳</span></div>
							<span className="banner-note">MADE OF LITTLE MOMENTS</span>
						</div>
						<div className="feed-header">
							<div><div className="eyebrow">Collected together</div><h2>Recent memories</h2></div>
							<div className="feed-filters">
								<label className="filter-select"><span className="sr-only">Filter memories by year</span><select value={yearFilter} onChange={(event) => setYearFilter(event.target.value)}><option value="all">Every year</option>{years.map((year) => <option value={year} key={year}>{year}</option>)}</select></label>
								<details className="person-filter"><summary><AppIcon name="search" size={16} /> {personFilter.length ? `${personFilter.length} people` : 'Everyone'} <span aria-hidden="true">⌄</span></summary><div className="filter-popover">{profiles.map((profile) => <label key={profile.$id}><input type="checkbox" checked={personFilter.includes(profile.$id)} onChange={() => setPersonFilter((current) => current.includes(profile.$id) ? current.filter((id) => id !== profile.$id) : [...current, profile.$id])} />{profile.name}</label>)}</div></details>
							</div>
						</div>
						{filteredPhotos.length ? <PhotoGrid photos={filteredPhotos} profiles={profiles} photoUrl={photoUrl} onOpen={setSelectedPhoto} /> : <EmptyState title="The best memories are still to come" body="Add the first photo to start filling this family album." action={<button className="button button-primary" onClick={() => setShowUpload(true)}><AppIcon name="plus" size={17} /> Add a memory</button>} />}
					</section>
				)}
			</main>

			{showUpload && <UploadDialog profiles={profiles} onClose={() => setShowUpload(false)} onCreated={async () => { await loadFamilyData(); setShowUpload(false); }} />}
			{selectedPhoto && <PhotoDialog photo={selectedPhoto} profiles={profiles} user={user} photoUrl={photoUrl} onClose={() => setSelectedPhoto(null)} />}
		</div>
	);
}

function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
	return <div className="empty-state"><span className="empty-icon"><AppIcon name="image" size={24} /></span><h3>{title}</h3><p>{body}</p>{action}</div>;
}

function PhotoGrid({ photos, profiles, photoUrl, onOpen }: { photos: PhotoDocument[]; profiles: ProfileDocument[]; photoUrl: (id: string) => string; onOpen: (photo: PhotoDocument) => void }) {
	return (
		<div className="photo-grid">
			{photos.map((photo, index) => {
				const tagged = profiles.filter((profile) => photo.taggedProfiles.includes(profile.$id));
				return (
					<button className={`photo-card card-tint-${index % 4}`} key={photo.$id} onClick={() => onOpen(photo)}>
						<span className="photo-image-wrap"><img src={photoUrl(photo.fileId)} alt={photo.title || `Family memory from ${photo.year}`} loading="lazy" /><span className="photo-year">{photo.year}</span></span>
						<span className="photo-card-content"><span className="photo-title">{photo.title || 'A moment together'}</span><span className="photo-tags">{tagged.length ? tagged.map((profile) => profile.name.split(' ')[0]).join(' · ') : 'A family memory'}</span></span>
					</button>
				);
			})}
		</div>
	);
}

function FamilyTree({ profiles }: { profiles: ProfileDocument[] }) {
	const children = new Map<string, ProfileDocument[]>();
	const childIds = new Set<string>();
	for (const profile of profiles) {
		for (const parentId of [profile.parentId1, profile.parentId2]) {
			if (!parentId || !profiles.some((person) => person.$id === parentId)) continue;
			children.set(parentId, [...(children.get(parentId) ?? []), profile]);
			childIds.add(profile.$id);
		}
	}
	const roots = profiles.filter((profile) => !childIds.has(profile.$id));
	const startingPoints = roots.length ? roots : profiles.slice(0, 1);
	return <div className="family-tree">{startingPoints.map((profile) => <TreeBranch key={profile.$id} profile={profile} childrenMap={children} seen={new Set()} />)}</div>;
}

function TreeBranch({ profile, childrenMap, seen }: { profile: ProfileDocument; childrenMap: Map<string, ProfileDocument[]>; seen: Set<string> }) {
	if (seen.has(profile.$id)) return null;
	const nextSeen = new Set(seen).add(profile.$id);
	const descendants = childrenMap.get(profile.$id) ?? [];
	return <div className="tree-branch"><a href={`/person/${profile.$id}`} className="tree-person"><span className="avatar">{initials(profile.name)}</span><span><b>{profile.name}</b><small>{profile.birthYear || 'Family member'}</small></span></a>{descendants.length > 0 && <div className="tree-children">{descendants.map((child) => <TreeBranch key={child.$id} profile={child} childrenMap={childrenMap} seen={nextSeen} />)}</div>}</div>;
}

function UploadDialog({ profiles, onClose, onCreated }: { profiles: ProfileDocument[]; onClose: () => void; onCreated: () => Promise<void> }) {
	const [selectedIds, setSelectedIds] = useState<string[]>([]);
	const [search, setSearch] = useState('');
	const [error, setError] = useState('');
	const [saving, setSaving] = useState(false);
	const [creatingProfile, setCreatingProfile] = useState(false);
	const [newProfileName, setNewProfileName] = useState('');
	const [availableProfiles, setAvailableProfiles] = useState(profiles);

	async function createProfile() {
		setError('');
		const name = newProfileName.trim();
		if (!name) return;
		try {
			const profile = await createAppwriteServices().databases.createDocument<ProfileDocument>(
				appwriteConfig.databaseId,
				appwriteConfig.profilesCollectionId,
				ID.unique(),
				{ name },
				[Permission.read(Role.team(appwriteConfig.familyTeamId)), Permission.update(Role.team(appwriteConfig.familyTeamId)), Permission.delete(Role.team(appwriteConfig.familyTeamId))],
			);
			setSelectedIds((current) => [...current, profile.$id]);
			setAvailableProfiles((current) => [...current, profile]);
			setSearch('');
			setCreatingProfile(false);
			setNewProfileName('');
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
		let fileId = '';
		try {
			const services = createAppwriteServices();
			const uploaded = await services.storage.createFile(
				appwriteConfig.storageBucketId,
				ID.unique(),
				file,
				[Permission.read(Role.team(appwriteConfig.familyTeamId)), Permission.update(Role.team(appwriteConfig.familyTeamId)), Permission.delete(Role.team(appwriteConfig.familyTeamId))],
			);
			fileId = uploaded.$id;
			await services.databases.createDocument<PhotoDocument>(
				appwriteConfig.databaseId,
				appwriteConfig.photosCollectionId,
				ID.unique(),
				{
					title: String(data.get('title') ?? '').trim(),
					fileId,
					year: Number(data.get('year')),
					uploadedBy: (await services.account.get()).$id,
					taggedProfiles: selectedIds,
				},
				[Permission.read(Role.team(appwriteConfig.familyTeamId)), Permission.update(Role.team(appwriteConfig.familyTeamId)), Permission.delete(Role.team(appwriteConfig.familyTeamId))],
			);
			await onCreated();
		} catch (uploadError) {
			setError(`${getMessage(uploadError)}${fileId ? ' The image uploaded, but its photo record could not be saved. Please remove the orphaned file in Appwrite Storage before retrying.' : ''}`);
			setSaving(false);
		}
	}

	const filteredProfiles = availableProfiles.filter((profile) => profile.name.toLowerCase().includes(search.toLowerCase()));

	return (
		<div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
			<section className="modal-card upload-modal" role="dialog" aria-modal="true" aria-labelledby="upload-heading">
				<header className="modal-header"><div><div className="eyebrow">Keep this one close</div><h2 id="upload-heading">Add a memory</h2></div><button className="icon-button" onClick={onClose} aria-label="Close"><AppIcon name="close" /></button></header>
				<form className="upload-form" onSubmit={upload}>
					<label>Choose a photo<input name="photo" type="file" accept="image/*" required /></label>
					<div className="form-two"><label>Give it a little title<input name="title" placeholder="Sunday at grandma’s" /></label><label>What year was it?<input name="year" type="number" min="1800" max={new Date().getFullYear()} defaultValue={new Date().getFullYear()} required /></label></div>
					<div className="tagging-block"><label htmlFor="profile-search">Who’s in this memory?</label><input id="profile-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search family members…" />{selectedIds.length > 0 && <div className="selected-tags">{selectedIds.map((id) => { const profile = availableProfiles.find((person) => person.$id === id); return profile ? <button type="button" className="tag-chip selected" key={id} onClick={() => setSelectedIds((current) => current.filter((item) => item !== id))}>{profile.name} <span>×</span></button> : null; })}</div>}<div className="profile-options">{filteredProfiles.map((profile) => <button type="button" className={`tag-chip ${selectedIds.includes(profile.$id) ? 'selected' : ''}`} key={profile.$id} onClick={() => setSelectedIds((current) => current.includes(profile.$id) ? current.filter((id) => id !== profile.$id) : [...current, profile.$id])}>{profile.name}</button>)}</div>{!filteredProfiles.length && search && <button className="text-link inline-link" type="button" onClick={() => { setNewProfileName(search); setCreatingProfile(true); }}>+ Add “{search}” as a new family member</button>}</div>
					{creatingProfile && <div className="inline-profile-form"><label>New family member’s name<input autoFocus value={newProfileName} onChange={(event) => setNewProfileName(event.target.value)} required /></label><button className="button button-quiet" type="button" onClick={createProfile}>Create profile</button><button className="text-link" type="button" onClick={() => setCreatingProfile(false)}>Cancel</button></div>}
					{error && <p className="form-error" role="alert">{error}</p>}
					<div className="modal-actions"><button className="button button-quiet" type="button" onClick={onClose}>Cancel</button><button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Adding your memory…' : <><AppIcon name="plus" size={17} /> Add to family album</>}</button></div>
				</form>
			</section>
		</div>
	);
}

function PhotoDialog({ photo, profiles, user, photoUrl, onClose }: { photo: PhotoDocument; profiles: ProfileDocument[]; user: AppUser | null; photoUrl: (id: string) => string; onClose: () => void }) {
	const [comments, setComments] = useState<CommentDocument[]>([]);
	const [error, setError] = useState('');
	const [saving, setSaving] = useState(false);
	const tagged = profiles.filter((profile) => photo.taggedProfiles.includes(profile.$id));

	useEffect(() => {
		createAppwriteServices().databases.listDocuments<CommentDocument>(
			appwriteConfig.databaseId,
			appwriteConfig.commentsCollectionId,
			[Query.equal('photoId', photo.$id), Query.orderAsc('createdAt'), Query.limit(100)],
		).then((result) => setComments(result.documents)).catch((commentError: unknown) => setError(getMessage(commentError)));
	}, [photo.$id]);

	async function submitComment(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!user) return;
		setSaving(true);
		setError('');
		const form = event.currentTarget;
		const data = new FormData(form);
		try {
			const comment = await createAppwriteServices().databases.createDocument<CommentDocument>(
				appwriteConfig.databaseId,
				appwriteConfig.commentsCollectionId,
				ID.unique(),
				{ photoId: photo.$id, authorId: user.$id, authorName: user.name || user.email, content: String(data.get('content') ?? '').trim(), createdAt: new Date().toISOString() },
				[Permission.read(Role.team(appwriteConfig.familyTeamId)), Permission.update(Role.team(appwriteConfig.familyTeamId)), Permission.delete(Role.team(appwriteConfig.familyTeamId))],
			);
			setComments((current) => [...current, comment]);
			form.reset();
		} catch (commentError) {
			setError(getMessage(commentError));
		} finally {
			setSaving(false);
		}
	}

	return (
		<div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
			<section className="modal-card photo-detail-modal" role="dialog" aria-modal="true" aria-label={photo.title || 'Family memory'}>
				<button className="icon-button photo-close" onClick={onClose} aria-label="Close"><AppIcon name="close" /></button>
				<img className="detail-image" src={photoUrl(photo.fileId)} alt={photo.title || `Family memory from ${photo.year}`} />
				<div className="detail-content"><div className="eyebrow">{photo.year} · SHARED WITH LOVE</div><h2>{photo.title || 'A moment together'}</h2><div className="detail-tags">{tagged.map((profile) => <a className="tag-chip" href={`/person/${profile.$id}`} key={profile.$id}>{profile.name}</a>)}</div>
					<div className="comment-section"><h3>Little notes <span>{comments.length}</span></h3>{comments.map((comment) => <div className="comment-row" key={comment.$id}><span className="avatar avatar-small">{initials(comment.authorName)}</span><p><b>{comment.authorName}</b><span>{comment.content}</span></p></div>)}{!comments.length && !error && <p className="muted comment-empty">No notes yet. Leave the first one.</p>}{error && <p className="form-error" role="alert">{error}</p>}
						<form className="comment-form" onSubmit={submitComment}><input name="content" maxLength={2000} required placeholder="Leave a little note…" aria-label="Write a comment" /><button type="submit" disabled={saving} aria-label="Send comment"><AppIcon name="arrow" size={17} /></button></form>
					</div>
				</div>
			</section>
		</div>
	);
}
