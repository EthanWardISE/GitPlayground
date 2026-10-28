# ADR 001: Supabase instead of Appwrite

Status: Accepted

## What I needed

Kinfolk needs accounts, a database and somewhere to store photos. The data is quite connected. A family has members, a photo can tag several people, and a photobook can contain several photos.

I originally went with Appwrite. While setting it up, I found that features I wanted were on a paid plan, while Supabase's free plan covered what I needed for this project. This was my reason for switching at the time, rather than a claim that everything on Supabase is free.

## My decision

I chose Supabase for authentication, the database and photo storage.

Supabase uses PostgreSQL, so I could use SQL to connect the data. For example, a separate table can link photos to the people tagged in them. Foreign keys help stop these links pointing to records that do not exist.

In my original Appwrite approach, I was keeping track of those links manually in the application code. I found the SQL approach easier to understand and work with as the family features grew. This describes how I was using Appwrite, rather than saying it has no relationship features.

## What this means

I can manage the database structure through SQL migration files in `supabase/migrations/`. These files record changes so I can apply them again when setting up the project elsewhere.

Supabase also lets me use row level security. These are database rules that control which rows an account can access, which matters because one family should not see another family's photos.

The downside is that I need to learn SQL and check those rules carefully. The free plan also has limits, so I would need to review the cost if more people started using Kinfolk. Moving away from Supabase later would take work because the app uses its login and storage tools too.
