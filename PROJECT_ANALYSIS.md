# Gepis Dados Abertos - Project Analysis

**Last Updated:** April 19, 2026

## Table of Contents
1. [Project Purpose & Goal](#project-purpose--goal)
2. [Technology Stack](#technology-stack)
3. [Project Structure](#project-structure)
4. [Key Services & Components](#key-services--components)
5. [Build System & Configuration](#build-system--configuration)
6. [Data Handling & APIs](#data-handling--apis)
7. [Architecture Highlights](#architecture-highlights)
8. [Quick Reference](#quick-reference)

---

## Project Purpose & Goal

**Gepis Dados Abertos** is a desktop application for open data analysis and dataset management developed by the GEPIS research group. The application enables users to:

- Download and manage datasets from various sources
- Perform exploratory data analysis (descriptive statistics)
- Process and transform data using ETL (Extract, Transform, Load) operations
- Visualize data through interactive charts and visualizations
- Collaborate and share analysis results

### Primary Use Case
Brazilian educational data analysis, particularly:
- Centro Escolar (School Census) data
- Historical census data from INEP (2021-2025)
- Multi-year comparative analysis

---

## Technology Stack

### Desktop Framework
- **Tauri v2.0** (Release Candidate) - Rust-based framework for building cross-platform desktop apps (Linux, Windows, macOS)
  - Significantly smaller bundle size vs. Electron
  - Native OS APIs with Rust for backend

### Frontend
- **Angular 20.3.0** with TypeScript
- **Angular Material** - UI component library
- **RxJS 7.8** - Reactive programming
- **Angular Plotly.js** - Interactive data visualization
- **Angular Service Worker** - Offline support and PWA features
- **SCSS** - Custom theming

### Backend (Rust)
- **Tokio 1.0** - Async runtime
- **Reqwest 0.12** - HTTP client for API calls
- **Polars 0.41** - High-performance data processing library
  - CSV and lazy evaluation support
  - Memory-efficient operations
- **Bollard 0.19.4** - Docker API client
- **Calamine 0.24** - Excel file reading
- **Zip 2.3** - Archive handling
- **CSV 1.3** - CSV parsing
- **Serde/Serde JSON** - Serialization/deserialization

### Build Tools
- **Cargo** - Rust package manager
- **npm/Node.js** - JavaScript package management
- **Concurrently** - Run build processes in parallel

### Tauri Plugins
- `tauri-plugin-shell` - Execute shell commands
- `tauri-plugin-http` - HTTP requests
- `tauri-plugin-fs` - File system operations
- `tauri-plugin-dialog` - Native dialogs

---

## Project Structure

```
gepis-dados-abertos/
├── src-tauri/                           # Rust backend
│   ├── src/
│   │   ├── main.rs                      # Tauri app entry point & IPC commands
│   │   ├── data_processing.rs           # ETL operations (Polars-based)
│   │   └── lib.rs
│   ├── build.rs                         # Build script
│   ├── Cargo.toml                       # Rust dependencies
│   ├── capabilities/default.json        # Tauri security capabilities
│   └── tauri.conf.json                  # Tauri configuration
│
├── angular-ui/                          # Frontend application
│   ├── src/
│   │   ├── app/
│   │   │   ├── services/                # Core services
│   │   │   │   ├── config.service.ts               (Abstract)
│   │   │   │   ├── tauri-config.service.ts        (Desktop impl.)
│   │   │   │   ├── web-config.service.ts          (Web impl.)
│   │   │   │   ├── dataset-state.service.ts       (State mgmt)
│   │   │   │   ├── search-in-page.service.ts
│   │   │   │   └── environment.ts
│   │   │   ├── components/
│   │   │   │   ├── layout/
│   │   │   │   │   ├── fixed-head/                (Header/nav)
│   │   │   │   │   ├── fixed-search/              (Search UI)
│   │   │   │   │   └── fixed-statusbar/           (Status bar)
│   │   │   │   └── views/
│   │   │   │       ├── web/                       (Web routes)
│   │   │   │       │   ├── view-home
│   │   │   │       │   └── view-about
│   │   │   │       └── desktop/                   (Desktop routes)
│   │   │   │           ├── desktop-home-view      (Main dashboard)
│   │   │   │           ├── datasets/
│   │   │   │           │   ├── get-datasets       (Download UI)
│   │   │   │           │   ├── list-datasets      (Browse local)
│   │   │   │           │   └── manage-datasets
│   │   │   │           ├── analysis/
│   │   │   │           │   ├── select-analysis
│   │   │   │           │   ├── config-analysis
│   │   │   │           │   └── descritiva         (Stats analysis)
│   │   │   │           └── settings/
│   │   │   │               └── collaboration
│   │   │   ├── guards/                  # Route guards
│   │   │   ├── app.routes.ts            # Application routing
│   │   │   ├── app.config.ts            # Angular configuration
│   │   │   ├── app.ts                   # Root component
│   │   │   ├── app.html
│   │   │   ├── app.spec.ts
│   │   │   ├── app.css
│   │   │   └── app-standalone.component.ts
│   │   ├── main.ts                      # Angular bootstrap
│   │   ├── index.html
│   │   ├── styles.css
│   │   ├── custom-theme.scss            # Material theme
│   │   └── environments/
│   ├── public/
│   │   ├── data/
│   │   │   ├── datasets-registry.json   # Dataset metadata
│   │   │   └── analyses-history.json    # Analysis history
│   │   └── icons/                       # App icons
│   ├── package.json
│   ├── tsconfig.json
│   ├── angular.json
│   └── ngsw-config.json                 # Service Worker config
│
├── downloads/datasets/                  # Local dataset storage
│   └── [group_name]/[dataset_name]/
│       ├── [data_files].csv
│       └── [subfolders by year]
│
├── processed_data/                      # ETL output
│   └── [group_name]/analysis_ready.csv
│
├── capabilities/default.json            # Tauri capabilities definition
├── gen/schemas/                         # JSON schema validators
│   ├── acl-manifests.json
│   ├── capabilities.json
│   ├── desktop-schema.json
│   ├── linux-schema.json
│   └── windows-schema.json
├── icons/icon-generate.py               # Icon generation script
├── www/                                 # Built frontend (pre-rendered)
│   ├── prerendered-routes.json
│   └── browser/                         # Static files
├── target/                              # Cargo build output
├── Cargo.toml                           # Root Rust manifest
├── package.json                         # Root npm config
├── tauri.conf.json                      # Main Tauri config
├── README.org                           # Project documentation
├── Tauri.toml_bk                        # Backup config
├── tail-log.sh / tail-log.ps1           # Debug logging scripts
└── PROJECT_ANALYSIS.md                  # This file
```

### Directory Organization
- **src-tauri/** - Rust backend (CLI commands, ETL, data processing)
- **angular-ui/** - Frontend web/desktop UI (TypeScript, Angular)
- **downloads/datasets/** - User-downloaded datasets
- **processed_data/** - Cleaned/processed data from ETL
- **www/browser/** - Pre-rendered static assets
- **gen/schemas/** - JSON validation schemas
- **capabilities/** - Tauri security/permission definitions

---

## Key Services & Components

### Core Services

| Service | Location | Purpose |
|---------|----------|---------|
| `ConfigService` | `angular-ui/src/app/services/config.service.ts` | Abstract service for loading app configuration (desktop vs. web) |
| `TauriConfigService` | `angular-ui/src/app/services/tauri-config.service.ts` | Desktop-specific config (uses Tauri IPC) |
| `WebConfigService` | `angular-ui/src/app/services/web-config.service.ts` | Web-specific config (HTTP fetch) |
| `DatasetStateService` | `angular-ui/src/app/services/dataset-state.service.ts` | Manages dataset state across the application |
| `SearchInPageService` | `angular-ui/src/app/services/search-in-page.service.ts` | In-page search functionality |

### Layout Components

| Component | Purpose |
|-----------|---------|
| `FixedHead` | Header/navigation bar with branding |
| `FixedStatusbar` | Bottom status bar for messages |
| `FixedSearch` | Search/filter interface |

### Feature Modules

| Module | Location | Purpose |
|--------|----------|---------|
| **Datasets Management** | `angular-ui/src/app/components/views/desktop/datasets/` | Browse, download, manage local datasets |
| **Data Analysis** | `angular-ui/src/app/components/views/desktop/analysis/` | Descriptive statistics and analysis setup |
| **Visualizations** | Various components | Bar charts and Plotly-based interactive charts |
| **Settings** | `angular-ui/src/app/components/views/desktop/settings/` | Collaboration and app settings |
| **Home Dashboard** | `desktop-home-view/` | Main entry point with overview |

### Route Structure

**Desktop Routes** (protected by `isTauriGuard`):
- `/desktop` - Home/dashboard
- `/datasets/get` - Download datasets
- `/datasets/list` - Browse local datasets
- `/analysis/*` - Analysis workflows
- `/settings/*` - Configuration

**Web Routes** (fallback):
- `/home` - Web home page
- `/about` - About page

### Route Guards
- `isTauriGuard` - Only allows desktop (Tauri) environment
- Other guards for feature-specific access control

---

## Build System & Configuration

### Tauri Configuration (`tauri.conf.json`)

```json
{
  "app": {
    "windows": [
      {
        "title": "Gepis Dados Abertos",
        "width": 1200,
        "height": 800,
        "minWidth": 800,
        "minHeight": 600
      }
    ]
  },
  "build": {
    "frontendDist": "www/browser",
    "devUrl": "http://localhost:4200",
    "beforeBuildCommand": "npm run ng-build-prod"
  },
  "bundle": {
    "targets": ["rpm", "deb", "nsis", "msi"],
    "resources": ["public/data/**/*", "icons/**/*"]
  }
}
```

### Build Commands

**Development:**
```bash
npm run tauri:dev              # Start dev server with hot reload
npm run start:dev             # Alias for tauri:dev
```

**Production:**
```bash
npm run tauri:prod            # Build and package for all platforms
npm run start:prod            # Build and run executable
npm run ng-build-prod         # Angular production build only
```

### Build Process Flow

```
1. npm run tauri:prod
   ├─ Angular compiles: src/** → www/browser/**
   ├─ Cargo compiles: src-tauri/src/** → executable
   └─ Tauri packages: frontend + backend → installers
      ├─ Windows (NSIS, MSI)
      ├─ Linux (RPM, DEB)
      └─ macOS (DMG, Apple Silicon)
```

### Frontend Build Output
- Location: `www/browser/`
- Contains: index.html, JavaScript chunks, CSS, icons, data
- Pre-rendered routes in: `www/prerendered-routes.json`

---

## Data Handling & APIs

### Tauri IPC Commands

#### 1. `download_dataset(url, metadata)`
**Purpose:** Download dataset from URL and organize locally

**Process:**
1. Fetches file from URL (supports HTTPS, ignores SSL in dev)
2. Auto-extracts ZIP files based on expected format
3. Organizes into: `downloads/datasets/[group]/[short_title]/`
4. Updates local registry

**HTTP Client Features:**
- Mozilla user agent for compatibility
- Async/await with Tokio runtime
- Error handling and retry logic
- SSL certificate bypass in dev mode

#### 2. `run_etl(group_name, files[], columns[])`
**Purpose:** Data processing pipeline using ETL

**ETL Process:**
1. Resolves file paths from registry
2. Reads CSV files with semicolon (`;`) separator using Polars
3. Selects specified columns
4. Concatenates multiple files vertically
5. Outputs to: `processed_data/[group_name]/analysis_ready.csv`

**Features:**
- Lazy evaluation for memory efficiency
- Column filtering and selection
- Multi-file concatenation
- Handles headers and data validation

### Data Registry System

**datasets-registry.json** - Central metadata store
```json
{
  "datasets": [
    {
      "group": "censo_escolar",
      "title": "Censo Escolar",
      "files": ["file1.csv", "file2.csv"],
      "columns": ["code", "name", "value", ...],
      "source": "URL"
    }
  ]
}
```

**analyses-history.json** - Records of past analyses
- Tracks user analysis activities
- Enables collaborative workflows
- Stores analysis metadata and results

**Location:** `angular-ui/public/data/`
**Bundled:** Yes, included in app resources

### Data File Formats
- **Primary:** CSV (semicolon-separated)
- **Secondary:** Excel (via Calamine)
- **Archives:** ZIP (auto-extracted)
- **Output:** CSV (analysis ready)

### Backend Data Processing (Rust)

**Polars Library Usage:**
```rust
// Example workflow
let df = CsvReader::new()
    .infer_schema_length(Some(1000))
    .with_separator(b';')
    .finish()
    .lazy()
    .select([col("column1"), col("column2")])
    .collect()
```

- High performance (faster than Pandas)
- Lazy evaluation for large datasets
- Type safety with Rust

---

## Architecture Highlights

### Frontend-Backend Communication

**IPC (Inter-Process Communication):**
- Angular invokes Rust commands via Tauri IPC
- JSON serialization for data passing
- Async operations with proper error handling
- Commands defined in `src-tauri/src/main.rs`

**Example:**
```typescript
// Frontend (Angular)
invoke('download_dataset', { url, metadata })
  .then(result => console.log(result))
  .catch(err => console.error(err))
```

```rust
// Backend (Rust)
#[tauri::command]
async fn download_dataset(url: String, metadata: Value) -> Result<String> {
    // Implementation
}
```

### Environment Detection

**isTauri() Function:**
- Detects desktop vs. web environment at runtime
- Enables conditional logic for platform-specific features
- Used in services and components

**Application Modes:**
- **Desktop (Tauri):** Full functionality with file system access
- **Web:** Limited features, cloud storage only

### Conditional Routing

**Route Guards:**
- `isTauriGuard` - Desktop-only features
- Feature flags for progressive enhancement

### Data Processing Pipeline

```
Raw Data (CSV, Excel, ZIP)
    ↓
HTTP Download (Reqwest) or Local File (TauriFS)
    ↓
File Extraction (Zip crate)
    ↓
CSV Parsing (Polars)
    ↓
Column Selection & Filtering (Polars)
    ↓
Multi-file Concatenation (Polars)
    ↓
Output: analysis_ready.csv
```

### UI/UX Architecture

- **Material Design:** Angular Material components
- **Responsive Layout:** CSS Grid/Flexbox
- **Dark Theme:** Custom SCSS with CSS variables
- **Interactive Visualizations:** Plotly.js integration
- **Search:** Full-text search across datasets
- **Offline Support:** Service Worker with Angular NGSW

### Security Model

**Tauri Capabilities** (`capabilities/default.json`):
- Defines what the app can and cannot do
- Shell command restrictions
- File system access boundaries
- HTTP request allowlists

---

## Quick Reference

### Quick Start

**Development:**
```bash
cd angular-ui
npm install
npm run tauri:dev
```

**Production Build:**
```bash
npm run tauri:prod
# Output: Installers in src-tauri/target/release/bundle/
```

### Important Paths

| Path | Purpose |
|------|---------|
| `src-tauri/src/main.rs` | Rust entry point & IPC commands |
| `src-tauri/src/data_processing.rs` | ETL logic |
| `angular-ui/src/app/services/` | Core services |
| `angular-ui/src/app/components/views/desktop/` | Feature pages |
| `downloads/datasets/` | Downloaded datasets |
| `processed_data/` | ETL output |
| `angular-ui/public/data/` | Registries (datasets, analyses) |

### Key Dependencies

**Rust:**
```toml
tauri = "2.0.0-rc"
tokio = "1.0"
polars = "0.41"
reqwest = "0.12"
```

**Frontend:**
```json
"@angular/core": "20.3.0",
"@angular/material": "20.2.0",
"plotly.js-angular": "^3.0.0",
"rxjs": "7.8"
```

### Debug & Logging

**Log Files:**
- Dev console: Browser DevTools (F12)
- Rust logging: Tauri console
- Scripts: `tail-log.sh` (Linux/macOS), `tail-log.ps1` (Windows)

**Run with Debug Logging:**
```bash
npm run tauri:dev -- --verbose
```

### Common Tasks

| Task | Command |
|------|---------|
| Update dependencies | `cargo update` & `npm update` |
| Format code | `cargo fmt` & `npm run lint` |
| Run tests | `npm run test` |
| Build for release | `npm run tauri:prod` |
| Clean build | `cargo clean` & `npm run ng-clean` |

---

## Notes for Development

1. **Monorepo Structure:** Rust backend + Angular frontend in single repo
2. **Hot Reload:** Development mode supports live UI updates
3. **Cross-Platform:** Builds for Windows, macOS, Linux
4. **Data Processing:** Rust handles heavy computation, Angular handles UI
5. **Offline First:** Service Worker enables offline usage
6. **Security:** Tauri capabilities restrict privileged operations
7. **Extensibility:** Plugin system for additional functionality

---

## Related Files
- [README.org](README.org) - Project overview
- [Cargo.toml](Cargo.toml) - Rust configuration
- [package.json](package.json) - NPM configuration
- [tauri.conf.json](tauri.conf.json) - Tauri settings
- [angular-ui/angular.json](angular-ui/angular.json) - Angular CLI config

