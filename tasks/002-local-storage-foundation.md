# Task 002 — Local storage foundation

## Goal

Add platform-safe application-data paths, SQLite initialization, migrations, and filesystem directories.

## Scope

- resolve app data directory using OS conventions
- initialize SQLite database
- create migration mechanism
- create managed directories: repositories, tasks, worktrees, logs
- expose storage health/status through daemon

## Acceptance criteria

- first run creates local data structure automatically
- repeated startup is idempotent
- migrations are versioned
- tests cover path resolution and initialization where practical

## Review additions

- Choose and document one SQLite driver compatible with the pinned Node version;
  use it behind storage interfaces. Enable foreign keys, bounded busy handling
  and transactional migrations; refuse an unknown newer schema.
- Use an app data root override (`AEW_DATA_DIR`) for isolated tests; never touch
  real user data in tests. Enforce one daemon owner per data root.
- Specify the staging/operation-state recovery pattern for later file operations;
  do not create future feature tables merely to anticipate them.
- Test interrupted/failed migration, repeated initialization and unwritable paths.

## Exclusions

- repository tables beyond what is needed to prove migrations
- task/artifact behaviour
