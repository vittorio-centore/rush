# Rush ML Service

FastAPI service and offline jobs for Rush recommendations.

## Local dev

```bash
cd ml-service
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
uvicorn ml_service.main:app --reload
```

## Required environment

```bash
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
RECOMMENDER_SERVICE_TOKEN=
```

## Optional environment

```bash
REDIS_URL=
S3_BUCKET=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1
ACTIVE_MODEL_MANIFEST_KEY=models/active-manifest.json
LOCAL_ARTIFACT_DIR=./artifacts
```
