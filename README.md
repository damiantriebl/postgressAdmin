PostgressAdmin

Desktop client to manage and test PostgreSQL connections. Built with Tauri + React + TypeScript (Vite) and a native Rust backend for secure operations (e.g., credential vault and health checks).

# Requirements (Windows):
 - Node 18+ / PNPM or NPM
 - Rust + stable toolchain + Tauri dependencies
 - WebView2 Runtime
 - MSVC/Build Tools (see SETUP_WINDOWS.md)

```
pnpm i           # or npm i
pnpm tauri dev   # or npx tauri dev
pnpm tauri build # build binary
```

Features

Connection profiles: create/edit/select (host, port, DB, user).

Native credential vault (Rust) for secure secret storage.

Connection health checks and basic pool metrics.

Test queries and safe CRUD test operations.

Error handling with recovery paths.

Additional design/implementation docs are in the repo:
CONNECTION_PROFILE_STORE_IMPLEMENTATION.md, TASK_5_CONNECTION_HEALTH_IMPLEMENTATION.md,
DATA_MODIFICATION_TEST.md, ERROR_HANDLING_IMPROVEMENTS.md, verify_credential_vault.md, etc.

Tech Stack

UI: React + TypeScript (Vite)

Desktop shell: Tauri

Native: Rust (connection services, vault, health checks)

Styles: TailwindCSS

Primary OS: Windows (see SETUP_WINDOWS.md)

Requirements

Node.js 18+ and pnpm (or npm/yarn)

Rust (stable) + cargo

Tauri deps on Windows: WebView2 Runtime, MSVC/Build Tools

Setup

Clone repo:

git clone https://github.com/damiantriebl/postgressAdmin
cd postgressAdmin


Install dependencies:
```
pnpm i   # or npm i
```

Optional .env configuration:

DATABASE_URL=postgres://user:pass@host:5432/dbname


Install Windows dependencies (WebView2, Build Tools): see SETUP_WINDOWS.md

Common Scripts
```
pnpm dev         # Frontend only (Vite)
pnpm tauri dev   # Desktop app in dev mode
pnpm tauri build # Build native binary
```
Development

Frontend in src/ (React/TS)

Native backend in src-tauri/ (Rust)

Assets in public/

Configs: vite.config.ts, tailwind.config.js, tsconfig*.json

Run Locally
pnpm tauri dev
# Opens the desktop app, Rust backend logs in console

Build

```
pnpm tauri build
```

# Binary output in src-tauri/target/release

Troubleshooting (Windows)

Missing toolchains / Build Tools: run MSVC/Build Tools installer (see vs_buildtools.exe and guide).

WebView2: install Evergreen runtime (required by Tauri).

dlltool / link.exe errors: check Rust profile, rustup, and MSVC in PATH; see SETUP_WINDOWS.md.

Roadmap

Query editor with history

Profile export/import

Performance metrics per connection

Cross-platform support

License

TBD
