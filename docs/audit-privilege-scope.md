# Audit Privilege Scope — Documentation

**Last Updated:** 2026-09-20
**Related:** `scripts/audit/notification-inventory.mjs`

## Purpose

This document defines the exact scope of the privilege verification performed by the trusted audit harness. It exists to prevent over-broad claims about the audit role and to enable precise threat modeling.

## Narrow Factual Statement

> **In the current effective session, selected privileges on checked public objects are zero.**

This is the strongest claim the harness currently supports. It is deliberately
narrow and does **not** assert that the role is globally read-only, that it
lacks `EXECUTE` on functions, that it cannot write via views, or that it is
restricted outside the `public` schema. See **What IS NOT Checked** and
**Claim Guidance** below for the exact boundary.

## What IS Checked

### Database Objects

| Object Type | Checked | Method |
|-------------|---------|--------|
| Ordinary tables (`pg_class.relkind = 'r'`) | ✅ | `pg_catalog.has_table_privilege()` |
| Partitioned tables (`pg_class.relkind = 'p'`) | ✅ | `pg_catalog.has_table_privilege()` |
| Column-level (INSERT, UPDATE, REFERENCES) | ✅ | `pg_catalog.has_column_privilege()` |
| Schema `public` only | ✅ | `pg_namespace.nspname = 'public'` |

### Privileges Checked

**Table-level:**
- INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER

**Column-level:**
- INSERT, UPDATE, REFERENCES

### Additional Checks

- `current_setting('transaction_read_only')` = `on`
- Role identity (`current_user` / `session_user`)
- PostgreSQL version match

## What IS NOT Checked

### Database Objects NOT Covered

| Object Type | Reason |
|-------------|--------|
| **Views** (`pg_class.relkind = 'v'`) | Not covered by current query |
| **Materialized views** (`relkind = 'm'`) | Not covered |
| **Foreign tables** (`relkind = 'f'`) | Not covered |
| **Sequences** (`relkind = 'S'`) | Not covered |
| **Functions / procedures** | Not covered |
| **Schemas other than `public`** | Not covered |
| **Large objects** | Not covered |
| **Types / domains** | Not covered |
| **Extensions** | Not covered |

### Privileges NOT Checked

- `EXECUTE` on functions
- `USAGE` on sequences
- `USAGE` on custom types
- `TRUNCATE` via inheritance
- `ALTER` / `CREATE` / `DROP` on any object
- Row-level security policies
- Default privileges (`ALTER DEFAULT PRIVILEGES`)

## Threat Model Scope

### In Scope

- **Current-session, checked-scope claim:** In the current effective session, checked ordinary tables in schema `public` (`relkind = 'r'`) show zero table-level write grants for the checked privileges (INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER).
- **Current-session, checked-scope claim:** In the current effective session, checked partitioned tables in schema `public` (`relkind = 'p'`) show zero table-level write grants for the same checked privileges.
- **Current-session, checked-scope claim:** In the current effective session, checked columns of the above tables show zero column-level write grants for the checked privileges (INSERT, UPDATE, REFERENCES).

> **Scope disclaimer:** The above claims describe only what the harness **verified** in the **current effective session** against **checked public objects**. They do **not** assert that the role is globally read-only, nor that it cannot write via un-checked paths (views, foreign tables, functions, sequences, other schemas, or objects outside the checked relation kinds). Refer to **What IS NOT Checked** and **Claim Guidance** below for the exact boundary.

### Out of Scope

- **Role cannot write via views** — NOT verified
- **Role cannot write via foreign tables** — NOT verified
- **Role cannot call mutating functions** — NOT verified
- **Role cannot use sequences** — NOT verified
- **Cross-schema access** — NOT verified

### Claim Guidance

| Claim | Safe? |
|-------|-------|
| "In the current effective session, selected privileges on checked public objects are zero." | ✅ **Safe — recommended wording** |
| "Role has no table-level write grants on public ordinary/partitioned tables" | ✅ **Safe** |
| "Role has no column-level write grants on public ordinary/partitioned tables" | ✅ **Safe** |
| "Role is SELECT-only" | ❌ **Over-broad — avoid** |
| "Role is read-only" | ❌ **Over-broad — avoid** |
| "Role cannot write to any object" | ❌ **Over-broad — avoid** |
| "Role has no write privileges globally" | ❌ **Over-broad — avoid** |

## Recommended Future Work

To broaden the scope:

1. **Add views** — Query `pg_class.relkind = 'v'` and `has_table_privilege`
2. **Add foreign tables** — `relkind = 'f'`
3. **Add sequences** — `pg_sequence` + `has_sequence_privilege`
4. **Add function EXECUTE check** — `pg_proc` + `has_function_privilege`
5. **Add schema-wide check** — All schemas, not just `public`
6. **Document inheritance semantics** — Partitioning, table inheritance

## Awaiting Expert Direction

**Threat model decision required:**

- Is current scope sufficient for audit purposes?
- If broader scope needed, which object types are priority?
- Should this be a follow-up PR?

## References

- PostgreSQL docs: `pg_catalog.has_table_privilege`
- PostgreSQL docs: `pg_catalog.has_column_privilege`
- PostgreSQL docs: `pg_class.relkind` values
- Audit script: `scripts/audit/notification-inventory.mjs`

---

*End of documentation*