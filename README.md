# freel

A time tracker and invoicing app for freelance work. One codebase for desktop and Android: projects, tasks, a running timer, and invoices generated from the hours it recorded.

> Built for personal use. Everything lives in a local SQLite file; the optional sync server is a separate service and is not part of this repository — see [Sync](#sync). Interface is Russian only.

<p align="center">
  <img src="screenshots/dashboard.webp" width="720" alt="Dashboard" />
</p>
<p align="center">
  <img src="screenshots/projects.webp" width="340" alt="Projects" />
  &nbsp;&nbsp;
  <img src="screenshots/billing.webp" width="340" alt="Billing" />
</p>
<p align="center">
  <sub>Dashboard &nbsp;·&nbsp; Projects &nbsp;·&nbsp; Billing</sub>
</p>

## Features

**Tracking**

- Projects → tasks → time entries, one day of work per entry
- Timer with pause; elapsed time survives quitting the app
- Hourly or fixed rate per task, in RUB / USD / EUR / GBP / CNY
- Eight task statuses — paused, next, in work, code review, manager review, awaiting upload, awaiting payment, done

**Billing**

- Invoices generated from completed tasks, grouped by project
- Plain-text export for sending to a client, hours rounded to the nearest half
- Invoice statuses: awaiting, sent, paid
- Month chart — a solid line for money actually received against a dashed line for what the invoices expected

**Desktop**

- **Edge panel** — a second window that slides out when the pointer rests against the left screen edge, so time can be started and stopped without bringing the main window forward
- Running timer mirrored into the window title: `1:24:07 · Landing page — freel`

**Android**

- Ongoing timer notification with a system chronometer and pause / resume / stop buttons, held by a foreground service — it keeps counting with the app backgrounded and no JavaScript running. Implemented as a separate crate, [`tauri-plugin-timer`](https://crates.io/crates/tauri-plugin-timer), published to crates.io

<p align="center">
  <img src="screenshots/notification.webp" width="300" alt="Ongoing timer notification" />
</p>

**Data**

- Backup and restore through a versioned JSON file — v1 files still import into the v2 format
- Optional sync between devices against a self-hosted server
- Soft deletes: rows are tombstoned, never dropped

## Architecture

```
Nuxt 4 + Pinia  (main window and edge panel — one bundle, the window's
        │        label picks which one renders)
        │
        ├─ tauri-plugin-sql ──► SQLite (freel.db)      reads and simple writes
        │
        └─ invoke() ──► Rust
                          ├── soft_delete       cascade in one transaction
                          ├── restore_backup    whole file applied atomically
                          └── sync              round trip + local apply, also
                                                one transaction; the account
                                                token never enters JavaScript
```

Anything that must not be half-applied goes through Rust. `tauri-plugin-sql` spreads separate `execute` calls across pooled connections, so a cascade issued from JavaScript could survive a failure half-done. `sqlx` is pinned to the same 0.8 line the plugin resolves to, which makes the plugin's pool this crate's pool and lets those commands open a real transaction on it.

The front end ships as static files — `ssr: false`, no Nitro inside the bundle, one page. Both windows load it and the window's label decides what is rendered: giving the panel a route of its own would mean a second file, and the web view hands the router that file's path (`/panel/index.html`) rather than a route, with no server there to answer it with the SPA shell.

## Sync

Off by default. When configured, the app talks to a self-hosted server over three endpoints — `auth/register`, `auth/login`, `sync` — with a token stored in the settings table.

The whole exchange lives in Rust rather than the web view for three reasons: the reply has to be applied in one transaction, a request from `tauri://` would be blocked by CORS, and the token then never has to exist in JavaScript at all.

- Deletions travel as tombstones — unlike a backup, which is a snapshot of what exists, a sync payload has to carry what no longer does
- The auto-sync loop starts 8 seconds after launch and is nudged by a dirty flag, so an edit syncs promptly instead of waiting out the interval
- Settings, invoice numbering and the running timer stay device-local: numbering has to stay unique per device, and a timer belongs to the machine it was started on

**The server is not in this repository.** Without it the app is a fully working local tracker; the sync screen simply stays disconnected.

## Stack

| Layer | Technology |
|---|---|
| Shell | Tauri 2 (desktop + Android) |
| UI | Nuxt 4, Vue 3.5, Pinia 4, hand-written CSS |
| Storage | SQLite via `tauri-plugin-sql`, `sqlx` for transactional writes |
| HTTP | `reqwest` (rustls) |
| Android notification | [`tauri-plugin-timer`](https://crates.io/crates/tauri-plugin-timer) — own plugin, Kotlin |
| Fonts | Manrope + Space Grotesk, self-hosted via Fontsource |
| Build | Vite 8, TypeScript 5.8 |
| Tests | Vitest 5 with `@nuxt/test-utils`, `cargo test` on the Rust side |

## Build

```bash
npm install
npm run tauri dev              # desktop
npm run tauri android dev      # Android, device or emulator
npm run tauri build            # desktop bundle
npm run tauri android build    # APK
```

```bash
npm run lint                   # ESLint, warnings are errors
npm run typecheck              # vue-tsc through Nuxt
npm test                       # Vitest
cargo test --manifest-path src-tauri/Cargo.toml
```

Requires Rust, Node, and for Android: JDK 17+, the Android SDK and NDK with `ANDROID_HOME` / `NDK_HOME` set.

Git hooks (husky):

| Hook | What runs |
|---|---|
| `pre-commit` | `lint-staged` — ESLint on staged files plus the tests related to them, `cargo fmt --check` and clippy when Rust is touched |
| `pre-push` | both suites — Vitest and `cargo test` |

CI (`.github/workflows/ci.yml`) repeats lint, typecheck, tests and the static build on every branch and pull request, with a separate job for fmt, clippy and `cargo test`. `npm run smoke` runs after the build and checks the artefact Tauri actually ships: the entry page exists and every asset it references is on disk.

Dependabot (`.github/dependabot.yml`) opens one grouped pull request a week for minor and patch bumps and separate ones for majors. `sqlx` is excluded — it has to keep resolving to the same version `tauri-plugin-sql` uses, otherwise the transactional commands lose the plugin's pool.

## Project structure

```
app/
  app.vue              picks the window by its label
  components/
    MainWindow.vue       main window — tabs, onboarding, splash
    PanelWindow.vue      edge panel
    Screen/              Dashboard, Projects, Billing, Onboarding
    Modal/               task, project, invoice generation, invoice detail,
                         done tasks, settings
    Ui/                  bottom sheet, fields, icons, pickers, switches
  composables/         timer tick and actions, theme, cross-window db sync,
                       task selection, window title, transient messages
  stores/              Pinia: app, projects, tasks, invoices, timer, settings
  repositories/
    db.ts                query helpers over tauri-plugin-sql
    softDelete.ts        tombstoning through the Rust cascade
    source.ts, sources/  live SQLite or the demo data set
    modules/             projects, tasks, time entries, invoices, settings,
                         backup
  utils/               pure logic — earnings, money, time, chart paths,
                       invoice and report text, backup format with the
                       v1 → v2 import, statuses, dashboard grouping —
                       alongside the thin Tauri wrappers: sync commands,
                       backup file dialogs, clipboard, window title, the
                       Android timer notification
  types/               every shared type, one file (nothing else is imported
                       by hand — Nuxt auto-imports the rest)
  assets/css/          theme, app, parts, desktop, panel

tests/nuxt/            mirrors app/ — utils, composables, stores

src-tauri/src/
  lib.rs               module list and the Tauri builder
  error.rs             one error type; commands hand JavaScript its message
  db.rs                the pool tauri-plugin-sql opened
  migrations.rs        schema history, every version ever shipped
  backup.rs            restore_backup — a whole file in one transaction
  soft_delete.rs       the tombstone cascade
  snapshot.rs          VACUUM INTO copy taken before a new version migrates
  desktop/             edge panel window, pointer watcher, tray icon
  sync/                wire shapes, HTTP, local reads, merge, auto-sync, clock
```

## Schema

`settings` (single row, holds the active timer), `projects`, `tasks`, `time_entries`, `invoices`, `invoice_items`. Every table carries `created_at` / `updated_at` and a nullable `deleted_at` — the pair sync compares to decide what travels.

## Not built yet

- Interface strings are Russian, hard-coded, with no i18n layer
- Desktop is developed and tested on macOS; the edge panel relies on `macOSPrivateApi` for transparency

## License

MIT
