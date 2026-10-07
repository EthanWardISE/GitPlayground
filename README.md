# Kinfolk

A private family photo album built with Astro SSR, React islands, Tailwind CSS, and Appwrite.

## Run it locally

From this folder (`puffy-parsec`):

```powershell
Copy-Item .env.example .env
npm install
npm run dev
```

Open the local URL printed by Astro (normally `http://localhost:4321`). The first screen explains Appwrite setup until the required IDs have been filled in.

## Configure Appwrite

1. Create an Appwrite project. Add Web platforms for `http://localhost:4321` and the final website domain. Enable Email/Password authentication.
2. Create a team named `Family`; copy its **team ID** into `PUBLIC_APPWRITE_FAMILY_TEAM_ID`. Team owners approve registrations by adding users to this team. Users who sign up but are not team members see the pending-approval screen.
3. Create a database with ID `family-db`, or change the corresponding value in `.env`.
4. Create collections with these IDs and attributes:

| Collection ID | Attribute ID | Type | Required |
| --- | --- | --- | --- |
| `profiles` | `name` | String | Yes |
|  | `avatarFileId` | String | No |
|  | `birthYear` | Integer | No |
|  | `parentId1` | String | No |
|  | `parentId2` | String | No |
| `photos` | `title` | String | No |
|  | `fileId` | String | Yes |
|  | `year` | Integer | Yes |
|  | `uploadedBy` | String | Yes |
|  | `taggedProfiles` | String array | Yes |
| `comments` | `photoId` | String | Yes |
|  | `authorId` | String | Yes |
|  | `authorName` | String | Yes |
|  | `content` | String | Yes |
|  | `createdAt` | Datetime | No |

5. Enable document security for all three collections. Set collection-level **CREATE** permission to the Family team so approved members can add rows. Do not grant collection-level read/update/delete access to everyone; each created document is explicitly permissioned to the Family team. Add indexes for `profiles.name`, `photos.year`, `photos.taggedProfiles`, `comments.photoId`, and `comments.createdAt`.
6. Create a Storage bucket with ID `family-photos`. Enable file security and set bucket-level **CREATE** permission to the Family team. Restrict allowed file types and maximum upload size to your preference; files are explicitly permissioned to the Family team.
7. Set the Appwrite values in `.env`:

```dotenv
PUBLIC_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
PUBLIC_APPWRITE_PROJECT_ID=your-project-id
PUBLIC_APPWRITE_DATABASE_ID=family-db
PUBLIC_APPWRITE_FAMILY_TEAM_ID=your-family-team-id
PUBLIC_APPWRITE_PROFILES_COLLECTION_ID=profiles
PUBLIC_APPWRITE_PHOTOS_COLLECTION_ID=photos
PUBLIC_APPWRITE_COMMENTS_COLLECTION_ID=comments
PUBLIC_APPWRITE_STORAGE_BUCKET_ID=family-photos
```

Use the endpoint shown in your Appwrite Console (for self-hosting, that is your own `https://appwrite.your-domain/v1`). These `PUBLIC_` values are project identifiers/endpoints, not API keys. Never put an Appwrite API key in a `PUBLIC_` variable or client code.

## App features

- Sign in or create an account; unapproved users remain on the pending screen until a team owner adds them to Family.
- Browse, filter by year or tagged family members, and open photo details with comments.
- Upload a photo, tag existing profiles, or create a profile while tagging.
- Explore the family tree at `/tree` and a member’s tagged photos at `/person/<profile-document-id>`.

## Build and run the SSR server

```powershell
npm run build
npm start
```

The standalone Node server listens on `PORT` (default `4321`) and `HOST` (default `0.0.0.0`). Set `PORT=8080` on platforms that require port 8080.

## AWS deployment outline

The Astro server is ready for a Node.js 22+ host. For a simple deployment, run it on AWS App Runner from this repository, with `npm ci && npm run build` as the build and `npm start` as the start command. Configure `PORT=8080`. Astro embeds `PUBLIC_` variables during the build, so make those values available to the build (for example, via the platform’s build environment or CI); rebuild after changing them. Add the final HTTPS website domain to Appwrite’s Web platforms.

For the least infrastructure maintenance, use Appwrite Cloud. To self-host Appwrite on AWS, use a separate EC2 instance and follow Appwrite’s [official self-hosting guide](https://appwrite.io/docs/advanced/self-hosting); Appwrite needs persistent storage, HTTPS, backups, updates, and monitoring. Do not expose its database/cache ports to the internet.
