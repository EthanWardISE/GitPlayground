import { createSupabaseClient, getSupabaseErrorMessage, PHOTO_BUCKET } from './supabase';
import type { BountyRow, BountySubmissionRow, PhotoDocument, PhotoRow } from '../types/database';

export type BountySubmission = BountySubmissionRow & {
	submitterName: string;
	photo: PhotoDocument;
};

export type Bounty = BountyRow & {
	requesterName: string;
	submissions: BountySubmission[];
};

async function loadBounties(status: BountyRow['status']) {
	const supabase = createSupabaseClient();
	const { data: bountyRows, error: bountyError } = await supabase
		.from('bounties')
		.select('*')
		.eq('status', status)
		.order('created_at', { ascending: false })
		.limit(100);
	if (bountyError) throw bountyError;
	if (!bountyRows.length) return [] as Bounty[];

	const bountyIds = bountyRows.map((bounty) => bounty.id);
	const requesterIds = bountyRows.map((bounty) => bounty.requested_by);
	const { data: submissionRows, error: submissionError } = await supabase
		.from('bounty_submissions')
		.select('*')
		.in('bounty_id', bountyIds)
		.order('created_at', { ascending: true });
	if (submissionError) throw submissionError;

	const userIds = [...new Set([...requesterIds, ...submissionRows.map((submission) => submission.submitted_by)])];
	const { data: members, error: memberError } = await supabase
		.from('family_members')
		.select('user_id, full_name')
		.in('user_id', userIds);
	if (memberError) throw memberError;
	const memberNames = new Map(members.map((member) => [member.user_id, member.full_name]));

	const photoIds = submissionRows.map((submission) => submission.photo_id);
	let photoRows: PhotoRow[] = [];
	if (photoIds.length) {
		const { data, error: photoError } = await supabase.from('photos').select('*').in('id', photoIds);
		if (photoError) throw photoError;
		photoRows = data;
	}
	const photoMap = new Map(photoRows.map((photo) => [photo.id, photo]));
	const submissions = await Promise.all(submissionRows.map(async (submission) => {
		const photo = photoMap.get(submission.photo_id);
		if (!photo) return null;
		const { data: signed, error: signedError } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(photo.file_path, 60 * 60, {
			transform: { width: 900, height: 700, resize: 'cover', quality: 78 },
		});
		if (signedError) throw signedError;
		return {
			...submission,
			submitterName: memberNames.get(submission.submitted_by) ?? 'Family member',
			photo: {
				$id: photo.id,
				title: photo.title ?? undefined,
				fileId: photo.file_path,
				year: photo.year,
				uploadedBy: photo.uploaded_by,
				taggedProfiles: photo.tagged_profiles,
				imageUrl: signed.signedUrl,
			},
		};
	}));
	const submissionMap = new Map<string, BountySubmission[]>();
	for (const submission of submissions) {
		if (!submission) continue;
		const current = submissionMap.get(submission.bounty_id) ?? [];
		current.push(submission);
		submissionMap.set(submission.bounty_id, current);
	}

	return bountyRows.map((bounty) => ({
		...bounty,
		requesterName: memberNames.get(bounty.requested_by) ?? 'Family member',
		submissions: submissionMap.get(bounty.id) ?? [],
	}));
}

export function fetchOpenBounties() {
	return loadBounties('open');
}

export function fetchResolvedBounties() {
	return loadBounties('resolved');
}

export async function submitExistingPhotos(bountyId: string, photoIds: string[], userId: string) {
	const { data, error } = await createSupabaseClient()
		.from('bounty_submissions')
		.insert(photoIds.map((photoId) => ({ bounty_id: bountyId, photo_id: photoId, submitted_by: userId })))
		.select('*');
	if (error) throw error;
	return data;
}

export async function uploadAndSubmitPhotos(
	bountyId: string,
	userId: string,
	files: File[],
	year: number,
	title?: string,
) {
	const supabase = createSupabaseClient();
	const uploadedPaths: string[] = [];
	const photos: PhotoRow[] = [];
	try {
		for (const file of files) {
			const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
			const filePath = `${userId}/bounties/${crypto.randomUUID()}.${extension}`;
			const { error: uploadError } = await supabase.storage.from(PHOTO_BUCKET).upload(filePath, file, { contentType: file.type, upsert: false });
			if (uploadError) throw uploadError;
			uploadedPaths.push(filePath);
			const { data: photo, error: photoError } = await supabase
				.from('photos')
				.insert({ title: title?.trim() || null, file_path: filePath, year, uploaded_by: userId, tagged_profiles: [] })
				.select('*')
				.single();
			if (photoError) throw photoError;
			photos.push(photo);
		}
		const { data: submissions, error: submissionError } = await supabase
			.from('bounty_submissions')
			.insert(photos.map((photo) => ({ bounty_id: bountyId, photo_id: photo.id, submitted_by: userId })))
			.select('*');
		if (submissionError) throw submissionError;
		return { photos, submissions };
	} catch (error) {
		if (uploadedPaths.length) {
			const { error: cleanupError } = await supabase.storage.from(PHOTO_BUCKET).remove(uploadedPaths);
			if (cleanupError) throw new Error(`${getSupabaseErrorMessage(error)} Uploaded files could not be removed automatically (${cleanupError.message}).`);
		}
		throw error;
	}
}

export async function resolveBounty(bountyId: string) {
	const { error } = await createSupabaseClient().rpc('resolve_bounty', { p_bounty_id: bountyId });
	if (error) throw error;
}

export async function createBounty(title: string, description: string, userId: string) {
	const { data, error } = await createSupabaseClient()
		.from('bounties')
		.insert({ title: title.trim(), description: description.trim(), requested_by: userId })
		.select('*')
		.single();
	if (error) throw error;
	return { ...data, requesterName: 'You', submissions: [] } satisfies Bounty;
}

export async function deleteBounty(bountyId: string) {
	const { data, error } = await createSupabaseClient()
		.from('bounties')
		.delete()
		.eq('id', bountyId)
		.select('id')
		.maybeSingle();
	if (error) throw error;
	if (!data) throw new Error('This bounty was not found or you do not have permission to delete it.');
}

export async function createBountyPhotobook(title: string, photoIds: string[], userId: string) {
	const supabase = createSupabaseClient();
	const { data: collection, error: collectionError } = await supabase
		.from('collections')
		.insert({ title, description: 'Memories shared for a family bounty.' })
		.select('*')
		.single();
	if (collectionError) throw collectionError;
	const { error: photosError } = await supabase
		.from('collection_photos')
		.insert(photoIds.map((photoId) => ({ collection_id: collection.id, photo_id: photoId, added_by: userId })));
	if (photosError) throw photosError;
	return collection;
}
