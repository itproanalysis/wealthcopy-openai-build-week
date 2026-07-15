# WealthCopy GCP deployment

## Current deployment

| Item | Value |
| --- | --- |
| Public URL | `https://wealth-copy-470320899177.asia-northeast3.run.app` |
| Project | `abis-web-platform` |
| Region | `asia-northeast3` (Seoul) |
| Cloud Run service | `wealth-copy` |
| Initial revision | `wealth-copy-00001-lkh` |
| Runtime identity | `wealth-copy-run@abis-web-platform.iam.gserviceaccount.com` |
| Secret | `wealth-copy-openai-api-key` |
| Model environment | `OPENAI_MODEL=gpt-5.6` |
| Resources | 1 CPU, 512 MiB, concurrency 20, timeout 120 seconds |
| Scaling | minimum 0, maximum 3 instances |

The service is public for the Build Week demo. Cloud Run terminates TLS and injects `PORT=8080`. The container listens on `0.0.0.0`, runs as a non-root user and receives the OpenAI key only when an instance starts.

## Source and secret boundary

- `next.config.ts` produces the Next.js standalone server.
- `Dockerfile` builds with Node.js 24 and copies only the standalone runtime and static chunks into the final image.
- `.dockerignore` and `.gcloudignore` exclude `.env*`, except the empty `.env.example`, as well as `기획서/`, `.git/`, `node_modules/` and `.next/`.
- Verify the upload manifest before every deployment:

```powershell
gcloud.cmd meta list-files-for-upload
```

The output must not contain `.env.local` or `기획서/`. Never pass `OPENAI_API_KEY` through a Docker build argument, plain environment flag or committed file.

## Deploy a new revision

Run the quality gate first:

```powershell
pnpm.cmd check
```

Deploy from the repository root. Replace the secret version after rotation; do not switch to `latest` without an intentional revision update.

```powershell
gcloud.cmd run deploy wealth-copy `
  --project=abis-web-platform `
  --region=asia-northeast3 `
  --source=. `
  --allow-unauthenticated `
  --ingress=all `
  --service-account=wealth-copy-run@abis-web-platform.iam.gserviceaccount.com `
  --set-secrets=OPENAI_API_KEY=wealth-copy-openai-api-key:1 `
  --set-env-vars=OPENAI_MODEL=gpt-5.6 `
  --port=8080 `
  --cpu=1 `
  --memory=512Mi `
  --concurrency=20 `
  --timeout=120s `
  --min-instances=0 `
  --max-instances=3 `
  --cpu-boost `
  --execution-environment=gen2 `
  --labels=app=wealth-copy,environment=build-week `
  --quiet
```

Cloud Build uses the repository `Dockerfile` and stores the image in the regional `cloud-run-source-deploy` Artifact Registry repository. A successful deployment creates a new immutable revision and routes 100% of traffic to it.

## Rotate the OpenAI key

Add a new Secret Manager version from a local file that contains only the key. Delete that temporary file immediately afterward.

```powershell
gcloud.cmd secrets versions add wealth-copy-openai-api-key `
  --project=abis-web-platform `
  --data-file=<temporary-key-file>
```

Deploy again with `OPENAI_API_KEY=wealth-copy-openai-api-key:<new-version>`. Disable an old version only after the new revision passes verification. Secret values must never appear in shell history, logs or documentation.

## Verify

```powershell
$url = gcloud.cmd run services describe wealth-copy `
  --project=abis-web-platform `
  --region=asia-northeast3 `
  --format='value(status.url)'

Invoke-WebRequest $url -UseBasicParsing
```

For `POST /api/v2/plan`, verify HTTP 200, exactly `nextLevel`, `actions`, `progress`, three actions, `X-WealthCopy-Source-Level` and `Cache-Control: no-store`. Test `L14 → L15` separately from `L15 → L15` maintenance without using real customer data.

Read recent service errors:

```powershell
gcloud.cmd logging read `
  'resource.type="cloud_run_revision" AND resource.labels.service_name="wealth-copy" AND severity>=ERROR' `
  --project=abis-web-platform `
  --freshness=30m
```

## Roll back

List revisions and route traffic to the last known-good revision:

```powershell
gcloud.cmd run revisions list `
  --service=wealth-copy `
  --project=abis-web-platform `
  --region=asia-northeast3

gcloud.cmd run services update-traffic wealth-copy `
  --project=abis-web-platform `
  --region=asia-northeast3 `
  --to-revisions=<revision-name>=100
```

## Production follow-ups

- Replace the in-memory IP/session limiter with an authenticated distributed limiter.
- Add budget alerts, uptime monitoring and an application-level health endpoint before production traffic.
- Define retention, deletion and incident-response policies before storing any customer-derived cohort data.
- Review accessibility, privacy and financial-domain obligations before expanding beyond the demo.

Official references: [deploying Next.js to Cloud Run](https://docs.cloud.google.com/run/docs/quickstarts/frameworks/deploy-nextjs-service), [Cloud Run container contract](https://docs.cloud.google.com/run/docs/container-contract), [Cloud Run secrets](https://docs.cloud.google.com/run/docs/configuring/services/secrets).
