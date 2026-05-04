# ShortCut Studio — AWS infrastructure

Terraform for the web-stub installer's runtime backend: S3 (release storage),
CloudFront (CDN), API Gateway + Lambda (manifest + telemetry), SQS (event
buffer).

## Prerequisites

1. **AWS account** with billing alarms set ($20/mo + $100/mo recommended)
2. **AWS CLI** configured locally: `aws configure --profile default`
3. **Terraform ≥ 1.6** installed
4. **Node.js 20+** (used by Lambda packaging step)

Custom domain (optional, defer to v2): a registered domain delegated to a
Route53 hosted zone.

## First deploy

```sh
cd infra/aws

# 1. Install Lambda deps (Terraform's archive_file zips node_modules)
cd lambda/manifest && npm install --production && cd ../..
cd lambda/events   && npm install --production && cd ../..

# 2. Configure
cp terraform.tfvars.example terraform.tfvars
# edit terraform.tfvars — at minimum set aws_region + aws_profile

# 3. Deploy
terraform init
terraform plan
terraform apply
```

Apply takes ~5 minutes (CloudFront propagation is the slow part). On
success, capture the outputs:

```sh
terraform output
```

You'll see:
- `releases_bucket` — S3 bucket name to upload payloads + manifests to
- `cloudfront_domain` — `dXXXXX.cloudfront.net` for payload URLs
- `api_endpoint` — `https://YYYYY.execute-api.<region>.amazonaws.com/v1/manifest.json`
- `events_endpoint` — POST endpoint for telemetry
- `publisher_iam_user` — IAM user for the release-publish CI role

## Wire the deployed URLs into the client

Edit `src/src/build/installer.nsh`:

```nsis
StrCpy $MANIFEST_URL "<api_endpoint output>"
```

Update `src/src/build/fallback-manifest.json` so the `app.url` field uses
the CloudFront domain:

```json
"app": {
  "url": "https://<cloudfront_domain>/releases/0.5.0/x64/app-0.5.0.7z",
  ...
}
```

(Phase 5's `publish-release.mjs` script will populate this dynamically.)

## Upload an initial manifest

The Lambda returns 404 until `manifests/v1/stable.json` exists. Bootstrap
with a copy of the baked-in fallback:

```sh
aws s3 cp ../../src/src/build/fallback-manifest.json \
  s3://$(terraform output -raw releases_bucket)/manifests/v1/stable.json
```

## Create publisher access keys

Terraform creates the IAM user but not the access keys (intentional — keys
are sensitive credentials that shouldn't sit in tfstate). After apply:

1. Open the AWS Console → IAM → Users → `shortcutstudio-publisher`
2. Security credentials → Create access key → CLI use
3. Save the keys; `publish-release.mjs` (Phase 5) reads them from
   `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` env vars

## Costs

Expected steady-state at < 10k MAU:
- S3 storage: ~$0.50/mo (each release ~50 MB; keep ~5 versions)
- CloudFront egress: $0–10/mo depending on update volume
- Lambda invocations: pennies (free tier covers 1M/mo)
- API Gateway: pennies (free tier covers 1M/mo)
- SQS: pennies (free tier covers 1M/mo)
- **Total**: < $5/mo

Set CloudWatch billing alarms to catch surprises:

```sh
aws cloudwatch put-metric-alarm \
  --alarm-name shortcutstudio-bill-warning \
  --metric-name EstimatedCharges --namespace AWS/Billing \
  --statistic Maximum --period 21600 --evaluation-periods 1 \
  --threshold 20 --comparison-operator GreaterThanThreshold \
  --dimensions Name=Currency,Value=USD
```

## Update / redeploy

After editing the Lambda source:

```sh
cd lambda/manifest && npm install --production && cd ../..
terraform apply
```

The `archive_file` data sources will detect the changed source and re-zip,
and Lambda will pick up the new code.

## Tearing down

```sh
terraform destroy
```

(S3 bucket must be empty first — `aws s3 rm s3://<bucket> --recursive`.)

## What's NOT in this module

- Custom Lambda authorizers / API keys (manifest + events are public)
- WAF rules (low-risk public endpoints; add later if abused)
- DLQ alarming (DLQ exists, but no SNS notification on entry — add when
  the events lambda has real traffic)
- Multi-region failover (single-region; CloudFront mitigates US-east-1
  outage exposure for payload reads but not for manifest serving)

These are explicit v2 items.
