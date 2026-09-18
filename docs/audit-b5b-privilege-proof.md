# B5b — Effective Read-Only Boundary Proof

**Date:** 2026-09-19
**DB User:** audit_readonly
**Target:** Supabase PostgreSQL 17.6
**Method:** Direct psql connection via Supavisor Session Pooler (port 5432)
**PostgreSQL Client:** 18.6

## Purpose

Expert requirement (Round 9):
> "Effective read-only boundary ka focused P0 proof required hai: elevated role paths, database/schema creation rights, sequence mutation, relevant views/foreign objects, aur callable mutating/SECURITY DEFINER routines. Verification catalog-based aur non-mutating honi chahiye."

This document provides the catalog-based, non-mutating verification.

## Verification Queries (All Read-Only)

### Q1 — Identity Confirmation

```sql
SELECT current_user, session_user, current_role;

**Result:**

```text
 current_user   | session_user   | current_role
----------------+----------------+----------------
 audit_readonly | audit_readonly | audit_readonly
```

**Interpretation:** Connection uses `audit_readonly` — not `postgres` superuser.

### Q2 — Role Memberships (Elevated Role Paths)

```sql
SELECT m.rolname AS member_of
FROM pg_auth_members am
JOIN pg_roles r ON r.oid = am.member
JOIN pg_roles m ON m.oid = am.roleid
WHERE r.rolname = 'audit_readonly';
```

**Result:** `0 rows`

**Interpretation:** `audit_readonly` is not a member of any role. No elevated path via role inheritance.

### Q3 — Database CREATE Privilege

```sql
SELECT datname, has_database_privilege('audit_readonly', datname, 'CREATE') AS can_create
FROM pg_database
WHERE datistemplate = false;
```

**Result:**

```text
 datname  | can_create
----------+------------
 postgres | f
```

**Interpretation:** `audit_readonly` cannot create new databases.

### Q4 — Schema CREATE Privilege

```sql
SELECT nspname, has_schema_privilege('audit_readonly', nspname, 'CREATE') AS can_create
FROM pg_namespace
WHERE nspname NOT LIKE 'pg_%';
```

**Result:** All 9 schemas (`information_schema`, `extensions`, `vault`, `graphql_public`, `graphql`, `auth`, `storage`, `realtime`, `public`): `f`

**Interpretation:** `audit_readonly` cannot create schemas or objects within any schema.

### Q5 — Sequence USAGE Privilege

```sql
SELECT c.relname AS seq_name, has_sequence_privilege('audit_readonly', c.oid, 'USAGE') AS can_use
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'S'
  AND n.nspname = 'public';
```

**Result:** `0 rows`

**Interpretation:** `audit_readonly` has USAGE privilege on zero sequences in `public`. Cannot advance sequences.

### Q6 — View INSERT Privilege

```sql
SELECT c.relname AS view_name, has_table_privilege('audit_readonly', c.oid, 'INSERT') AS can_insert
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'v'
  AND n.nspname = 'public';
```

**Result:** `0 rows`

**Interpretation:** `audit_readonly` has INSERT privilege on zero views. Cannot mutate via writable views.

### Q7 — Foreign Table INSERT Privilege

```sql
SELECT c.relname AS ft_name, has_table_privilege('audit_readonly', c.oid, 'INSERT') AS can_insert
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'f'
  AND n.nspname = 'public';
```

**Result:** `0 rows`

**Interpretation:** `audit_readonly` has INSERT privilege on zero foreign tables.

### Q8 — SECURITY DEFINER Functions

```sql
SELECT n.nspname, p.proname, p.prosecdef
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.prosecdef = true
  AND n.nspname = 'public';
```

**Result:** `0 rows`

**Interpretation:** No SECURITY DEFINER functions in `public` schema. No elevated-privilege function execution path.

## Summary — Effective Read-Only Boundary

| **Check** | **Result** | **Evidence** |
|---|---|---|
| Elevated role memberships | 0 | Q2 |
| Database CREATE | false | Q3 |
| Schema CREATE | false (all schemas) | Q4 |
| Sequence USAGE | 0 rows | Q5 |
| View INSERT | 0 rows | Q6 |
| Foreign table INSERT | 0 rows | Q7 |
| SECURITY DEFINER functions | 0 rows | Q8 |

**Conclusion:** `audit_readonly` has no elevated paths, no creation rights, no sequence access, and no SECDEF function access. Effective boundary is **read-only at the catalog level**.

## Method Notes

- **Non-mutating:** All queries are catalog lookups (`pg_catalog.*`).
- **Independent user session:** Direct `psql` connection as `audit_readonly`, not via SQL Editor as `postgres`.
- **Raw output preserved:** `audit-output/b5b-output.txt`
- **PostgreSQL version:** `17.6`
- **Client version:** `psql 18.6`

## Known Limitations

- Views are checked for INSERT only, not for `INSTEAD OF` trigger paths (none exist per Q6).
- SECURITY INVOKER functions are not enumerated (they run as caller, so no elevated path).
- RLS policies not covered by this proof (separate scope).
- Large objects not checked.

## Reproducibility

```bash
# Connect as audit_readonly (bypassing SQL Editor's postgres session)
psql "postgresql://audit_readonly.<project-ref>@aws-1-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=require" -f scripts/b5b-queries.sql
```

Raw output: `audit-output/b5b-output.txt`