import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBrowserClient } from '@supabase/ssr';
import { configureSupabaseClient, createSupabaseClient, getSupabaseErrorMessage, updateDefaultCountry } from './supabase';

vi.mock('@supabase/ssr', () => ({ createBrowserClient: vi.fn() }));

describe('Supabase helpers', () => {
  beforeEach(() => {
    vi.mocked(createBrowserClient).mockReset();
    configureSupabaseClient({ url: '', publishableKey: '' });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  it.each([
    { url: '', publishableKey: 'key' },
    { url: 'https://example.supabase.co', publishableKey: '' },
  ])('rejects missing configuration: %j', (config) => {
    configureSupabaseClient(config);
    expect(createSupabaseClient).toThrow('Supabase is not configured.');
    expect(createBrowserClient).not.toHaveBeenCalled();
  });
  it('reuses a client until configuration changes', () => {
    const first = {} as ReturnType<typeof createSupabaseClient>;
    const second = {} as ReturnType<typeof createSupabaseClient>;
    vi.mocked(createBrowserClient).mockReturnValueOnce(first).mockReturnValueOnce(second);
    configureSupabaseClient({ url: 'https://one.supabase.co', publishableKey: 'one' });
    expect(createSupabaseClient()).toBe(first);
    expect(createSupabaseClient()).toBe(first);
    expect(createBrowserClient).toHaveBeenCalledTimes(1);
    configureSupabaseClient({ url: 'https://two.supabase.co', publishableKey: 'two' });
    expect(createSupabaseClient()).toBe(second);
    expect(createBrowserClient).toHaveBeenLastCalledWith('https://two.supabase.co', 'two');
  });
  it.each([
    { code: 'PGRST205' }, { code: '42P01' },
    { message: 'bounties missing from schema cache' },
  ])('explains missing database migrations: %j', (error) => {
    expect(getSupabaseErrorMessage(error)).toContain('family database update is missing');
  });
  it.each([new Error('Network failed'), { message: 'Network failed' }])('preserves ordinary error messages', (error) => {
    expect(getSupabaseErrorMessage(error)).toBe('Network failed');
  });
  it('uses fallback messages for unknown errors', () => {
    expect(getSupabaseErrorMessage(null)).toBe('Something went wrong. Please try again.');
    expect(getSupabaseErrorMessage({ message: 42 }, 'Try later')).toBe('Try later');
  });
  it('normalizes country codes and updates only the signed-in user', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ update });
    vi.mocked(createBrowserClient).mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user' } } }) }, from,
    } as unknown as ReturnType<typeof createSupabaseClient>);
    configureSupabaseClient({ url: 'https://example.supabase.co', publishableKey: 'key' });
    await updateDefaultCountry('ie');
    expect(from).toHaveBeenCalledWith('profiles');
    expect(update).toHaveBeenCalledWith({ default_country_code: 'IE' });
    expect(eq).toHaveBeenCalledWith('user_id', 'user');
  });
  it('rejects signed-out country updates without writing', async () => {
    const from = vi.fn();
    vi.mocked(createBrowserClient).mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) }, from,
    } as unknown as ReturnType<typeof createSupabaseClient>);
    configureSupabaseClient({ url: 'https://example.supabase.co', publishableKey: 'key' });
    await expect(updateDefaultCountry('ie')).rejects.toThrow('You must be signed in');
    expect(from).not.toHaveBeenCalled();
  });
});
