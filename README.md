# GitPlayground Blog Test

This is my first README.md file, git test for ISE.

## Production server

This project uses Astro's Node.js adapter in standalone mode. After building,
start the generated server with Node.js:

```powershell
$env:HOST = '0.0.0.0'
$env:PORT = '4321'
node ./dist/server/entry.mjs
```

The operational health endpoint is available at
`http://localhost:4321/api/health`. Requests are logged as structured JSON to
standard output. See
[ADR-001](./docs/adr/ADR-001-transition-to-ssr-and-containers.md) for the
architecture decision and container deployment notes.