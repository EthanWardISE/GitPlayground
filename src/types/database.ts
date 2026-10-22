export type Json =
	| string
	| number
	| boolean
	| null
	| { [key: string]: Json | undefined }
	| Json[];

export type FamilyRow = {
	id: string;
	name: string;
	created_by: string;
	created_at: string;
};

export type FamilyMemberRow = {
	family_id: string;
	user_id: string;
	full_name: string;
	role: 'admin' | 'member';
	created_at: string;
};

export type ProfileRow = {
	id: string;
	family_id: string;
	name: string;
	avatar_file_path: string | null;
	bio: string | null;
	birth_year: number | null;
	user_id: string | null;
	birth_date: string | null;
	created_at: string;
	default_country_code: string;
};

export type PhotoRow = {
	id: string;
	family_id: string;
	title: string | null;
	file_path: string;
	year: number;
	uploaded_by: string;
	tagged_profiles: string[];
	created_at: string;
	country_code: string | null;
};

export type CommentRow = {
	id: string;
	family_id: string;
	photo_id: string;
	author_id: string;
	author_name: string;
	content: string;
	created_at: string;
};

export type BountyRow = {
	id: string;
	family_id: string;
	title: string;
	description: string;
	status: 'open' | 'resolved';
	requested_by: string;
	created_at: string;
	resolved_at: string | null;
};

export type BountySubmissionRow = {
	id: string;
	family_id: string;
	bounty_id: string;
	photo_id: string;
	submitted_by: string;
	created_at: string;
};

export type PersonRelationshipRow = {
	id: string;
	family_id: string;
	person_a: string;
	person_b: string;
	relationship_type: 'parent' | 'step_parent' | 'guardian' | 'spouse' | 'sibling';
	connection_source: string | null;
	source_handle: string | null;
	target_handle: string | null;
	started_on: string | null;
	ended_on: string | null;
	created_by: string | null;
	created_at: string;
};

export type TreePositionRow = {
	family_id: string;
	profile_id: string;
	x: number;
	y: number;
	updated_by: string;
	updated_at: string;
	country_code: string | null;
};

export type ResolvedPhotoRow = PhotoRow & {
	country_source: 'photo' | 'collection' | 'profile';
};

export type CollectionRow = {
	id: string;
	family_id: string;
	title: string;
	description: string | null;
	cover_photo_id: string | null;
	created_by: string;
	created_at: string;
	updated_at: string;
};

export type CollectionPhotoRow = {
	family_id: string;
	collection_id: string;
	photo_id: string;
	added_by: string;
	added_at: string;
};

export type ProfileClaimRequestRow = {
	id: string;
	family_id: string;
	profile_id: string;
	claimant_id: string;
	status: 'pending' | 'approved' | 'rejected';
	reviewed_by: string | null;
	reviewed_at: string | null;
	created_at: string;
};

export type ChatRow = {
	id: string;
	family_id: string;
	type: 'direct' | 'group';
	name: string | null;
	created_by: string;
	created_at: string;
};

export type ChatParticipantRow = {
	chat_id: string;
	user_id: string;
	role: 'admin' | 'member';
	joined_at: string;
};

export type MessageRow = {
	id: string;
	chat_id: string;
	sender_id: string;
	content: string;
	attached_photo_id: string | null;
	is_deleted: boolean;
	created_at: string;
};

export type MessageReadRow = {
	message_id: string;
	user_id: string;
	read_at: string;
};

export type MessageReactionEmoji = '❤️' | '😂' | '😊' | '😮' | '😢' | '👏' | '🙏' | '🎉';

export type MessageReactionRow = {
	message_id: string;
	user_id: string;
	emoji: MessageReactionEmoji;
	created_at: string;
};

export type ReportRow = {
	id: string;
	message_id: string;
	reported_by: string;
	family_id: string;
	reason: string;
	status: 'open' | 'reviewed' | 'dismissed' | 'resolved';
	created_at: string;
};

export interface ProfileDocument {
	$id: string;
	name: string;
	avatarFileId?: string;
	avatarUrl?: string;
	birthYear?: number;
	userId?: string;
	birthDate?: string;
	bio?: string;
}

export interface PhotoDocument {
	$id: string;
	title?: string;
	fileId: string;
	year: number;
	uploadedBy: string;
	taggedProfiles: string[];
	countryCode?: string;
	imageUrl: string;
}

