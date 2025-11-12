# Supabase Heartbeat workflow

This repository includes a GitHub Actions workflow (.github/workflows/supabase-heartbeat.yml) that runs every 6 days and sends a lightweight request to your Supabase project to keep it active.

To enable it:

1. Go to the repository Settings → Secrets and variables → Actions → New repository secret.
2. Add the following secrets:
   - SUPABASE_URL: your project URL, e.g. `https://abcd1234.supabase.co`
   - SUPABASE_SERVICE_ROLE_KEY: your Supabase service_role key (or anon key if you prefer). Keep this secret private.

You can also trigger the workflow manually from the Actions tab using "Run workflow".

Notes:
- The workflow only sends an HTTP request to the Supabase project URL. If you prefer a more specific query (e.g., reading a particular table), reply with which table/endpoint to target and I will update the workflow.
