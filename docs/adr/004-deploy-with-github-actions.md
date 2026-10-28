# ADR 004: Deploy with GitHub Actions

Status: Accepted

## What I needed

I wanted a repeatable way to release Kinfolk. Doing every release manually would mean remembering the Docker commands, choosing the right image and updating the AWS service myself.

I considered a manual deployment script and a separate automation server such as Jenkins. A script would still need to be run somewhere, while Jenkins would give me another service to set up and maintain.

## My decision

I chose GitHub Actions because the code is already on GitHub and the deployment steps can live beside it in the repository.

The workflow in `.github/workflows/deploy.yml` runs when code is pushed to `main`, or when I start it manually. It checks the required deployment settings, signs in to AWS, builds the Docker image and pushes it to ECR. It then registers an updated ECS task definition and updates the service. A task definition describes which image and settings the container should use.

The workflow uses GitHub OIDC for AWS access. This lets a run request temporary AWS credentials through an IAM role, rather than keeping a long-lived AWS access key in the repository.

## What this means

The release steps are saved in version control, and I can look at a workflow run to see which step failed. The image tag uses the commit ID, so I can match a release to its source code. Deployment runs are also queued so they do not update the same service at the same time.

The trade-off is that a mistake in the workflow can affect production. AWS permissions and GitHub deployment settings still need to be configured correctly, and runner usage can have limits or costs.

The current workflow builds and deploys the app, but it does not run `npm run check`, the unit tests or the CDK tests. Adding these checks before deployment would be a useful next improvement. Supabase database migrations also need to be handled separately; the workflow does not apply them.
