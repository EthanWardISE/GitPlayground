import { Account, Client, Databases, ID, Permission, Query, Role, Storage, Teams } from 'appwrite';

export interface AppwriteConfig {
	endpoint: string;
	projectId: string;
	databaseId: string;
	familyTeamId: string;
	profilesCollectionId: string;
	photosCollectionId: string;
	commentsCollectionId: string;
	storageBucketId: string;
}

export const appwriteConfig: AppwriteConfig = {
	endpoint: import.meta.env.PUBLIC_APPWRITE_ENDPOINT ?? '',
	projectId: import.meta.env.PUBLIC_APPWRITE_PROJECT_ID ?? '',
	databaseId: import.meta.env.PUBLIC_APPWRITE_DATABASE_ID ?? '',
	familyTeamId: import.meta.env.PUBLIC_APPWRITE_FAMILY_TEAM_ID ?? '',
	profilesCollectionId: import.meta.env.PUBLIC_APPWRITE_PROFILES_COLLECTION_ID ?? '',
	photosCollectionId: import.meta.env.PUBLIC_APPWRITE_PHOTOS_COLLECTION_ID ?? '',
	commentsCollectionId: import.meta.env.PUBLIC_APPWRITE_COMMENTS_COLLECTION_ID ?? '',
	storageBucketId: import.meta.env.PUBLIC_APPWRITE_STORAGE_BUCKET_ID ?? '',
};

export function createAppwriteServices() {
	if (!appwriteConfig.endpoint || !appwriteConfig.projectId) {
		throw new Error('Appwrite is not configured. Copy .env.example to .env and add your endpoint and project ID.');
	}

	const client = new Client()
		.setEndpoint(appwriteConfig.endpoint)
		.setProject(appwriteConfig.projectId);

	return {
		account: new Account(client),
		databases: new Databases(client),
		storage: new Storage(client),
		teams: new Teams(client),
	};
}

export { ID, Permission, Query, Role };
