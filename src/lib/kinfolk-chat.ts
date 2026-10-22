import { createSupabaseClient } from './supabase';
import type { ReportRow } from '../types/database';

export async function removeChatParticipant(chatId: string, userId: string) {
	const { error } = await createSupabaseClient().rpc('remove_chat_participant', {
		p_chat_id: chatId,
		p_user_id: userId,
	});
	if (error) throw error;
}

export async function addChatParticipant(chatId: string, userId: string, role: 'admin' | 'member' = 'member') {
	const { error } = await createSupabaseClient().rpc('add_chat_participant', {
		p_chat_id: chatId,
		p_user_id: userId,
		p_role: role,
	});
	if (error) throw error;
}

export async function reportChatMessage(messageId: string, reason: string) {
	const { data, error } = await createSupabaseClient().rpc('report_chat_message', { p_message_id: messageId, p_reason: reason });
	if (error) throw error;
	return data;
}

export async function resolveChatReport(reportId: string) {
	const { error } = await createSupabaseClient().rpc('resolve_chat_report', { p_report_id: reportId });
	if (error) throw error;
}

export async function fetchFamilyReports(): Promise<ReportRow[]> {
	const { data, error } = await createSupabaseClient()
		.from('reports')
		.select('*')
		.order('created_at', { ascending: false });
	if (error) throw error;
	return data ?? [];
}
