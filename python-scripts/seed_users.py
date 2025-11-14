"""
Seed the public.roles and public.users tables with sample data.

Adapts to schema differences:
- roles.id may be bigserial or uuid; script first tries inserting with name-only,
  and falls back to providing a client-side UUID if required.
- users.id may default in DB; script omits id by default, but can generate UUIDs.

Env vars:
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- USERS_COUNT (optional, default 8 members + 1 manager)
- GENERATE_USER_UUIDS (optional, '1' to include explicit ids)

Run:
  python3 python-scripts/seed_users.py
"""
from __future__ import annotations

import os
import sys
import uuid
import random
import string
from typing import Dict, List

import httpx


SUPABASE_URL = os.getenv("SUPABASE_URL")
SERVICE_ROLE = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
COUNT = int(os.getenv("USERS_COUNT", "8"))
GEN_IDS = os.getenv("GENERATE_USER_UUIDS", "0") == "1"

if not SUPABASE_URL or not SERVICE_ROLE:
    print("Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in env.", file=sys.stderr)
    sys.exit(1)


def rand_email(name: str) -> str:
    suffix = "".join(random.choices(string.ascii_lowercase + string.digits, k=4))
    handle = name.lower().replace(" ", ".")
    return f"{handle}.{suffix}@example.com"


async def ensure_role(client: httpx.AsyncClient, name: str) -> str:
    headers = {
        "Authorization": f"Bearer {SERVICE_ROLE}",
        "apikey": SERVICE_ROLE,
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=representation",
    }

    # Try insert name-only first
    r = await client.post(f"{SUPABASE_URL}/rest/v1/roles", headers=headers, json=[{"name": name}])
    if r.status_code in (200, 201):
        data = r.json()
        return data[0]["id"]
    # Fallback: include a generated UUID id
    rid = str(uuid.uuid4())
    r2 = await client.post(
        f"{SUPABASE_URL}/rest/v1/roles",
        headers=headers,
        json=[{"id": rid, "name": name}],
    )
    if r2.status_code in (200, 201):
        data = r2.json()
        return data[0]["id"]
    # Last resort: query by name
    q = await client.get(
        f"{SUPABASE_URL}/rest/v1/roles?name=eq.{name}",
        headers={"Authorization": f"Bearer {SERVICE_ROLE}", "apikey": SERVICE_ROLE},
    )
    q.raise_for_status()
    rows = q.json()
    if not rows:
        raise RuntimeError(f"Failed to ensure role '{name}': {r.text} / {r2.text}")
    return rows[0]["id"]


async def seed_users() -> None:
    async with httpx.AsyncClient(timeout=30) as client:
        manager_role_id = await ensure_role(client, "manager")
        member_role_id = await ensure_role(client, "member")

        # Build sample users
        first_names = [
            "Alex",
            "Sam",
            "Jordan",
            "Taylor",
            "Morgan",
            "Casey",
            "Riley",
            "Jamie",
            "Avery",
            "Quinn",
        ]
        last_names = ["Lee", "Kim", "Nguyen", "Patel", "Garcia", "Diaz", "Singh", "Wong", "Brown", "Jones"]

        def full_name() -> str:
            return f"{random.choice(first_names)} {random.choice(last_names)}"

        users: List[Dict[str, str]] = []
        # Manager
        mname = full_name()
        mu = {
            "name": mname,
            "email": rand_email(mname),
            "role_id": manager_role_id,
        }
        if GEN_IDS:
            mu["id"] = str(uuid.uuid4())
        users.append(mu)
        # Members
        for _ in range(max(1, COUNT)):
            nm = full_name()
            row = {"name": nm, "email": rand_email(nm), "role_id": member_role_id}
            if GEN_IDS:
                row["id"] = str(uuid.uuid4())
            users.append(row)

        headers = {
            "Authorization": f"Bearer {SERVICE_ROLE}",
            "apikey": SERVICE_ROLE,
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=representation",
        }
        r = await client.post(f"{SUPABASE_URL}/rest/v1/users", headers=headers, json=users)
        if r.status_code >= 300:
            raise RuntimeError(f"Insert users failed: {r.status_code} {r.text}")
        print(f"Seeded {len(r.json())} users.")


if __name__ == "__main__":
    import anyio

    anyio.run(seed_users)

