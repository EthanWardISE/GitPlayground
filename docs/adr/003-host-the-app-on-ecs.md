# ADR 003: Host the app on Amazon ECS

Status: Accepted

## What I needed

Kinfolk needs a running server for its application routes. Uploading static files to a storage bucket would not run that server.

I considered running it myself on a virtual machine or using a managed app host such as Render or Railway. A managed app host would involve less setup and would be a reasonable choice for a small project.

## My decision

I chose Amazon ECS to run the Docker version of Kinfolk. ECS manages applications running in containers. The image is stored in Amazon ECR, which is AWS's container image registry.

Part of the reason was to get experience with an AWS production pipeline for the project. I wanted to understand how building an image, storing it and releasing it fit together. ECS also lets me configure the container and update the service through the AWS tools used by the deployment workflow.

Rather than use a ready-made scrapbook service, I wanted to build Kinfolk's own family tree, photobooks and memory bounties. For hosting that custom app, the closer alternative to ECS is a platform as a service, such as Render. That is different from software as a service, where I would mainly be using someone else's finished application.

## What this means

I get more practice configuring a deployment, but I also have more responsibility. I need to understand AWS permissions, service configuration, networking and costs. ECS is not automatically cheaper or simpler than a managed app host, especially for a small college project.

The deployment workflow updates an existing ECS service and waits for it to become stable. It does not create the cluster or service from scratch. The code in `cdk/` currently defines an S3 and CloudFront setup, so it should not be mistaken for the definition of the ECS infrastructure.

If keeping the app online becomes more work than the learning benefit is worth, I would consider moving the container to a simpler managed host.
