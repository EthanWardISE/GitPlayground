import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { createSupabaseClient, getSupabaseErrorMessage, PHOTO_BUCKET } from '../lib/supabase';
import type { CollectionRow, PhotoDocument, ProfileDocument } from '../types/database';
import { getCountries } from '../lib/countries';
import PhotoUploadPreview from './PhotoUploadPreview';

type CollectionPhoto = { collection_id: string; photo_id: string };

export default function CollectionsPanel({
	collectionId,
	familyId,
	profiles,
	photos,
	onOpenPhoto,
	onPhotoAdded,
}: {
	collectionId?: string;
	familyId: string;
	profiles: ProfileDocument[];
	photos: PhotoDocument[];
	onOpenPhoto: (photo: PhotoDocument) => void;
	onPhotoAdded?: () => Promise<void>;
}) {
	const [collections, setCollections] = useState<CollectionRow[]>([]);
	const [memberships, setMemberships] = useState<CollectionPhoto[]>([]);
	const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
	const [selectedPeople, setSelectedPeople] = useState<string[]>([]);
	const [photoToAdd, setPhotoToAdd] = useState('');
	const [newTitle, setNewTitle] = useState('');
	const [newDescription, setNewDescription] = useState('');
	const [newCountry, setNewCountry] = useState('');
	const [uploadFiles, setUploadFiles] = useState<File[]>([]);
	const [uploadTitle, setUploadTitle] = useState('');
	const [uploadYear, setUploadYear] = useState(String(new Date().getFullYear()));
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState('');

	const activeCollection = collections.find((collection) => collection.id === collectionId);
	const collectionPhotoIds = useMemo(
		() => new Set(memberships.filter((item) => item.collection_id === collectionId).map((item) => item.photo_id)),
		[memberships, collectionId],
	);
	const availablePhotos = photos.filter((photo) => collectionPhotoIds.has(photo.$id));
	const visiblePhotos = availablePhotos.filter((photo) =>
		selectedPeople.length === 0 || selectedPeople.some((id) => photo.taggedProfiles.includes(id)),
	);
	const candidates = photos.filter((photo) => !collectionPhotoIds.has(photo.$id));
	const coverPhoto = activeCollection?.cover_photo_id
		? photos.find((photo) => photo.$id === activeCollection.cover_photo_id)
		: undefined;

	useEffect(() => {
		let cancelled = false;
		async function load() {
			setLoading(true);
			setError('');
			try {
				const supabase = createSupabaseClient();
				const [collectionResult, membershipResult] = await Promise.all([
					supabase.from('collections').select('*').order('updated_at', { ascending: false }).limit(100),
					supabase.from('collection_photos').select('collection_id, photo_id').limit(5000),
				]);
				if (collectionResult.error) throw collectionResult.error;
				if (membershipResult.error) throw membershipResult.error;

				const thumbnailEntries = await Promise.all(photos.map(async (photo) => {
					const { data, error: thumbnailError } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(
						photo.fileId,
						60 * 60,
						{ transform: { width: 520, height: 420, resize: 'cover', quality: 76 } },
					);
					if (thumbnailError) throw thumbnailError;
					return [photo.$id, data.signedUrl] as const;
				}));
				if (!cancelled) {
					setCollections(collectionResult.data);
					setMemberships(membershipResult.data);
					setThumbnails(Object.fromEntries(thumbnailEntries));
					if (collectionId && !collectionResult.data.some((collection) => collection.id === collectionId)) {
						setError('This collection could not be found.');
					}
				}
			} catch (loadError) {
				if (!cancelled) setError(getSupabaseErrorMessage(loadError, 'Could not load collections.'));
			} finally {
				if (!cancelled) setLoading(false);
			}
		}
		void load();
		return () => { cancelled = true; };
	}, [collectionId, photos]);

	async function createCollection(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setSaving(true);
		setError('');
		try {
			const { data, error: createError } = await createSupabaseClient()
				.from('collections')
				.insert({
					title: newTitle.trim(),
					description: newDescription.trim() || null,
					country_code: newCountry || null,
				})
				.select('*')
				.single();
			if (createError) throw createError;
			setCollections((current) => [data, ...current]);
			setNewTitle('');
			setNewDescription('');
			setNewCountry('');
			window.location.assign(`/collections/${data.id}`);
		} catch (createError) {
			setError(getSupabaseErrorMessage(createError, 'Could not create the collection.'));
		} finally {
			setSaving(false);
		}
	}

	async function addPhoto() {
		if (!collectionId || !photoToAdd) return;
		setSaving(true);
		setError('');
		try {
			const { error: addError } = await createSupabaseClient().from('collection_photos').insert({
				collection_id: collectionId,
				photo_id: photoToAdd,
			});
			if (addError) throw addError;
			setMemberships((current) => [...current, { collection_id: collectionId, photo_id: photoToAdd }]);
			setPhotoToAdd('');
		} catch (addError) {
			setError(getSupabaseErrorMessage(addError, 'Could not add the photo.'));
		} finally {
			setSaving(false);
		}
	}

	async function uploadPhoto(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!collectionId || !activeCollection || !uploadFiles.length) return;
		setSaving(true);
		setError('');
		const extensionByType: Record<string, string> = {
			'image/jpeg': 'jpg',
			'image/png': 'png',
			'image/webp': 'webp',
			'image/gif': 'gif',
			'image/avif': 'avif',
		};
		const supabase = createSupabaseClient();
		const uploadedPaths: string[] = [];
		const photoIds: string[] = [];
		try {
			for (const file of uploadFiles) {
				const extension = extensionByType[file.type];
				if (!extension) throw new Error('Choose JPEG, PNG, WebP, GIF, or AVIF images only.');
				if (file.size > 50 * 1024 * 1024) throw new Error(`"${file.name}" is larger than 50 MiB.`);
			}
			const { data: userData, error: userError } = await supabase.auth.getUser();
			if (userError) throw userError;
			if (!userData.user) throw new Error('Your session expired. Sign in again before uploading.');

			for (const file of uploadFiles) {
				const extension = extensionByType[file.type];
				const filePath = `families/${familyId}/photos/${userData.user.id}/${crypto.randomUUID()}.${extension}`;
				const { error: storageError } = await supabase.storage.from(PHOTO_BUCKET).upload(filePath, file, {
					contentType: file.type,
					upsert: false,
				});
				if (storageError) throw storageError;
				uploadedPaths.push(filePath);
				const { data: photo, error: photoError } = await supabase.from('photos').insert({
					title: uploadTitle.trim() || null,
					file_path: filePath,
					year: Number(uploadYear),
					uploaded_by: userData.user.id,
					tagged_profiles: [],
					country_code: activeCollection.country_code,
				}).select('*').single();
				if (photoError) throw photoError;
				photoIds.push(photo.id);
				const { error: membershipError } = await supabase.from('collection_photos').insert({
					collection_id: collectionId,
					photo_id: photo.id,
				});
				if (membershipError) throw membershipError;
			}
			if (onPhotoAdded) await onPhotoAdded();
			setUploadFiles([]);
			setUploadTitle('');
			setUploadYear(String(new Date().getFullYear()));
		} catch (uploadError) {
			let message = getSupabaseErrorMessage(uploadError, 'Could not add the photos to this photobook.');
			if (photoIds.length) {
				const { error: membershipCleanupError } = await supabase
					.from('collection_photos')
					.delete()
					.in('photo_id', photoIds);
				if (membershipCleanupError) message += ` Cleanup failed: ${membershipCleanupError.message}`;
				const { error: photoCleanupError } = await supabase.from('photos').delete().in('id', photoIds);
				if (photoCleanupError) message += ` Photo cleanup failed: ${photoCleanupError.message}`;
			}
			if (uploadedPaths.length) {
				const { error: storageCleanupError } = await supabase.storage.from(PHOTO_BUCKET).remove(uploadedPaths);
				if (storageCleanupError) message += ` Storage cleanup failed: ${storageCleanupError.message}`;
			}
			setError(message);
		} finally {
			setSaving(false);
		}
	}

	async function removePhoto(photoId: string) {
		if (!collectionId) return;
		setSaving(true);
		setError('');
		try {
			if (activeCollection?.cover_photo_id === photoId) {
				const { error: coverError } = await createSupabaseClient().rpc('set_collection_cover', {
					p_collection_id: collectionId,
					p_photo_id: null,
				});
				if (coverError) throw coverError;
				setCollections((current) => current.map((collection) =>
					collection.id === collectionId ? { ...collection, cover_photo_id: null } : collection,
				));
			}
			const { error: removeError } = await createSupabaseClient()
				.from('collection_photos')
				.delete()
				.eq('collection_id', collectionId)
				.eq('photo_id', photoId);
			if (removeError) throw removeError;
			setMemberships((current) => current.filter((item) => !(item.collection_id === collectionId && item.photo_id === photoId)));
		} catch (removeError) {
			setError(getSupabaseErrorMessage(removeError, 'Could not remove the photo.'));
		} finally {
			setSaving(false);
		}
	}

	async function setCover(photoId: string) {
		if (!collectionId) return;
		setSaving(true);
		setError('');
		try {
			const { error: coverError } = await createSupabaseClient().rpc('set_collection_cover', {
				p_collection_id: collectionId,
				p_photo_id: photoId || null,
			});
			if (coverError) throw coverError;
			setCollections((current) => current.map((collection) =>
				collection.id === collectionId ? { ...collection, cover_photo_id: photoId || null } : collection,
			));
		} catch (coverError) {
			setError(getSupabaseErrorMessage(coverError, 'Could not update the cover photo.'));
		} finally {
			setSaving(false);
		}
	}

	async function deleteCollection(collection: CollectionRow) {
		if (!window.confirm(`Delete the photobook “${collection.title}”? Its photos will remain in the family album.`)) return;
		setSaving(true);
		setError('');
		try {
			const { data, error: deleteError } = await createSupabaseClient()
				.from('collections')
				.delete()
				.eq('id', collection.id)
				.select('id');
			if (deleteError) throw deleteError;
			if (!data.length) throw new Error('Could not delete this photobook. Check your family access and try again.');
			setCollections((current) => current.filter((item) => item.id !== collection.id));
			setMemberships((current) => current.filter((item) => item.collection_id !== collection.id));
			if (collection.id === collectionId) window.location.assign('/collections');
		} catch (deleteError) {
			setError(getSupabaseErrorMessage(deleteError, 'Could not delete the photobook.'));
		} finally {
			setSaving(false);
		}
	}

	function clearPeopleFilter() {
		setSelectedPeople([]);
	}

	if (loading) return <section className="page-body"><p className="muted">Opening the family photobooks…</p></section>;

	return (
		<section className="page-body collections-page">
			{error && <p className="form-error collection-error" role="alert">{error}</p>}
			{!collectionId ? (
				<>
					<div className="page-heading">
						<div><div className="eyebrow">Little chapters of your story</div><h1>Family photobooks</h1><p className="muted">Gather memories together, wherever they were first shared.</p></div>
					</div>
					{collections.length > 0 && <div className="collection-grid">
						{collections.map((collection) => {
							const collectionCover = collection.cover_photo_id
								? photos.find((photo) => photo.$id === collection.cover_photo_id)
								: undefined;
							const count = memberships.filter((item) => item.collection_id === collection.id).length;
							return (
								<article className="collection-card" key={collection.id}>
									<a className="collection-card-link" href={`/collections/${collection.id}`}>
										{collectionCover && thumbnails[collectionCover.$id]
											? <img src={thumbnails[collectionCover.$id]} alt="" loading="lazy" />
											: <span className="collection-placeholder">A story, still unfolding</span>}
										<span className="collection-card-copy"><strong>{collection.title}</strong><small>{count} {count === 1 ? 'memory' : 'memories'}</small></span>
									</a>
									<button className="text-link collection-delete" type="button" onClick={() => void deleteCollection(collection)} disabled={saving}>Delete photobook</button>
								</article>
							);
						})}
					</div>}
					<form className="collection-create" onSubmit={createCollection}>
						<div><p className="eyebrow">Start a new chapter</p><h2>Create a photobook</h2></div>
						<label>Collection name<input value={newTitle} onChange={(event) => setNewTitle(event.target.value)} maxLength={120} required placeholder="France, summer 2016" /></label>
						<label>A note (optional)<input value={newDescription} onChange={(event) => setNewDescription(event.target.value)} placeholder="A week we still talk about" /></label>
						<label className="country-dropdown">Country (optional)<select value={newCountry} onChange={(event) => setNewCountry(event.target.value)}><option value="">No country selected</option>{getCountries().map((country) => <option key={country.code} value={country.code}>{country.name}</option>)}</select></label>
						<button className="button button-primary" disabled={saving}>{saving ? 'Creating…' : 'Create collection'}</button>
					</form>
				</>
			) : activeCollection ? (
				<>
					<a className="back-link" href="/collections">← All photobooks</a>
					<div className="collection-hero" style={coverPhoto && thumbnails[coverPhoto.$id] ? { backgroundImage: `linear-gradient(90deg, #2f3029b8, #2f302900), url("${thumbnails[coverPhoto.$id]}")` } : undefined}>
						<p className="eyebrow">Collected together</p>
						<h1>{activeCollection.title}</h1>
						{activeCollection.description && <p>{activeCollection.description}</p>}
					</div>
					<div className="collection-management"><button className="button button-danger button-small" type="button" onClick={() => void deleteCollection(activeCollection)} disabled={saving}>Delete photobook</button><span className="muted">Deleting a book never deletes its photos from the family album.</span></div>
					<div className="collection-tools">
						<label className="filter-select">Cover photo
							<select value={activeCollection.cover_photo_id ?? ''} onChange={(event) => void setCover(event.target.value)} disabled={saving}>
								<option value="">No cover yet</option>
								{availablePhotos.map((photo) => <option value={photo.$id} key={photo.$id}>{photo.title || `Memory from ${photo.year}`}</option>)}
							</select>
						</label>
						<label className="filter-select">Add a memory
							<select value={photoToAdd} onChange={(event) => setPhotoToAdd(event.target.value)}>
								<option value="">Choose from the family album</option>
								{candidates.map((photo) => <option value={photo.$id} key={photo.$id}>{photo.title || `Memory from ${photo.year}`}</option>)}
							</select>
						</label>
						<button className="button button-quiet" type="button" disabled={!photoToAdd || saving} onClick={() => void addPhoto()}>Add photo</button>
						<details className="person-filter collection-filter">
							<summary>{selectedPeople.length ? `${selectedPeople.length} people` : 'Filter by people'} <span aria-hidden="true">⌄</span></summary>
							<div className="filter-popover">{profiles.map((profile) => <label key={profile.$id}><input type="checkbox" checked={selectedPeople.includes(profile.$id)} onChange={() => setSelectedPeople((current) => current.includes(profile.$id) ? current.filter((id) => id !== profile.$id) : [...current, profile.$id])} />{profile.name}</label>)}</div>
						</details>
						{selectedPeople.length > 0 && <button className="text-link" type="button" onClick={clearPeopleFilter}>Clear people filter</button>}
					</div>
					<form className="collection-upload" onSubmit={(event) => void uploadPhoto(event)}>
						<div><p className="eyebrow">Add a new memory</p><h2>Upload directly to this photobook</h2><p className="muted">This photo will also appear in the family album and use {activeCollection.country_code ? 'this photobook’s country' : 'your default country'}.</p></div>
						<label className="photo-upload-field">Photos<input type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,image/avif" required onChange={(event) => setUploadFiles(Array.from(event.target.files ?? []))} /><PhotoUploadPreview files={uploadFiles} /></label>
						<label>Title (optional)<input value={uploadTitle} onChange={(event) => setUploadTitle(event.target.value)} placeholder="A day to remember" /></label>
						<label>Year<input type="number" min="1800" max={new Date().getFullYear()} value={uploadYear} onChange={(event) => setUploadYear(event.target.value)} required /></label>
						<button className="button button-primary" type="submit" disabled={!uploadFiles.length || saving}>{saving ? `Uploading ${uploadFiles.length} photos…` : `Upload ${uploadFiles.length || ''} photo${uploadFiles.length === 1 ? '' : 's'} to photobook`}</button>
					</form>
					{visiblePhotos.length ? <div className="photo-grid collection-photo-grid">
						{visiblePhotos.map((photo) => (
							<article className="collection-photo-card" key={photo.$id}>
								<button className="photo-card" onClick={() => onOpenPhoto(photo)}>
									<span className="photo-image-wrap"><img src={thumbnails[photo.$id] ?? photo.imageUrl} alt={photo.title || `Family memory from ${photo.year}`} loading="lazy" /><span className="photo-year">{photo.year}</span></span>
									<span className="photo-card-content"><span className="photo-title">{photo.title || 'A moment together'}</span></span>
								</button>
								<button className="text-link collection-remove" type="button" onClick={() => void removePhoto(photo.$id)} disabled={saving}>Remove from book</button>
							</article>
						))}
					</div> : <div className="empty-state"><h3>{availablePhotos.length ? 'No memories match those people' : 'This photobook is ready for memories'}</h3><p>{availablePhotos.length ? 'Try adjusting the people filter.' : 'Any family member can add a photo from the album above.'}</p></div>}
				</>
			) : <div className="empty-state"><h3>We can’t find this photobook</h3><a className="button button-primary" href="/collections">Back to photobooks</a></div>}
		</section>
	);
}
