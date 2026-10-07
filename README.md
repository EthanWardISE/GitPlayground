# Kinfolk — private family album

Kinfolk is an Astro server-rendered app with React islands and Supabase Auth, Postgres, and private Storage. The app uses the Supabase publishable key in the browser; Row Level Security (RLS) is what protects family data.

## Run locally

Use PowerShell from this project folder (`puffy-parsec`):

```powershell
Copy-Item .env.example .env
npm install
npm run dev
```

Open the local URL Astro prints, normally `http://localhost:4321`. The home page shows a setup screen until the two Supabase values in `.env` have been filled in.

## Create and configure your Supabase project

### 1. Make a Supabase project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard), sign in, and choose **New project**.
2. Pick an organization, enter a project name such as `kinfolk-family`, choose a strong database password, select a nearby region, and create the project. Save the database password somewhere safe; this app does not need it.
3. Wait for project setup to finish.
4. In **Project Settings → API Keys** (or the project’s **Connect** dialog), copy the **Project URL** and the **publishable key** (`sb_publishable_...`). Do not use a secret key (`sb_secret_...`) or legacy `service_role` key in the website.
5. Open **Authentication → URL Configuration**. Set the local **Site URL** to `http://localhost:4321` and add `http://localhost:4321/**` to the allowed **Redirect URLs**. Email confirmation sends the user back to the address passed by the app, and Supabase only redirects to URLs you allow.

### 2. Create your local `.env`

Copy the example file and put your actual project values into it:

```powershell
Copy-Item .env.example .env
notepad .env
```

Fill in both values:

```dotenv
PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your-project-publishable-key
```

Use the exact URL and publishable key shown in your Supabase project. These variables start with `PUBLIC_` because the app uses the publishable key in the browser. That key is designed to be public; RLS policies protect the data. **Never put a Supabase secret/service-role key in `.env` under a `PUBLIC_` name, commit any real `.env` file, or expose a secret key in frontend code.** `.env` is ignored by Git.

### 3. Create the tables, private photo bucket, and security policies

1. In the Supabase Dashboard, open **SQL Editor → New query**.
2. In this project, open `supabase/migrations/20261007000000_family_album.sql` in your editor and copy all of it.
3. Paste it into the Supabase SQL Editor and choose **Run**.
4. Check the SQL Editor result for a success message. The script creates four tables, indexes, a private `family-photos` bucket with a 50 MiB per-file limit, and RLS policies. You do not need to create tables or a bucket manually.

The script is for a fresh project. It restricts data access to authenticated users who have an entry in `family_members`. Storage is private: the app creates time-limited signed links for the photo grid rather than making family photos public.

### 4. Start the app and create your login

From the `puffy-parsec` project folder:

```powershell
npm run dev
```

Open `http://localhost:4321`, choose **Create an account**, and register using your email, name, and a password of at least 8 characters.

If email confirmation is enabled for your Supabase project, confirm the message sent to your email, then sign in. If confirmation emails do not arrive during local testing, check the project’s **Authentication → Users** and **Authentication → SMTP/Email** settings. You may temporarily disable **Confirm email** in **Authentication → Providers → Email** for a private test project; turn it back on before inviting other people.

New accounts are not approved automatically. A new user sees “You’re on the list” until an admin adds that user to `family_members`.

### 5. Approve yourself as the first family admin

1. In Supabase, open **Authentication → Users**.
2. Find the account you just made and copy its **User UID**.
3. Open **SQL Editor → New query** and run the following, replacing both example values. Use the UUID copied from Authentication → Users.

```sql
insert into public.family_members (user_id, full_name, role)
values ('PASTE-YOUR-USER-UUID-HERE', 'Your Name', 'admin');
```

4. Refresh Kinfolk or sign out and sign back in. Your account should now enter the album.
5. To approve a relative, have them create an account and confirm their email first. Find their UID in **Authentication → Users**, then run the same SQL with their UID, name, and role `'member'`.

Only add people you trust: a family member can see the album and its photos. `family_members` deliberately has no client-side insert policy, so users cannot approve themselves from the website.

### 6. Try the album

- **Add a memory:** upload an image, choose a year, and tag family profiles. If a tagged person has not been added before, create their profile directly from the tagging form.
- **Filter memories:** use the year dropdown and people filter.
- **Open a photo:** select a card to read and add comments.
- **Explore the family tree:** open `/tree`. Add parent IDs to profile rows in the Supabase **Table Editor → profiles** table to connect people.
- **Open a person:** select a name in the tree or family list to see photos tagged with that person at `/person/<profile-id>`.

The database names use snake_case: for example, a photo record stores `file_path`, `uploaded_by`, and `tagged_profiles`. Photos are private Storage objects in `family-photos`; the `file_path` in `photos` is the object path, not a public URL.

## Build and deploy

Check and build from the project folder:

```powershell
npm run check
npm run build
npm start
```

The production server uses Astro’s standalone Node adapter and listens on `PORT` (default `4321`) and `HOST` (default `0.0.0.0`). The current code reads public Supabase configuration in the browser. For the GitHub Actions ECR workflow, add `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_PUBLISHABLE_KEY` as repository Actions secrets; the workflow passes them to the Docker build, where Astro embeds them in the app. These are public project values, not secret credentials, and must not be replaced with a Supabase secret/service-role key. Rebuild if they change.

For an AWS App Runner source build, use Node.js 22+, provide both `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_PUBLISHABLE_KEY` to the build environment, build with `npm ci && npm run build`, start with `npm start`, and set the service port/environment `PORT` to `8080`. Connect the deployed site’s HTTPS domain in Supabase under **Authentication → URL Configuration → Redirect URLs** (and Site URL) before relying on email confirmation links. Supabase hosts the backend; this AWS service only hosts the Astro app.

## Project structure

- `src/pages/index.astro` — album entry point.
- `src/pages/tree.astro` — family tree.
- `src/pages/person/[id].astro` — family member and tagged memories.
- `src/components/FamilyApp.tsx` — React UI and Supabase operations.
- `src/lib/supabase.ts` — typed browser client and configuration.
- `src/types/database.ts` — TypeScript database interfaces.
- `supabase/migrations/20261007000000_family_album.sql` — tables, indexes, bucket, and access policies.

## Supabase references

- [Supabase Astro SSR and client setup](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=astro)
- [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys)
- [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Storage access control](https://supabase.com/docs/guides/storage/security/access-control)
- [Supabase Auth — password-based sign-in](https://supabase.com/docs/guides/auth/passwords)
