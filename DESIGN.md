# Design notes

The app is small; the data is not replaceable. One SQLite file on the machine
holds every hour someone worked and every invoice sent for it, there is no
server to fall back on, and an upgrade is the only thing that ever rewrites it.
Most of what follows is a consequence of that. This file records the decisions
that were not obvious at the time and what each of them costs. What the app does
and how to build it live in the [README](README.md).

## Shape

```
   main window          edge panel (desktop)      one bundle, ssr: false;
        │                        │                the window's label picks
        └───────── same ─────────┘                which of the two renders
                 document
                     │
        ┌────────────┴─────────────┐
        │                          │
 tauri-plugin-sql             invoke() ──► Rust commands
 reads, single writes         soft_delete · restore_backup · sync
        │                          │
        │                          │  same pool, real transactions
        ▼                          │
  SQLite (freel.db) ◄──────────────┘
        ▲
        └── snapshot plugin — a copy taken at startup, before any
            migration has run
```

Constraints behind the decisions: one maintainer, two platforms from one
codebase, two windows sharing a database, no server in the normal case, and
offline as the default state rather than an error.

---

## 1. Anything that must not be half-applied goes through Rust

`tauri-plugin-sql` hands out connections from a pool, so a sequence of `execute`
calls issued from JavaScript can land on different connections. A cascade
interrupted halfway then leaves a task tombstoned under a project that is still
alive. The three operations that are all-or-nothing — the delete cascade, a
backup restore, and applying a sync reply — are Rust commands that open one
transaction on that same pool.

Sharing the pool is what makes this work, and it is the reason `sqlx` is pinned
to the 0.8 line in `Cargo.toml`: the plugin's `SqlitePool` has to be the same
type as this crate's, or there is nothing to begin a transaction on.

**Cost.** Those operations exist in Rust while everything around them is
TypeScript, so a schema change has to be made in two languages. The boundary
also has to be re-crossed to tell the windows something changed — hence the
`freel:changed` event.

## 2. Rows are tombstoned, never deleted

Every table that syncs carries `deleted_at`, and deleting sets it. The reason is
sync: a row that is simply gone is indistinguishable from a row another device
has not sent yet, and the next exchange would hand it back. A tombstone is a
fact that travels; an absence is not. The only real `DELETE` left in the app is
a backup restore, which empties the tables and refills them in one transaction.

**Cost.** Every read has to remember `WHERE deleted_at IS NULL` — forget it once
and deleted work is back on screen. Since every read carries that filter, each
of those tables also carries an index for it. And the file only grows: nothing
prunes a tombstone, because nothing knows when every device has seen it.

## 3. A snapshot is taken before each new version touches the database

The database lives outside the app bundle, so replacing the app never touches
it. What can destroy it is a migration in the new build going wrong, and
migrations run unattended on first launch with no way back. So the first run of
every version copies the database next to itself with `VACUUM INTO`, keeping the
last five, before `tauri-plugin-sql` opens anything — which is why the snapshot
is a plugin of its own, registered ahead of the SQL plugin in the builder.

A failure to take the snapshot is swallowed: starting without one is bad,
refusing to start is worse. The version stamp is written last, so a copy that
failed is retried on the next launch rather than assumed done.

**Cost.** Up to five copies of the database sit on disk. And the snapshot only
covers the migration itself — data corrupted by a bug three days after the
upgrade is already in every copy.

## 4. One document, two windows, no router

The front end ships as static files with `ssr: false` and a single page. Both
the main window and the edge panel load that same document, and the window's
label decides which component renders.

Giving the panel a route of its own would mean a second file in the bundle, and
`tauri://` hands the webview that file's path — `/panel/index.html` — rather
than a route, with no server behind it to answer with the SPA shell. Picking by
label sidesteps the whole problem.

**Cost.** Each window is its own JavaScript realm: two copies of every Pinia
store, two i18n instances, two views of the same database. Writes therefore have
to be announced (`freel:changed` → `useDbSync` → re-read), and module-level
state has to be filled in per window — which is exactly what the translation
bridge in `app/utils/i18n.ts` does.

## 5. Sync lives in Rust, and the token never reaches JavaScript

Three reasons, any one of which would have been enough. The reply has to be
applied in one transaction (§1). A request issued from `tauri://` is blocked by
CORS. And the account token can stay in the settings table and in Rust, never
passing through the webview at all — the `Session` type deliberately does not
derive `Debug`, so it cannot fall into a log line by accident.

Merging is last-writer-wins on `updated_at`, guarded in SQL
(`WHERE excluded.updated_at > projects.updated_at`) so a slow reply cannot undo
an edit made while it was in flight. Task `minutes` is left out of the wire
shape on purpose: it is a cache recomputed from the entries, not a fact to
merge.

**Cost.** Last-writer-wins silently discards the other edit; there is no
conflict to resolve because none is recorded. The server is a separate project,
so the two field lists can drift apart without anything failing to compile — see
§11.

## 6. Auto-sync waits for the edits to settle

The loop wakes every 15 seconds but exchanges only when one of two things is
true: local edits have been quiet for 10 seconds, or nothing has been heard from
the other device for five minutes. Stepping a task through three statuses is
therefore one exchange, not three. The first attempt is held back 8 seconds
after launch, so the database is open before anything asks it for rows.

