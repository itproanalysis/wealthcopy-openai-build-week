# WealthCopy GCP deployment

## Service

| Item | Value |
| --- | --- |
| Public URL | `https://wealth-copy-470320899177.asia-northeast3.run.app` |
| Project | `abis-web-platform` |
| Region | `asia-northeast3` |
| Cloud Run service | `wealth-copy` |
| Last verified revision | `wealth-copy-00011-zxg` (2026-07-20, 100% traffic) |
| Runtime identity | `wealth-copy-run@abis-web-platform.iam.gserviceaccount.com` |
| Secret | `wealth-copy-openai-api-key` |
| Model environment | `OPENAI_MODEL=gpt-5.6-luna` |
| Resources | 1 CPU, 512 MiB, concurrency 20, timeout 30 seconds |
| Scaling | minimum 0, maximum 3 instances |

Cloud Run terminates TLS and injects `PORT=8080`. The final container runs as a non-root user and receives the API key only at instance startup.

The last verification covered the public root and health endpoint, strict `wealth-report-v2` interpretation, normal L6→L7 reporting, a monthly-deficit safety route, the terminal L15 route, foreign-origin rejection, no-store headers, removal of `/api/v2/plan`, and absence of public backdata terminology in API responses and client bundles. The verified revision had no `ERROR`-severity Cloud Run log entries after smoke testing.

The concentrated L6 demo preset is live on `wealth-copy-00011-zxg`. The root page, health endpoint, strict report endpoint, eight composition rows, three priorities, three route stages, `no-store` response policy, mobile no-overflow path, core text contrast, and keyboard focus indicator were reverified after traffic cutover.

## Pre-deploy gate

```powershell
pnpm.cmd check
gcloud.cmd meta list-files-for-upload
```

The upload manifest must exclude `.env.local`, `.git/`, `node_modules/`, `.next/` and the user-owned planning directory. Never pass a secret through a Docker build argument or plain environment value.

## Deploy

```powershell
gcloud.cmd run deploy wealth-copy `
  --project=abis-web-platform `
  --region=asia-northeast3 `
  --source=. `
  --allow-unauthenticated `
  --ingress=all `
  --service-account=wealth-copy-run@abis-web-platform.iam.gserviceaccount.com `
  --set-secrets=OPENAI_API_KEY=wealth-copy-openai-api-key:1 `
  --set-env-vars=OPENAI_MODEL=gpt-5.6-luna `
  --port=8080 `
  --cpu=1 `
  --memory=512Mi `
  --concurrency=20 `
  --timeout=30s `
  --min-instances=0 `
  --max-instances=3 `
  --cpu-boost `
  --execution-environment=gen2 `
  --labels=app=wealth-copy,environment=build-week `
  --quiet
```

## Verify

```powershell
$url = gcloud.cmd run services describe wealth-copy `
  --project=abis-web-platform `
  --region=asia-northeast3 `
  --format='value(status.url)'

Invoke-WebRequest $url -UseBasicParsing
Invoke-WebRequest "$url/api/healthz" -Method Head -UseBasicParsing
```

For `POST /api/v3/report`, verify:

- HTTP 200 and `Cache-Control: no-store`
- exactly eight composition rows
- current/next level and threshold gap at L1, L14 and L15 boundaries
- three ranked priorities and three route horizons
- deterministic safety-stop and model-fallback parity
- rejection of non-JSON, foreign-origin, compressed, extra-field and over-8-KiB requests
- the removed v2 endpoint returns 404

Review recent errors:

```powershell
gcloud.cmd logging read `
  'resource.type="cloud_run_revision" AND resource.labels.service_name="wealth-copy" AND severity>=ERROR' `
  --project=abis-web-platform `
  --freshness=30m
```

## Roll back

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

- Replace the in-memory limiter with authenticated distributed limiting.
- Add budget and incident alert channels.
- Complete independent privacy, retention, deletion, accessibility and financial/legal review.
- Do not persist customer financial snapshots until those controls exist.
