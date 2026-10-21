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
4. Repeat with `supabase/migrations/20261020000000_owner_photo_deletion.sql` to apply photo ownership and deletion policies.
5. Repeat with `supabase/migrations/20261021000000_people_tree_collections.sql` to add approved profile claims, flexible family relationships, saved tree layouts, and collaborative photobooks.
6. Repeat with `supabase/migrations/20261022000000_standalone_profile_avatars.sql` to allow profile pictures to be uploaded separately from album photos.
7. Repeat with `supabase/migrations/20261023000000_profile_avatar_storage_read.sql` to allow family members to display uploaded profile pictures.
8. Repeat with `supabase/migrations/20261024000000_profile_and_photobook_management.sql` to enable authorized picture removal.
9. Repeat with `supabase/migrations/20261025000000_profile_bios.sql` to enable bios on claimed profiles.
10. Repeat with `supabase/migrations/20261026000000_relationship_handle_positions.sql` so family connections remain attached to the exact tree handles used to create them.
11. Check the SQL Editor result for a success message. The scripts create tables, indexes, a private `family-photos` bucket with a 50 MiB per-file limit, and RLS policies. You do not need to create tables or a bucket manually.

The first script is for a fresh project; run the later scripts in timestamp order to update existing projects. Data access is restricted to authenticated users who have an entry in `family_members`. Storage is private: the app creates time-limited signed links for the photo grid rather than making family photos public. Avatar and photobook thumbnails use Supabase Storage image transformations; enable image transformations for your Supabase project.

If Kinfolk reports that `profile_claim_requests` (or another people/tree/photobook table) is missing from the schema cache, the people/tree migration has not been applied to this Supabase project. Run `20261021000000_people_tree_collections.sql` in the SQL Editor, wait for it to finish, then refresh the app. If the migration just succeeded but the error persists, use **Project Settings → API → Reload schema cache** and refresh again.

If local development reports `Object not found` while the deployed AWS site works, check that the project URL and publishable key in the local `.env` match the Supabase project configured in the ECS task definition. Local and deployed environments can point to different Supabase projects, each with separate users, migrations, and Storage files. Do not share or commit the publishable key or any secret key when asking for help.

The people/tree migration transfers existing `parent_id1` and `parent_id2` links into `person_relationships`, then removes those legacy columns. Family admins should verify a claimant’s identity before approving profile claims; the UI does not independently verify identity.

Run `20261022000000_standalone_profile_avatars.sql` after the people/tree migration to allow profile pictures to be uploaded independently of album photos. Run `20261023000000_profile_avatar_storage_read.sql` afterward to let approved family members load those avatars from private Storage.

Profile owners and family admins can delete profiles; only family admins can delete unclaimed ghost profiles. Family members can delete shared photobooks, but deleting one never removes photos from the family album.

Run `20261025000000_profile_bios.sql` after the profile and photobook management migration. A claimed profile owner can add or edit their 1,000-character bio; it is visible to approved family members.

### 4. Start the app and create your login

From the `puffy-parsec` project folder:

```powershell
npm run dev
```

Open `http://localhost:4321`, choose **Create an account**, and register using your email, name, and a password of at least 8 characters.

If email confirmation is enabled for your Supabase project, confirm the message sent to your email, then sign in. If confirmation emails do not arrive during local testing, check the project’s **Authentication → Users** and **Authentication → SMTP/Email** settings. You may temporarily disable **Confirm email** in **Authentication → Providers → Email** for a private test project; turn it back on before inviting other people.

Registration is open and does not require a whitelist. A new user who has not joined a family sees the family setup screen, where they can accept an invitation or create a new family immediately. Access to an existing family still requires an invitation from that family’s administrator.

### Multiple family spaces

Migration `20261104000000_multi_family_tenancy.sql` preserves the existing album as the first Kinfolk family and adds isolated family spaces. A signed-in user can create a family from the pending-access screen, accept an invitation link, and switch between families from the app navigation. Family membership, roles, profiles, photos, photobooks, tree data, claims, bounties, and comments are scoped to the selected family by database policies.

