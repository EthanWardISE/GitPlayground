# Kinfolk

<p align="center">
  <img src="./public/logo.svg" alt="Kinfolk" width="96" />
</p>

<p align="center"><strong>A private, whitelist-only family album for the moments worth keeping.</strong></p>

<p align="center">
  <a href="https://github.com/"><img src="https://img.shields.io/badge/runtime-Node%2022-3f5e4d?style=flat-square" alt="Node 22" /></a>
  <a href="https://astro.build/"><img src="https://img.shields.io/badge/framework-Astro%207-f2eee6?style=flat-square&labelColor=312f29" alt="Astro 7" /></a>
  <a href="https://supabase.com/"><img src="https://img.shields.io/badge/data-Supabase-6b8968?style=flat-square" alt="Supabase" /></a>
  <a href="./Dockerfile"><img src="https://img.shields.io/badge/container-Docker-2496ED?style=flat-square" alt="Docker" /></a>
</p>

Kinfolk is a warm, modern digital scrapbook built for trusted family circles. Authenticated members can share private photos, tag relatives, build a family tree, curate photobooks, explore memories by country, and post memory bounties. Supabase Row Level Security (RLS) and private Storage signed URLs enforce the family boundary; the browser never receives a service-role credential.

## Product principles

- **Private by default:** membership and family selection are enforced in the database.
- **Small moments first:** fast photo grids, responsive upload previews, and calm empty states.
- **Safe collaboration:** admins manage invitations and profile claims; destructive actions are explicit.
- **Deployable, observable foundations:** reproducible Node builds, a multi-stage container, and a migration-first release process.

## Tech stack

| Layer | Technology |
| --- | --- |
| UI and server rendering | Astro 7, React islands, TypeScript |
| Styling | Tailwind CSS 4 via Vite, shared Kinfolk CSS tokens |
| Authentication and API | Supabase Auth, `@supabase/ssr`, Supabase JS |
| Database | Supabase Postgres with RLS and timestamped SQL migrations |
| Media | Private Supabase Storage bucket with signed URLs and transformations |
| Infrastructure | AWS CDK (`cdk/`), Docker, Node 22 Alpine |
| Quality gates | `astro check`, production build, CDK Jest tests |

## User stories

- As an invited family member, I can sign in and only see the families I belong to.
- As a member, I can upload a photo, preview it before saving, tag people, and add a title, year, and location.
- As a member, I can switch family spaces without leaking photos, comments, profiles, or bounties between them.
- As a member, I can browse memories, open a photo, leave a comment, and curate a photobook.
- As an admin, I can invite people, review profile claims, and manage family membership.
- As a family, we can preserve relationships in a visual family tree and find memories on a world map.

## Local development

### Prerequisites

- Node.js `>=22.12.0` and npm
- A Supabase project
- PowerShell, Bash, or a compatible terminal

### 1. Install and configure

```powershell
cd puffy-parsec
Copy-Item .env.example .env
npm install
```

Set the public browser configuration in `.env`:

```dotenv
PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your-project-key
```

These values are intentionally public. Never use a Supabase secret/service-role key in a `PUBLIC_` variable or commit a real `.env` file.

### 2. Apply database migrations

Run the files in `supabase/migrations/` in timestamp order using the Supabase SQL Editor or the Supabase CLI. The migrations create the schema, RLS policies, private `family-photos` bucket, storage policies, family tenancy, profiles, relationships, collections, comments, and bounties. Do not skip an earlier migration when provisioning a fresh project.

The current migration set includes:

1. `20261007000000_family_album.sql` — initial album, membership, storage, and RLS.
2. `20261020000000_owner_photo_deletion.sql` — ownership and deletion rules.
3. `20261021000000_people_tree_collections.sql` — claims, relationships, tree layouts, and photobooks.
4. `20261022000000_standalone_profile_avatars.sql` through `20261026000000_relationship_handle_positions.sql` — avatars, management, bios, and tree handles.
5. `20261104000000_multi_family_tenancy.sql` and subsequent `20261104*.sql` migrations — isolated family spaces, bucket recovery, and family-scoped profile claims.

For the CLI workflow:

```powershell
npx supabase link --project-ref <project-ref>
npx supabase db push
```

### 3. Run the app

```powershell
npm run dev
```

