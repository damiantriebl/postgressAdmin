# Requirements

## User Stories

### 1. Database migration management  
WHEN I create or apply a migration,  
THEN the system SHALL run the migration safely and log changes.

### 2. Visual diff of migrations  
WHEN I modify migration scripts,  
THEN the system SHALL show a diff preview prior to applying.

### 3. Backup / snapshot  
WHEN I request a backup,  
THEN the system SHALL create a new snapshot and let me restore it.

### 4. Safe apply UI  
WHEN I trigger a migration via UI,  
THEN the system SHALL run a dry run, preview reSsults and confirm before executing.

## Acceptance Criteria

- ALL migrations must be logged and reversible.  
- The UI must show diffs and warnings for breaking changes.  
- Backups must be stored and restorable.  
- Rust backend must expose endpoints: `/migrate`, `/diff`, `/backup`, `/restore`.
- Frontend must allow visualization and trigger flow.

