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
5. Check the SQL Editor result for a success message. The scripts create four tables, indexes, a private `family-photos` bucket with a 50 MiB per-file limit, and RLS policies. You do not need to create tables or a bucket manually.

The first script is for a fresh project; run the second script afterward to enforce owner-only photo edits and deletion, including on an existing project. Data access is restricted to authenticated users who have an entry in `family_members`. Storage is private: the app creates time-limited signed links for the photo grid rather than making family photos public.

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
- **Open a photo:** select a card to read and add comments. Delete posts you uploaded from the photo detail view; Kinfolk asks for confirmation first.
- **Explore the family tree:** open `/tree`. Add parent IDs to profile rows in the Supabase **Table Editor → profiles** table to connect people.
- **Open a person:** select a name in the tree or family list to see photos tagged with that person at `/person/<profile-id>`.

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