Apply this migration after the existing migrations in timestamp order. It is data-preserving and does not delete existing profiles, photos, or memberships. Do not manually edit the migration or run it against a different project without first checking the project’s migration history.

Migration `20261104010000_ensure_family_photos_bucket.sql` also restores the private `family-photos` bucket if it is missing. It is idempotent and does not delete or modify existing storage objects.

### 5. Join or create a family

For a fresh project, sign in to Kinfolk and use **Create a family** on the pending-access screen. You become that family’s administrator automatically.

For an existing project, the migration preserves the original family and memberships. If the first administrator still needs to be added manually:

1. In Supabase, open **Authentication → Users** and copy the account’s **User UID**.
2. In **SQL Editor**, find the preserved family ID:

```sql
select id, name
from public.families
order by created_at, id
limit 1;
```

3. Add the user to that family, replacing all example values:

```sql
insert into public.family_members (family_id, user_id, full_name, role)
values ('PASTE-FAMILY-UUID-HERE', 'PASTE-USER-UUID-HERE', 'Your Name', 'admin');
```

4. Refresh Kinfolk or sign out and sign back in. To add relatives, use **Manage family → Create invite link** from the app rather than inserting memberships manually.

Only invite people you trust: a family member can see the active family’s album and data. Membership inserts remain server-controlled; users can create their own new family but cannot add themselves to an existing family without an invitation.

### 6. Try the album

- **Add a memory:** upload an image, choose a year, and tag family profiles. If a tagged person has not been added before, create their profile directly from the tagging form.
- **Filter memories:** use the year dropdown and people filter.
- **Open a photo:** select a card to read and add comments. Delete posts you uploaded from the photo detail view; Kinfolk asks for confirmation first.
- **Explore the family tree:** open `/tree`, add person profiles with or without a photo, drag the side dots between profiles to add a sibling link, use the top/bottom dots for parent, step-parent, guardian, or spouse links, and drag nodes to save the shared layout. Add a full birth date when you know it; the tree calculates age from that date.
- **Claim a person profile:** open their profile page and request a claim. A family admin reviews and approves it before the account is linked.
- **Set a profile picture:** open a person’s profile and either crop a photo you uploaded that tags them, or upload a separate image directly. The avatar upload does not add a photo to the family album.
- **Create a photobook:** open `/collections`, create a named collection, then add shared family-album photos. Set a cover image and filter that collection by tagged people.
- **Open a person:** select a name in the tree or family list to see photos tagged with that person at `/person/<profile-id>`.
- **Add your bio:** after an admin approves your profile claim, open your profile and add a short introduction for the family.

The database names use snake_case: for example, a photo record stores `file_path`, `uploaded_by`, and `tagged_profiles`. Photos are private Storage objects in `family-photos`; the `file_path` in `photos` is the object path, not a public URL.

## Launch on Amazon ECS

This project runs as a Node.js server in an Amazon ECS Fargate container. GitHub Actions builds the container, pushes it to Amazon ECR, and tells ECS to start it. Supabase settings are added to the **ECS task definition when GitHub Actions deploys**. They are not baked into the image and are not read from a file inside the container.

The Supabase URL and publishable key are designed to be public in a website. Use only the Supabase **publishable** key (`sb_publishable_...`), never a `sb_secret_...` or `service_role` key. The app sends the two public values to the browser through `/api/runtime-config`; that endpoint is not cached.

**AWS charges for the running Fargate task and load balancer.** Check current prices for your region and delete the ECS service, load balancer, and other resources when you no longer need them.

### Part A — Make an empty place for the app in AWS

Use one AWS region for every step. These instructions use `eu-north-1`; choose another region if you prefer, but use it everywhere, including GitHub.

1. **Make an ECR image repository.**
   - Open **Amazon ECR → Private registry → Repositories → Create repository**.
   - Choose **Private**, enter `kinfolk-family-app`, and create it.
   - ECR is the shelf where GitHub will put the app’s container image.

2. **Make an ECS cluster.**
   - Open **Amazon ECS → Clusters → Create cluster**.
   - Name it `kinfolk-cluster`, select the AWS Fargate/serverless option, and create it.

