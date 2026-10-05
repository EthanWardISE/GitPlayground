# ADR-001: Transition to SSR and Containers

- **Status:** Accepted
- **Date:** 2026-10-05

## Context

The site was built for static output. Operational deployments need a live
health-check endpoint and server-side request logs, and should be able to run
the application as a Node.js process inside a container.

## Decision

- Use Astro's `server` output with the official `@astrojs/node` adapter in
  `standalone` mode.
- Keep page rendering and API routes on the server; expose `/api/health` with
  an `ok` status, process uptime, and an ISO-8601 timestamp.
- Log every request as one JSON object to standard output, including timestamp,
  level, HTTP method, path, status, and duration. Client errors are logged as
  warnings and server errors as errors.
- Run the built server with Node.js and configure its bind address and port
  through `HOST` and `PORT`. The same build can be packaged into a container
  with a supported Node.js runtime and the generated `dist/server` output.

## Consequences

- Production deployments must run the Node.js server instead of serving only
  generated static files.
- A container orchestrator or load balancer can poll `/api/health`, and
  container logging systems can collect request logs from standard output.
- Runtime hosting must provide the site's required assets and the Node.js
  version declared by the package (`>=22.12.0`).
- Container image creation and deployment configuration remain deployment
  concerns; this decision enables the standalone server but does not prescribe
  an image registry or orchestrator.

## Local operation

Build and start the standalone server from the project directory:

```powershell
npm run build
$env:HOST = '0.0.0.0'
$env:PORT = '4321'
node ./dist/server/entry.mjs
```

In another terminal, verify the health endpoint:

```powershell
curl.exe -i http://localhost:4321/api/health
```
