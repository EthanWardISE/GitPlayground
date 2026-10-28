# ADR 002: Package the app with Docker

Status: Accepted

## What I needed

The production app runs as a Node server. I needed a way to deploy it without manually installing the right Node version and dependencies on a server each time.

One option was to copy the project onto a server, run npm install and start it there. That would be fairly simple at first, but it would leave more room for the server setup to differ from my development setup.

## My decision

I chose to package Kinfolk in a Docker image. An image contains the app and the software it needs to run, so the deployment has a defined starting point.

The `Dockerfile` uses Node 22 Alpine and has two stages. The first installs the dependencies and builds the app. The second installs production dependencies and copies the built app across. It then starts `dist/server/entry.mjs` on port 80.

I used two stages so the final image does not need to include the full source tree and build tools from the first stage.

## What this means

GitHub Actions can build an image and send it to AWS. Each deployed image is tagged with the Git commit ID, which helps me work out which version of the code is running.

Docker adds another tool to learn, and building an image takes time. It also does not remove the need for configuration: the running app still needs the correct Supabase settings. I also need to keep the base image and dependencies updated.

The relevant files are `Dockerfile`, `.dockerignore` and `.github/workflows/deploy.yml`.