3. **Make a temporary task definition.**
   - In **Task definitions → Create new task definition**, choose **Fargate**, Linux, and `x86_64`.
   - Name the task family `kinfolk-task`. Choose `0.5 vCPU` and `1 GB` memory.
   - For the **task execution role**, create or select `ecsTaskExecutionRole`. It needs the AWS-managed `AmazonECSTaskExecutionRolePolicy` so ECS can download images and write logs. The app does not need a task role.
   - Add one container. Set its name to `kinfolk`, its image to `public.ecr.aws/docker/library/nginx:alpine`, and its container port to `80` using TCP. Turn on the `awslogs` log option if the wizard offers it.
   - Save the task definition. Nginx is only a temporary starter image; the first GitHub deployment replaces it with Kinfolk.

4. **Make the ECS service and its web address.**
   - Open `kinfolk-cluster` and choose **Create service**. Use the Fargate launch type, task family `kinfolk-task`, service name `kinfolk-service`, and desired task count `1`.
   - In the networking section, choose a VPC with public subnets. Turn on **Auto-assign public IP** so the first task can download its image.
   - In load balancing, create an **internet-facing Application Load Balancer** with an HTTP listener on port `80`. Forward it to the `kinfolk` container on port `80`, and create a target group that uses **IP** targets and checks the path `/`.
   - Let the wizard create security groups if you are not sure what to choose. The load balancer must accept web traffic on port `80`; the task should accept port `80` from the load balancer.
   - Create the service and wait until its temporary Nginx page is healthy. Copy the load balancer’s **DNS name** from **EC2 → Load Balancers**. It is the temporary web address for Kinfolk too; write it as `http://<DNS-name>` (include `http://`).

### Part B — Let GitHub deploy safely

GitHub uses AWS **OpenID Connect (OIDC)**. This lets GitHub request short-lived AWS access when a deployment runs; you do not need to save permanent AWS access keys in GitHub.

5. **Create the AWS GitHub identity provider (once per AWS account).**
   - Open **IAM → Identity providers → Add provider**.
   - Provider type: **OpenID Connect**. Provider URL: `https://token.actions.githubusercontent.com`. Audience: `sts.amazonaws.com`.

6. **Create a role for this repository’s GitHub workflow.**
   - In **IAM → Roles → Create role**, choose **Web identity**, select the provider you just added, and choose audience `sts.amazonaws.com`.
   - Restrict the role to your repository and the `main` branch. The trust relationship should look like this; replace `YOUR-OWNER` and `YOUR-REPOSITORY` with the GitHub owner and repository name:

     ```json
     {
       "Version": "2012-10-17",
       "Statement": [{
         "Effect": "Allow",
         "Principal": {
           "Federated": "arn:aws:iam::YOUR-ACCOUNT-ID:oidc-provider/token.actions.githubusercontent.com"
         },
         "Action": "sts:AssumeRoleWithWebIdentity",
         "Condition": {
           "StringEquals": {
             "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
             "token.actions.githubusercontent.com:sub": "repo:YOUR-OWNER/YOUR-REPOSITORY:ref:refs/heads/main"
           }
         }
       }]
     }
     ```

   - Attach an inline permissions policy like this. Replace the account ID and region. If the ECS wizard gave the task execution role a different name, use that role’s ARN on the `iam:PassRole` line.

     ```json
     {
       "Version": "2012-10-17",
       "Statement": [
         {
           "Effect": "Allow",
           "Action": "ecr:GetAuthorizationToken",
           "Resource": "*"
         },
         {
           "Effect": "Allow",
           "Action": [
             "ecr:BatchCheckLayerAvailability",
             "ecr:CompleteLayerUpload",
             "ecr:InitiateLayerUpload",
             "ecr:PutImage",
             "ecr:UploadLayerPart"
           ],
           "Resource": "arn:aws:ecr:YOUR-REGION:YOUR-ACCOUNT-ID:repository/kinfolk-family-app"
         },
         {
           "Effect": "Allow",
           "Action": [
             "ecs:DescribeServices",
             "ecs:DescribeTaskDefinition"
           ],
           "Resource": "*"
         },
         {
           "Effect": "Allow",
           "Action": [
             "ecs:RegisterTaskDefinition"
           ],
           "Resource": "*"
         },
         {
           "Effect": "Allow",
           "Action": "ecs:UpdateService",
           "Resource": "arn:aws:ecs:YOUR-REGION:YOUR-ACCOUNT-ID:service/kinfolk-cluster/kinfolk-service"
         },
         {
           "Effect": "Allow",
           "Action": "iam:PassRole",
           "Resource": "arn:aws:iam::YOUR-ACCOUNT-ID:role/ecsTaskExecutionRole",
           "Condition": {
             "StringEquals": {
               "iam:PassedToService": "ecs-tasks.amazonaws.com"
             }
           }
         }
       ]
     }
     ```

   - Save the role and copy its ARN. The GitHub workflow uses this role to push an image and update this one ECS service.

