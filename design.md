# Design

## Architecture

- **Backend** en Rust con Turso SDK accediendo a Neon Postgres.
- Endpoints:
  - `POST /migrate { script }`
  - `GET /diff?script=...`
  - `POST /backup`
  - `POST /restore { snapshot_id }`
- **Frontend** en React/TS:
  - Página “Migrations” -> lista, diff preview, aplicar, estado.
  - Página “Backups” -> ver snapshots, crear y restaurar.

## Data Model (Postgres)

```sql
CREATE TABLE migrations_log (
  id SERIAL PRIMARY KEY,
  script TEXT NOT NULL,
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT,
  checksum TEXT
);

CREATE TABLE backups (
  id SERIAL PRIMARY KEY,
  snapshot_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
