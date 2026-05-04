# Release process — ShortCut Studio v0.5.0+

End-to-end recipe for shipping a new version through the web-stub installer
+ in-app updater pipeline.

## Prerequisites (one-time)

- AWS infra deployed: see [infra/aws/README.md](../infra/aws/README.md)
- Publisher IAM access keys configured locally: `aws configure --profile <publisher>`
- Terraform outputs captured into env:
  ```sh
  cd infra/aws
  export SCS_RELEASES_BUCKET="$(terraform output -raw releases_bucket)"
  export SCS_CLOUDFRONT_ID="$(terraform output -raw cloudfront_distribution_id)"
  export SCS_CF_DOMAIN="$(terraform output -raw cloudfront_domain)"
  ```

## Standard release (no staged rollout)

```sh
cd src/src

# 1. Bump version
# Edit package.json "version" field, then commit.

# 1a. (One-time per component-version bump) Pre-fetch optional installers so
#     their SHA-256 values land in installer.nsh + the runtime manifest.
#     Without this, the stub fail-closes when a user opts into Ollama / LM
#     Studio at install time (placeholder hash refuses to launch the silent
#     installer). Idempotent — skips redownload when the cache hits.
npm run fetch-optional-components
# Writes: vendor/.cache/{OllamaSetup-*.exe, LM-Studio-*.exe}
# Writes: build/component-shas.nsh   (gitignored; !included by installer.nsh)

# 2. Build
npm run build:win
# Produces:
#   release-builds/ShortCut Studio-Web-Setup-<ver>.exe   (~1-3 MB stub)
#   release-builds/ShortCut Studio-<ver>-x64.nsis.7z      (~50 MB payload)
#   release-builds/ShortCut Studio-<ver>-x64.nsis.7z.blockmap

# 3. Smoke-test the stub on a clean Windows VM (manual). See verification
#    section in .claude/plans/i-think-we-should-velvet-tide.md.

# 4. Publish to AWS (uploads + invalidates CloudFront)
npm run publish:release
```

In-app updaters running on installed users will pick up the new manifest
within 6 hours (or immediately if the user clicks "Check" in Settings →
Updates).

## Staged rollout

Staged rollout uses two channels: keep `stable` pinned to the last
fully-rolled version, push the new one to `beta`, gate the cohort via
`meta/rollout.json`. The Lambda hashes each request's `installId` and
routes a percentile to `beta`.

### 1. Publish the new version to the `beta` channel

```sh
SCS_CHANNEL=beta npm run publish:release
```

### 2. Open the rollout to a small cohort (10%)

Edit `meta/rollout.json` (locally — see `infra/aws/rollout.json.example`)
or use the helper script:

```sh
node scripts/set-rollout.mjs --staged-channel=beta --staged-percent=10
```

The Lambda now routes ~10% of `installId`-bearing requests to the beta
manifest. The other 90% still see `stable`. Stub installs without an
`installId` (i.e. cold installs from the website, not in-app upgrades)
get the requested channel directly.

### 3. Watch for issues

- CloudWatch logs for the manifest Lambda show every request
- SQS-fed events Lambda receives install-event telemetry (CloudWatch Logs,
  Athena query, etc.) — surface failures here as the canary signal
- Settings → Updates in test installs shows what version each picks up

### 4. Ramp up

```sh
node scripts/set-rollout.mjs --staged-channel=beta --staged-percent=50
# … wait …
node scripts/set-rollout.mjs --staged-channel=beta --staged-percent=100
```

### 5. Promote to stable

Once the staged version has been at 100% for long enough:

```sh
SCS_CHANNEL=stable npm run publish:release   # republishes the same build to stable
node scripts/set-rollout.mjs --clear         # removes meta/rollout.json
```

## Migration from v0.4.x → v0.5.0 (one-time)

v0.4.x users don't have the in-app updater, so they won't auto-receive
v0.5.0. Two options:

1. **Announce manually** — post the v0.5.0 stub installer URL on the
   project site / GitHub release / mailing list. v0.4.x users download +
   run; the v0.5.0 install goes into the same `%LocalAppData%` location
   and inherits user data automatically (DBs, settings, scl_data/ all live
   under `app.getPath('userData')` which both versions share).

2. **Bridge release (v0.4.99)** — build one final monolithic NSIS
   installer (target=`nsis`, IPFS/Nginx still bundled) that includes the
   new updater code from `src/main/updater/`. Existing v0.4.x users
   download this once; the updater then auto-promotes them to v0.5.0+.
   Heavier engineering: requires reverting electron-builder.yml's target
   to `nsis` for one build, manually re-adding `vendor/{ipfs,nginx}` to
   `extraResources`, etc. **Not recommended** unless we have a critical
   mass of v0.4.x installs to migrate; the manual-announce path is
   simpler.

User data preserved across the transition: anything under
`%LocalAppData%\ShortCut Studio\` (loc_adm.db, errors.db, scl_data/, the
extras-cache directory). The new install inherits all of it on first
launch.

## Rollback

If a published version turns out to be broken:

```sh
# Re-upload the prior manifest to displace the bad one
aws s3 cp manifests/v1/stable.json.backup s3://$SCS_RELEASES_BUCKET/manifests/v1/stable.json
aws cloudfront create-invalidation --distribution-id $SCS_CLOUDFRONT_ID --paths /v1/manifest.json
```

(The publish-release.mjs script doesn't auto-snapshot the previous
manifest — keep one manually before each publish if rollback matters for
your workflow. S3 versioning is enabled on the bucket so the prior
version is always recoverable via the AWS console.)