Open [http://localhost:4321](http://localhost:4321). Create an account, create a family or accept an invitation, then upload a memory. Set the Supabase Auth Site URL and local redirect URL to `http://localhost:4321` when email confirmation is enabled.

## Commands

```powershell
npm run dev       # Start Astro development server
npm run check     # Type-check Astro, React, and generated routes
npm run build     # Create the production server bundle
npm run preview   # Preview the production bundle locally
npm run start     # Run dist/server/entry.mjs
```

`npm run check` is the smallest quality gate for application changes. Run `npm run build` before creating a deployment artifact.

## Production pipeline

1. **Validate:** install from the lockfile, run `npm run check`, and run the CDK test suite in `cdk/`.
2. **Build:** `npm run build` creates an Astro Node standalone server in `dist/`.
3. **Package:** the multi-stage [Dockerfile](./Dockerfile) builds with Node 22, then copies only the production bundle and dependencies into a small Alpine runtime.
4. **Provision:** AWS CDK in `cdk/` defines the static asset/deployment infrastructure. Keep environment-specific Supabase values in deployment secrets or task configuration, not in Git.
5. **Migrate:** apply Supabase migrations in order before switching traffic to an application that depends on a new schema.
6. **Release:** deploy the immutable image, set `HOST=0.0.0.0`, `PORT=80`, and `SITE_URL`, then run a smoke test against the health/app URL.
7. **Observe and recover:** inspect application, Supabase Auth, Postgres, and Storage logs. Roll back the image first; roll forward database changes with a new migration rather than editing history.

The GitHub Actions workflow in `.github/workflows/deploy.yml` is the reference CI/CD entry point. Pin credentials in GitHub/AWS secret stores and keep production Supabase projects separate from local development projects.

### Docker

```powershell
docker build --build-arg SITE_URL=https://kinfolk.example.com -t kinfolk .
docker run --rm -p 4321:80 `
  -e PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co `
  -e PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your-project-key `
  -e SITE_URL=https://kinfolk.example.com kinfolk
```

The image listens on port `80`; the example maps it to local port `4321`.

## Database at a glance

The exact source of truth is `supabase/migrations/`. At a conceptual level:

```text
auth.users ──< family_members >── families
families ──< profiles
families ──< photos ──< comments
photos >──< profiles       (tagged_profiles)
families ──< collections ──< collection_photos >── photos
families ──< bounties ──< bounty_submissions >── photos
profiles ──< person_relationships >── profiles
profiles ──< profile_claim_requests
```

- **Users:** Supabase Auth owns identities; `family_members` grants family-scoped access and roles.
- **Families:** tenancy boundary for all album data. The selected family is stored server-side and switched through an RPC.
- **Profiles:** family people, optional claimed `auth.users` owner, avatar, biography, and tree relationships.
- **Photos:** metadata and private Storage `file_path`; signed URLs are generated only after an RLS-authorized query.
- **Bounties:** requests for missing memories, with submissions linking found photos back to the request.
- **Collections and comments:** collaborative photobooks and conversation attached to family photos.

RLS policies should be treated as production code. Test membership, admin, owner, and cross-family access whenever a migration changes a table or RPC.

## Testing and release checklist

- [ ] `npm ci` succeeds from a clean checkout.
- [ ] `npm run check` passes without TypeScript or Astro diagnostics.
- [ ] `npm run build` completes with the intended `SITE_URL`.
- [ ] CDK unit tests pass from `cdk/` (`npm test`).
- [ ] Fresh Supabase migrations apply in order.
- [ ] Signed-out users cannot access album data.
- [ ] A member of family A cannot read or mutate family B data.
- [ ] Upload failure removes an orphaned Storage object where possible.
- [ ] Mobile smoke test covers family switching, upload preview, photo grid, tree, and modal scrolling.
- [ ] No `.env`, Supabase secret key, or AWS credential is included in the image or repository.

## React keys and Astro hydration checklist

- [ ] Give every mapped sibling a stable domain ID (`photo.id`, `profile.id`), never an array index when items can be inserted, removed, or reordered.
- [ ] Put `key` on the component returned directly by `.map()`, not on a wrapper inside that component.
- [ ] Do not concatenate mutable display text into a key; names and titles can change.
- [ ] Render browser-only values (dates, `window`, object URLs) after hydration or behind a client effect.
- [ ] Use the smallest Astro client directive that matches the interaction: `client:load` for immediately interactive UI, `client:visible` for below-the-fold widgets, and `client:idle` for non-critical controls.
- [ ] Keep server props serializable and deterministic. Do not pass `File`, `URL`, Supabase clients, or functions through an Astro island boundary.
- [ ] If markup genuinely differs between server and browser, isolate it in a client component and render a stable loading placeholder first.

```tsx
// Stable key: the database ID survives sorting and filtering.
{photos.map((photo) => <PhotoCard key={photo.$id} photo={photo} />)}
```

```astro
---
import FamilyApp from '../components/FamilyApp';
---
<!-- The island owns browser-only auth and Storage work. -->
<FamilyApp client:load />
```

## Repository map

```text
src/components/     React and Astro UI components
src/lib/             Supabase and domain helpers
src/pages/           Astro routes and server endpoints
src/styles/          Kinfolk design tokens and family app styles
supabase/migrations/ Database schema, RLS, RPCs, and storage policies
cdk/                 AWS infrastructure and infrastructure tests
.github/workflows/   CI/CD automation
```

## Security notes

Kinfolk is designed for a trusted, invite-only audience, not anonymous public sharing. Keep RLS enabled, use private Storage, rotate leaked keys immediately, and review profile claims before approving them. Report security issues privately to the project maintainers rather than opening a public issue with sensitive details.

## License

Add the project license here before publishing the repository publicly.
