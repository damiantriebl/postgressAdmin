# Setup Instructions

## Install Dependencies

### Frontend Dependencies
```bash
npm install
```

### Rust Dependencies
The Rust dependencies will be installed automatically when you build the project.

## Development

### Start Development Server
```bash
npm run tauri dev
```

### Build for Production
```bash
npm run tauri build
```

## Project Structure

```
├── src/                    # React frontend
│   ├── components/         # React components (to be created)
│   ├── services/          # API services
│   ├── types/             # TypeScript type definitions
│   └── index.css          # Tailwind CSS
├── src-tauri/             # Rust backend
│   ├── src/
│   │   ├── commands/      # Tauri commands
│   │   ├── database/      # Database modules
│   │   ├── lib.rs         # Main library
│   │   └── main.rs        # Entry point
│   └── Cargo.toml         # Rust dependencies
└── package.json           # Node.js dependencies
```

## Next Steps

The project structure is now set up. You can proceed with the next tasks:
- Task 2.1: Implement DatabaseConnection struct and basic connection logic
- Task 2.2: Add connection configuration and validation
- Task 2.3: Implement connection persistence and security