7. **Give the GitHub repository its settings.**
   - In GitHub, open the repository’s **Settings → Secrets and variables → Actions**.
   - Add these **variables**:

     | Variable | Value |
     | --- | --- |
     | `AWS_REGION` | The region from Part A, for example `eu-north-1` |
     | `AWS_ROLE_TO_ASSUME` | The full ARN of the IAM role from step 6 |
     | `ECR_REPOSITORY` | `kinfolk-family-app` |
     | `ECS_CLUSTER` | `kinfolk-cluster` |
     | `ECS_SERVICE` | `kinfolk-service` |
     | `ECS_CONTAINER_NAME` | `kinfolk` |
     | `SITE_URL` | The load balancer address from step 4, starting with `http://` |

   - Add these **secrets**:

     | Secret | Value |
     | --- | --- |
     | `PUBLIC_SUPABASE_URL` | Your Supabase Project URL, such as `https://example.supabase.co` |
     | `PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Your Supabase publishable key beginning `sb_publishable_` |

   - The last two are public website settings, not Supabase admin passwords. The workflow copies them into the ECS task definition as runtime environment variables and starts a new task. It deliberately does **not** pass them to `docker build`. Each future deployment repeats this update, so the running task gets the current GitHub secret values.

8. **Launch Kinfolk.**
   - Make sure your changes are pushed to the repository’s `main` branch. Or open **Actions → Deploy Kinfolk to ECS → Run workflow** and select `main`.
   - The workflow builds and uploads the image, registers a new ECS task definition containing the two Supabase settings, and updates the ECS service.
   - Wait for the workflow to turn green. Open the load balancer address from step 4. The temporary Nginx page should now be Kinfolk.
   - If the workflow is red, open it and read the failed step. A missing setting usually means a GitHub variable or secret name was typed differently. An `AccessDenied` message usually means the role policy or its repository/branch trust condition does not match.

9. **Tell Supabase about the new address.**
   - In Supabase, open **Authentication → URL Configuration**.
   - Set the Site URL to your app address and add that address plus `/**` to the Redirect URLs. For the temporary load balancer address, use the same `http://...` address you put in `SITE_URL`.
   - For family use, attach your own domain and HTTPS certificate to the load balancer. Then change `SITE_URL` and the Supabase Site URL/Redirect URLs to the `https://` domain and run a new deployment.
   - Create your login and approve your first family admin using the earlier Supabase steps in this README.

**Important:** Do not upload `.env` to AWS, commit it, or expect it to be copied into the container. The Docker build excludes `.env`; ECS environment variables are created by the GitHub deployment workflow. The two Supabase values must exist as GitHub Actions secrets for each deployment. They are public client settings; never substitute a Supabase secret/service-role key.

### Check locally

From the `puffy-parsec` project folder:

```powershell
npm run check
npm run build
npm start
```

For local development, `npm run dev` reads the two values from your ignored `.env` file. The production image uses Astro’s standalone Node adapter, listens on `0.0.0.0`, and uses port `80` in ECS. The task definition and load balancer must both use the same port.

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