export interface CommentDocument {
	$id: string;
	photoId: string;
	authorId: string;
	authorName: string;
	content: string;
	createdAt: string;
}

export interface Database {
	public: {
		Tables: {
			family_members: {
				Row: FamilyMemberRow;
				Insert: {
					family_id: string;
					user_id: string;
					full_name: string;
					role?: 'admin' | 'member';
					created_at?: string;
				};
				Update: Partial<Database['public']['Tables']['family_members']['Insert']>;
				Relationships: [];
			};
			families: {
				Row: FamilyRow;
				Insert: {
					family_id?: string;
					id?: string;
					name: string;
					created_by: string;
					created_at?: string;
				};
				Update: Partial<Database['public']['Tables']['families']['Insert']>;
				Relationships: [];
			};
			user_family_context: {
				Row: {
					user_id: string;
					family_id: string;
					updated_at: string;
				};
				Insert: {
					user_id: string;
					family_id: string;
					updated_at?: string;
				};
				Update: Partial<Database['public']['Tables']['user_family_context']['Insert']>;
				Relationships: [];
			};
			profiles: {
				Row: ProfileRow;
				Insert: {
					family_id?: string;
					id?: string;
					name: string;
					avatar_file_path?: string | null;
					bio?: string | null;
					birth_year?: number | null;
					user_id?: string | null;
					birth_date?: string | null;
					created_at?: string;
					default_country_code?: string;
				};
				Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
				Relationships: [];
			};
			photos: {
				Row: PhotoRow;
				Insert: {
					family_id?: string;
					id?: string;
					title?: string | null;
					file_path: string;
					year: number;
					uploaded_by: string;
					tagged_profiles?: string[];
					created_at?: string;
					country_code?: string | null;
				};
				Update: Partial<Database['public']['Tables']['photos']['Insert']>;
				Relationships: [];
			};
			comments: {
				Row: CommentRow;
				Insert: {
					family_id?: string;
					id?: string;
					photo_id: string;
					author_id: string;
					author_name: string;
					content: string;
					created_at?: string;
				};
				Update: Partial<Database['public']['Tables']['comments']['Insert']>;
				Relationships: [];
			};
			bounties: {
				Row: BountyRow;
				Insert: {
					family_id?: string;
					id?: string;
					title: string;
					description: string;
					status?: BountyRow['status'];
					requested_by: string;
					created_at?: string;
					resolved_at?: string | null;
				};
				Update: Partial<Database['public']['Tables']['bounties']['Insert']>;
				Relationships: [];
			};
			bounty_submissions: {
				Row: BountySubmissionRow;
				Insert: {
					family_id?: string;
					id?: string;
					bounty_id: string;
					photo_id: string;
					submitted_by: string;
					created_at?: string;
				};
				Update: Partial<Database['public']['Tables']['bounty_submissions']['Insert']>;
				Relationships: [];
			};
			person_relationships: {
				Row: PersonRelationshipRow;
				Insert: {
					family_id?: string;
					id?: string;
					person_a: string;
					person_b: string;
					relationship_type: PersonRelationshipRow['relationship_type'];
					connection_source?: string | null;
					source_handle?: string | null;
					target_handle?: string | null;
					started_on?: string | null;
					ended_on?: string | null;
					created_by?: string | null;
					created_at?: string;
				};
				Update: Partial<Database['public']['Tables']['person_relationships']['Insert']>;
				Relationships: [];
			};
			tree_positions: {
				Row: TreePositionRow;
				Insert: {
					profile_id: string;
					x: number;
					y: number;
					updated_by?: string;
					updated_at?: string;
					country_code?: string | null;
				};
				Update: Partial<Database['public']['Tables']['tree_positions']['Insert']>;
				Relationships: [];
			};
			profile_claim_requests: {
				Row: ProfileClaimRequestRow;
				Insert: {
					family_id?: string;
					id?: string;
					profile_id: string;
					claimant_id: string;
					status?: ProfileClaimRequestRow['status'];
					reviewed_by?: string | null;
					reviewed_at?: string | null;
					created_at?: string;
				};
				Update: Partial<Database['public']['Tables']['profile_claim_requests']['Insert']>;
				Relationships: [];
			};
			collections: {
				Row: CollectionRow;
				Insert: {
					family_id?: string;
					id?: string;
					title: string;
					description?: string | null;
					cover_photo_id?: string | null;
					created_by?: string;
					created_at?: string;
					updated_at?: string;
				};
				Update: Partial<Database['public']['Tables']['collections']['Insert']>;
				Relationships: [];
			};
			collection_photos: {
				Row: CollectionPhotoRow;
				Insert: {
					family_id?: string;
					collection_id: string;
					photo_id: string;
					added_by?: string;
					added_at?: string;
				};
				Update: Partial<Database['public']['Tables']['collection_photos']['Insert']>;
				Relationships: [];
			};
			chats: {
				Row: ChatRow;
				Insert: {
					id?: string;
					family_id: string;
					type: ChatRow['type'];
					name?: string | null;
					created_by: string;
					created_at?: string;
				};
				Update: Partial<Database['public']['Tables']['chats']['Insert']>;
				Relationships: [];
			};
			chat_participants: {
				Row: ChatParticipantRow;
				Insert: {
					chat_id: string;
					user_id: string;
					role?: ChatParticipantRow['role'];
					joined_at?: string;
				};
				Update: Partial<Database['public']['Tables']['chat_participants']['Insert']>;
				Relationships: [];
			};
			messages: {
				Row: MessageRow;
				Insert: {
					id?: string;
					chat_id: string;
					sender_id: string;
					content: string;
					attached_photo_id?: string | null;
					is_deleted?: boolean;
					created_at?: string;
				};
				Update: Partial<Database['public']['Tables']['messages']['Insert']>;
				Relationships: [];
			};
			message_reads: {
				Row: MessageReadRow;
				Insert: MessageReadRow;
				Update: Partial<MessageReadRow>;
				Relationships: [];
			};
			message_reactions: {
				Row: MessageReactionRow;
				Insert: MessageReactionRow;
				Update: Partial<MessageReactionRow>;
				Relationships: [];
			};
			reports: {
				Row: ReportRow;
				Insert: {
					id?: string;
					message_id: string;
					reported_by: string;
					family_id: string;
					status?: ReportRow['status'];
					created_at?: string;
				};
				Update: Partial<Database['public']['Tables']['reports']['Insert']>;
				Relationships: [];
			};
		};
		Views: { [_ in never]: never };
		Functions: {
			get_photos_with_resolved_country: {
				Args: Record<string, never>;
				Returns: ResolvedPhotoRow[];
			};
			request_profile_claim: {
				Args: { p_profile_id: string };
				Returns: string;
			};
			review_profile_claim: {
				Args: { p_request_id: string; p_approve: boolean };
				Returns: undefined;
			};
			set_profile_avatar: {
				Args: { p_profile_id: string; p_source_photo_id: string | null; p_avatar_path: string };
				Returns: undefined;
			};
			clear_profile_avatar: {
				Args: { p_profile_id: string };
				Returns: string | null;
			};
			update_my_profile_bio: {
				Args: { p_bio: string | null };
				Returns: undefined;
			};
			set_collection_cover: {
				Args: { p_collection_id: string; p_photo_id: string | null };
				Returns: undefined;
			};
			resolve_bounty: {
				Args: { p_bounty_id: string };
				Returns: undefined;
			};
			current_family_id: {
				Args: Record<string, never>;
				Returns: string | null;
			};
			is_family_member: {
				Args: { p_family_id?: string | null };
				Returns: boolean;
			};
			create_family: {
				Args: { p_name: string };
				Returns: string;
			};
			switch_family: {
				Args: { p_family_id: string };
				Returns: undefined;
			};
			create_family_invitation: {
				Args: { p_family_id: string; p_email: string };
				Returns: { invitation_id: string; invitation_token: string }[];
			};
			accept_family_invitation: {
				Args: { p_token: string };
				Returns: string;
			};
			remove_chat_participant: {
				Args: { p_chat_id: string; p_user_id: string };
				Returns: undefined;
			};
			add_chat_participant: {
				Args: { p_chat_id: string; p_user_id: string; p_role?: 'admin' | 'member' };
				Returns: undefined;
			};
			report_chat_message: {
				Args: { p_message_id: string; p_reason: string };
				Returns: string;
			};
			resolve_chat_report: {
				Args: { p_report_id: string };
				Returns: undefined;
			};
		};
		Enums: { [_ in never]: never };
		CompositeTypes: { [_ in never]: never };
	};
}
