# Audit Privilege Scope — Documentation

**Last Updated:** 2026-09-15
**Related:** `scripts/audit/notification-inventory.mjs`

## Purpose

This document defines the exact scope of the privilege verification performed by the trusted audit harness. It exists to prevent over-broad claims about "SELECT-only role" and to enable precise threat modeling.

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

- **Role cannot write to ordinary public tables**
- **Role cannot write to partitioned public tables**
- **Role cannot write to columns of these tables**

### Out of Scope

- **Role cannot write via views** — NOT verified
- **Role cannot write via foreign tables** — NOT verified
- **Role cannot call mutating functions** — NOT verified
- **Role cannot use sequences** — NOT verified
- **Cross-schema access** — NOT verified

### Claim Guidance

| Claim | Safe? |
|-------|-------|
| "Role has no table-level write grants on public ordinary/partitioned tables" | ✅ **Safe** |
| "Role has no column-level write grants on public ordinary/partitioned tables" | ✅ **Safe** |
| "Role is SELECT-only" | ❌ **Over-broad — avoid** |
| "Role cannot write to any object" | ❌ **Over-broad — avoid** |

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