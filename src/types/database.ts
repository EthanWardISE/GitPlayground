export type Json =
	| string
	| number
	| boolean
	| null
	| { [key: string]: Json | undefined }
	| Json[];

export type ProfileRow = {
	id: string;
	name: string;
	avatar_file_path: string | null;
	bio: string | null;
	birth_year: number | null;
	user_id: string | null;
	birth_date: string | null;
	created_at: string;
};

export type PhotoRow = {
	id: string;
	title: string | null;
	file_path: string;
	year: number;
	uploaded_by: string;
	tagged_profiles: string[];
	created_at: string;
};

export type CommentRow = {
	id: string;
	photo_id: string;
	author_id: string;
	author_name: string;
	content: string;
	created_at: string;
};

export type PersonRelationshipRow = {
	id: string;
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
	profile_id: string;
	x: number;
	y: number;
	updated_by: string;
	updated_at: string;
};

export type CollectionRow = {
	id: string;
	title: string;
	description: string | null;
	cover_photo_id: string | null;
	created_by: string;
	created_at: string;
	updated_at: string;
};

export type CollectionPhotoRow = {
	collection_id: string;
	photo_id: string;
	added_by: string;
	added_at: string;
};

export type ProfileClaimRequestRow = {
	id: string;
	profile_id: string;
	claimant_id: string;
	status: 'pending' | 'approved' | 'rejected';
	reviewed_by: string | null;
	reviewed_at: string | null;
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
				Row: {
					user_id: string;
					full_name: string;
					role: 'admin' | 'member';
					created_at: string;
				};
				Insert: {
					user_id: string;
					full_name: string;
					role?: 'admin' | 'member';
					created_at?: string;
				};
				Update: Partial<Database['public']['Tables']['family_members']['Insert']>;
				Relationships: [];
			};
			profiles: {
				Row: ProfileRow;
				Insert: {
					id?: string;
					name: string;
					avatar_file_path?: string | null;
					bio?: string | null;
					birth_year?: number | null;
					user_id?: string | null;
					birth_date?: string | null;
					created_at?: string;
				};
				Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
				Relationships: [];
			};
			photos: {
				Row: PhotoRow;
				Insert: {
					id?: string;
					title?: string | null;
					file_path: string;
					year: number;
					uploaded_by: string;
					tagged_profiles?: string[];
					created_at?: string;
				};
				Update: Partial<Database['public']['Tables']['photos']['Insert']>;
				Relationships: [];
			};
			comments: {
				Row: CommentRow;
				Insert: {
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
			person_relationships: {
				Row: PersonRelationshipRow;
				Insert: {
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
				};
				Update: Partial<Database['public']['Tables']['tree_positions']['Insert']>;
				Relationships: [];
			};
			profile_claim_requests: {
				Row: ProfileClaimRequestRow;
				Insert: {
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
					collection_id: string;
					photo_id: string;
					added_by?: string;
					added_at?: string;
				};
				Update: Partial<Database['public']['Tables']['collection_photos']['Insert']>;
				Relationships: [];
			};
		};
		Views: { [_ in never]: never };
		Functions: {
			is_family_member: {
				Args: Record<string, never>;
				Returns: boolean;
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
		};
		Enums: { [_ in never]: never };
		CompositeTypes: { [_ in never]: never };
	};
}
