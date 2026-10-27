import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSupabaseClient } from './supabase';
import { createBounty, deleteBounty, fetchOpenBounties, fetchResolvedBounties, uploadAndSubmitPhotos } from './bounties';

vi.mock('./supabase', async (importOriginal) => ({
  ...await importOriginal<typeof import('./supabase')>(),
  createSupabaseClient: vi.fn(),
}));

// Each query gets its own response; awaiting any point in its fluent chain resolves it.
function query(data: unknown, error: unknown = null) {
  const result = Promise.resolve({ data, error });
  return Object.assign(result, {
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(), insert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
  });
}

describe('bounties', () => {
  const from = vi.fn();
  const upload = vi.fn();
  const remove = vi.fn();
  const createSignedUrl = vi.fn();
  const storageFrom = vi.fn();
  const bounty = { id: 'b1', requested_by: 'requester' };
  const photo = { id: 'p1', file_path: 'photo.jpg', title: null, year: 2000, uploaded_by: 'user', tagged_profiles: [] };
  const submission = { id: 's1', bounty_id: 'b1', photo_id: 'p1', submitted_by: 'user' };
  const files = [new File(['photo'], 'memory.JPG', { type: 'image/jpeg' })];

  beforeEach(() => {
    from.mockReset(); upload.mockReset(); remove.mockReset(); createSignedUrl.mockReset();
    storageFrom.mockReturnValue({ upload, remove, createSignedUrl });
    upload.mockResolvedValue({ error: null });
    remove.mockResolvedValue({ error: null });
    createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://images.example/photo' }, error: null });
    vi.mocked(createSupabaseClient).mockReturnValue({ from, storage: { from: storageFrom } } as unknown as ReturnType<typeof createSupabaseClient>);
  });

  it.each([[fetchOpenBounties, 'open'], [fetchResolvedBounties, 'resolved']] as const)('returns empty results for %s', async (fetch, status) => {
    const request = query([]);
    from.mockReturnValueOnce(request);
    expect(await fetch()).toEqual([]);
    expect(request.eq).toHaveBeenCalledWith('status', status);
    expect(from).toHaveBeenCalledTimes(1);
  });
  it('groups submissions with names and signed photo URLs, preserving empty bounties', async () => {
    from.mockReturnValueOnce(query([bounty, { id: 'b2', requested_by: 'unknown' }]))
      .mockReturnValueOnce(query([submission]))
      .mockReturnValueOnce(query([{ user_id: 'requester', full_name: 'Alex' }, { user_id: 'user', full_name: 'Sam' }]))
      .mockReturnValueOnce(query([photo]));
    const result = await fetchOpenBounties();
    expect(result[0]).toMatchObject({ requesterName: 'Alex', submissions: [{ submitterName: 'Sam', photo: { $id: 'p1', imageUrl: 'https://images.example/photo', title: undefined } }] });
    expect(result[1]).toMatchObject({ requesterName: 'Family member', submissions: [] });
    expect(createSignedUrl).toHaveBeenCalledWith('photo.jpg', 3600, expect.any(Object));
  });
  it('skips submissions whose photos no longer exist and uses fallback names', async () => {
    from.mockReturnValueOnce(query([bounty])).mockReturnValueOnce(query([submission, { ...submission, id: 's2', photo_id: 'missing' }]))
      .mockReturnValueOnce(query([])).mockReturnValueOnce(query([photo]));
    const result = await fetchOpenBounties();
    expect(result[0].submissions).toHaveLength(1);
    expect(result[0].submissions[0].submitterName).toBe('Family member');
    expect(createSignedUrl).toHaveBeenCalledTimes(1);
  });
  it('propagates query errors', async () => {
    const error = new Error('Database unavailable');
    from.mockReturnValueOnce(query(null, error));
    await expect(fetchOpenBounties()).rejects.toBe(error);
  });
  it('propagates signed URL failures', async () => {
    const error = new Error('Signing failed');
    from.mockReturnValueOnce(query([bounty])).mockReturnValueOnce(query([submission]))
      .mockReturnValueOnce(query([])).mockReturnValueOnce(query([photo]));
    createSignedUrl.mockResolvedValueOnce({ error });
    await expect(fetchOpenBounties()).rejects.toBe(error);
  });
  it('uploads photos and submits their saved IDs with trimmed metadata', async () => {
    const photoInsert = query(photo);
    const submissionInsert = query([submission]);
    from.mockReturnValueOnce(photoInsert).mockReturnValueOnce(submissionInsert);
    expect(await uploadAndSubmitPhotos('b1', 'user', 'family', files, 2000, ' Memory ')).toEqual({ photos: [photo], submissions: [submission] });
    const path = upload.mock.calls[0][0];
    expect(path).toMatch(/^families\/family\/bounties\/user\/.+\.jpg$/);
    expect(photoInsert.insert).toHaveBeenCalledWith({ title: 'Memory', file_path: path, year: 2000, uploaded_by: 'user', tagged_profiles: [] });
    expect(submissionInsert.insert).toHaveBeenCalledWith([{ bounty_id: 'b1', photo_id: 'p1', submitted_by: 'user' }]);
    expect(remove).not.toHaveBeenCalled();
  });
  it('does not clean up a file that never uploaded', async () => {
    const error = new Error('Upload failed');
    upload.mockResolvedValueOnce({ error });
    await expect(uploadAndSubmitPhotos('b1', 'user', 'family', files, 2000)).rejects.toBe(error);
    expect(remove).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });
  it('cleans earlier uploads when a later upload fails', async () => {
    const error = new Error('Second upload failed');
    upload.mockResolvedValueOnce({ error: null }).mockResolvedValueOnce({ error });
    from.mockReturnValueOnce(query(photo));
    await expect(uploadAndSubmitPhotos('b1', 'user', 'family', [...files, ...files], 2000)).rejects.toBe(error);
    expect(remove).toHaveBeenCalledWith([upload.mock.calls[0][0]]);
  });
  it('cleans uploaded files when saving photo metadata fails', async () => {
    const error = new Error('Photo insert failed');
    from.mockReturnValueOnce(query(null, error));
    await expect(uploadAndSubmitPhotos('b1', 'user', 'family', files, 2000)).rejects.toBe(error);
    expect(remove).toHaveBeenCalledWith([upload.mock.calls[0][0]]);
  });
  it('cleans all uploaded files when creating submissions fails', async () => {
    const error = new Error('Submission insert failed');
    from.mockReturnValueOnce(query(photo)).mockReturnValueOnce(query({ ...photo, id: 'p2' })).mockReturnValueOnce(query(null, error));
    await expect(uploadAndSubmitPhotos('b1', 'user', 'family', [...files, ...files], 2000)).rejects.toBe(error);
    expect(remove).toHaveBeenCalledWith(upload.mock.calls.map(([path]) => path));
  });
  it('reports both the original failure and failed cleanup', async () => {
    from.mockReturnValueOnce(query(null, new Error('Photo insert failed')));
    remove.mockResolvedValueOnce({ error: { message: 'Storage unavailable' } });
    await expect(uploadAndSubmitPhotos('b1', 'user', 'family', files, 2000)).rejects.toThrow('Photo insert failed Uploaded files could not be removed automatically (Storage unavailable).');
  });
  it('trims bounty content before saving', async () => {
    const request = query(bounty);
    from.mockReturnValueOnce(request);
    expect(await createBounty(' Title ', ' Description ', 'user')).toMatchObject({ requesterName: 'You', submissions: [] });
    expect(request.insert).toHaveBeenCalledWith({ title: 'Title', description: 'Description', requested_by: 'user' });
  });
  it('reports a deletion that removed no accessible bounty', async () => {
    from.mockReturnValueOnce(query(null));
    await expect(deleteBounty('b1')).rejects.toThrow('not found or you do not have permission');
  });
  it('propagates deletion errors', async () => {
    const error = new Error('Delete failed');
    from.mockReturnValueOnce(query(null, error));
    await expect(deleteBounty('b1')).rejects.toBe(error);
  });
});
