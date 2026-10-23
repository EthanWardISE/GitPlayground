import { useEffect, useState } from 'react';
import { createSupabaseClient, getSupabaseErrorMessage } from '../lib/supabase';
import { resolveChatReport } from '../lib/kinfolk-chat';
import type { ReportRow } from '../types/database';

type ReportItem = ReportRow & { message: { content: string; sender_id: string; created_at: string } | null };

export default function ReportReviewPanel({ familyId }: { familyId: string }) {
	const [tab, setTab] = useState<'incoming' | 'resolved'>('incoming');
	const [reports, setReports] = useState<ReportItem[]>([]);
	const [error, setError] = useState('');

	async function loadReports() {
		try {
			const { data, error: loadError } = await createSupabaseClient().from('reports').select('*, message:messages(content, sender_id, created_at)').eq('family_id', familyId).order('created_at', { ascending: false });
			if (loadError) throw loadError;
			setReports((data ?? []) as ReportItem[]);
		} catch (loadError) {
			setError(getSupabaseErrorMessage(loadError, 'Could not load message reports.'));
		}
	}

	useEffect(() => { void loadReports(); }, [familyId]);
	const visible = reports.filter((report) => tab === 'resolved' ? report.status === 'resolved' : report.status !== 'resolved');

	async function resolve(reportId: string) {
		try {
			await resolveChatReport(reportId);
			setReports((current) => current.map((report) => report.id === reportId ? { ...report, status: 'resolved' } : report));
		} catch (resolveError) {
			setError(getSupabaseErrorMessage(resolveError, 'Could not resolve this report.'));
		}
	}

	return <section className="claim-review-panel report-review-panel"><div className="claim-review-heading"><strong>Message reports</strong><small>Review concerns raised by family members.</small></div><div className="report-tabs"><button type="button" className={tab === 'incoming' ? 'active' : ''} onClick={() => setTab('incoming')}>Incoming</button><button type="button" className={tab === 'resolved' ? 'active' : ''} onClick={() => setTab('resolved')}>Resolved</button></div>{error && <p className="form-error">{error}</p>}{visible.length ? visible.map((report) => <article className="report-review-row" key={report.id}><div><strong>{report.reason}</strong><p>{report.message?.content || 'Message content unavailable'}</p><small>{new Date(report.created_at).toLocaleString()}</small></div>{tab === 'incoming' && <button type="button" className="button button-primary button-small" onClick={() => void resolve(report.id)}>Resolved</button>}</article>) : <p className="muted">No {tab} reports.</p>}</section>;
}