Failures are swallowed. Being offline is the normal state of a local-first app,
not an event worth interrupting anyone over, and the next tick tries again.

**Cost.** An edit reaches the other device up to ten seconds late. And because
nothing surfaces a failure, a server that has been unreachable for a week looks
exactly like one that has nothing to say — the settings screen shows the last
successful exchange, and that is the only hint.

## 7. Half of the settings travel, half stay on the device

Sync carries four of them — theme, currency, default rate, compact task form —
and leaves the rest where they are. Invoice numbering must stay unique per
device or two machines would issue the same number. A running timer belongs to
the machine it was started on. The interface language is a per-device choice: a
phone may reasonably be English while the desktop stays Russian. And the sync
rows themselves — device id, server URL, token — describe an installation, not
an account's data.

Backups are the exception, being a snapshot of one device: restoring one does
carry its settings over, language included. Files written before the language
existed carry none, and `serde(default)` leaves the setting alone rather than
blanking it.

**Cost.** Which half a setting belongs to is invisible: the same Settings screen
holds both kinds and says nothing about which is which. Change the theme on the
phone and the desktop follows; change the language and it does not.

## 8. The Android timer is a system chronometer, not a JavaScript interval

The ongoing notification is posted by a foreground service and shows Android's
own chronometer, seeded with the moment the session started (banked time folded
into the base). It counts with the app backgrounded, with the webview frozen,
with no JavaScript alive at all. It lives in a separate crate,
[`tauri-plugin-timer`](https://crates.io/crates/tauri-plugin-timer), because it
is Kotlin and has nothing to do with this app's domain.

The webview's own clock is the mirror image of that: `useTimerTick` runs only
while a timer is actually running and the document is visible. A hidden panel
re-rendering once a second is work done for nobody, and the clock catches up
when it comes back.

**Cost.** The notification is built from strings the front end passes in, so
anything that changes them has to re-post it. That is what the signature in
`timerNotification.ts` is for, and why the current locale is part of it —
without that, switching language would leave yesterday's words on screen.

## 9. Locale is an argument, not a global

Formatters take a `locale`; text builders take a `TextContext { locale, t }`.
Components reach the current one through `useFormat()` / `useLocale()`, and code
with no component context — stores, the notification, the window title — goes
through the module-level bridge. `app/utils` stays pure and testable either way.

`Intl` is used where it is right and avoided where it is not. Digit grouping
comes from it. Currency symbols do not: `Intl` renders RUB as “RUB” in `en-US`
and CNY as “CN¥”, so the symbol table stayed. Month names do not either — `Intl`
will only give a month inside a full date, “сентябрь 2026 г.”, where the
interface wants a bare capitalised word. Russian needs three plural forms and
the built-in rule is the English two-form one, so `pluralRules.ru` is written
out in the plugin.

**Cost.** Two dictionaries have to stay structurally identical, which no
compiler checks — `tests/nuxt/locales.spec.ts` compares their shapes and fails
on an empty string, because that is the only way a missing key gets noticed.

## 10. One data-source interface, two implementations

Everything the stores read and write goes through `DataSource`. There are two:
SQLite, and an in-memory fixture. Demo mode and “running in a browser with no
Tauri” are the same thing — a different source — rather than an `if (demo)`
branch inside every action. Each write returns the list it touched, so the store
just assigns the result and never guesses what changed. A `persistent` flag is
the one thing that leaks, because the interface has to say out loud when writes
are not reaching disk.

**Cost.** Every new operation is written twice, and the fixture can drift from
what SQLite actually does — ordering, for one, is only as correct as the
fixture's `sort` happens to be.

## 11. Tests run against a real SQLite file, and optionally a real server

The Rust tests open a pool over a temp file rather than `:memory:`, because an
in-memory database is per-connection and a pool would hand out several empty
ones. Temp files are numbered by an atomic counter, not a timestamp — tests run
in parallel and the clock is not fine-grained enough to keep two of them apart.
`pool_upto(n)` stops after `n` migrations, so a test can build a database in its
old shape and then migrate it for real, which is the only way to test a
migration honestly.

Sync has a full round trip against a live server, skipped unless
`FREEL_TEST_SERVER` points at one. It is the only thing that can catch the two
crates' field names drifting apart.

**Cost.** That test is skipped by default, so the drift it exists to catch is
caught only when someone remembers to run it with a server up.

---

## Known gaps

- **No log.** A single `eprintln!` in the snapshot plugin is the whole
  diagnostic surface, and in a packaged `.app` — or on Android — nobody sees
  stdout. If a migration or a sync exchange fails on someone else's machine,
  there is nothing to look at afterwards.
- **Errors raised in Rust are Russian**, regardless of the chosen language. They
  reach the interface as strings and are shown as they arrive.
- **The edge panel is macOS-only in practice.** Transparency depends on
  `macOSPrivateApi`, and the pointer watcher polls the window server; neither is
  tested on Windows or Linux.
- **Sync failures are invisible** by design (§6), which is the right default and
  the wrong behaviour once a server has been down for a week.
