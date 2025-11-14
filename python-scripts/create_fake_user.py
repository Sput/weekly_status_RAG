"""
Create a fake Supabase Auth user for testing and optionally mirror it into public.users.

Requirements:
- SUPABASE_URL: e.g. https://YOUR-PROJECT.supabase.co
- SUPABASE_SERVICE_ROLE_KEY: service role key (server-only secret)

Optional:
- TEST_EMAIL: default test@example.com
- TEST_PASSWORD: default Testpass123!
- TEST_NAME: default Fake User
- UPSERT_PUBLIC_USERS: set to '1' to insert into public.users too

Usage:
  python3 python-scripts/create_fake_user.py
"""
from __future__ import annotations

import os
import sys
import json
import httpx


SUPABASE_URL = os.getenv("SUPABASE_URL")
SERVICE_ROLE = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
EMAIL = os.getenv("TEST_EMAIL", "test@example.com")
PASSWORD = os.getenv("TEST_PASSWORD", "Testpass123!")
NAME = os.getenv("TEST_NAME", "Fake User")
UPSERT_PUBLIC_USERS = os.getenv("UPSERT_PUBLIC_USERS", "0") == "1"

if not SUPABASE_URL or not SERVICE_ROLE:
    print("Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in env.", file=sys.stderr)
    sys.exit(1)


async def create_auth_user() -> dict:
    url = f"{SUPABASE_URL}/auth/v1/admin/users"
    headers = {
        "Authorization": f"Bearer {SERVICE_ROLE}",
        "apikey": SERVICE_ROLE,
        "Content-Type": "application/json",
    }
    payload = {
        "email": EMAIL,
        "password": PASSWORD,
        "email_confirm": True,
        "user_metadata": {"name": NAME},
    }
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(url, headers=headers, json=payload)
        if r.status_code >= 400:
            # If user already exists, fetch it
            if r.status_code == 422 and "already registered" in r.text.lower():
                q = f"{SUPABASE_URL}/auth/v1/admin/users?email={EMAIL}"
                r2 = await client.get(q, headers=headers)
                r2.raise_for_status()
                return r2.json()
            print(f"Create user failed: {r.status_code} {r.text}", file=sys.stderr)
            sys.exit(2)
        return r.json()


async def upsert_public_user(user: dict) -> None:
    url = f"{SUPABASE_URL}/rest/v1/users"
    headers = {
        "Authorization": f"Bearer {SERVICE_ROLE}",
        "apikey": SERVICE_ROLE,
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }
    row = {
        "id": user.get("id"),
        "name": user.get("user_metadata", {}).get("name") or NAME,
        "email": user.get("email") or EMAIL,
    }
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(url, headers=headers, json=[row])
        if r.status_code >= 400:
            print(f"Upsert public.users failed: {r.status_code} {r.text}", file=sys.stderr)
        else:
            print("Upserted into public.users.")


async def main() -> None:
    user = await create_auth_user()
    # admin users endpoint returns full user or list depending on route; normalize
    if isinstance(user, dict) and user.get("id"):
        created = user
    elif isinstance(user, list) and user:
        created = user[0]
    else:
        print(f"Unexpected user response: {json.dumps(user)[:200]}")
        sys.exit(3)

    print("Created/Retrieved user:")
    print(json.dumps({"id": created.get("id"), "email": created.get("email")}, indent=2))

    if UPSERT_PUBLIC_USERS:
        await upsert_public_user(created)


if __name__ == "__main__":
    import anyio

    anyio.run(main)

