# Repository guidance

Read [PROJECT_MEMORY.md](PROJECT_MEMORY.md) before substantial work in this repository.

## CodeGraph

When `.codegraph/` exists, use CodeGraph before searching for or opening source files:

1. Run `codegraph status` to check whether the index is current.
2. Use `codegraph explore "<question or symbols>"` for code paths and behavior.
3. Use `codegraph node --file <path> --offset <line> --limit <count>` for a focused source range.
4. Run `codegraph sync` after source edits or when the index reports stale.

`.codegraph/` is a generated, machine-local index. Keep it ignored; do not commit, delete, or reinitialize it as routine cleanup. The `codegraph` CLI is installed on the current workstation. Its Codex installer does not support a project-local `--location=local` configuration, so this file records the repository workflow.

## Local app

Run the web app with `npx expo start --web --port 4174`. Reuse an existing listener on that port when it already serves this repository.

## Preserve project state

Keep existing working-tree changes and release artifacts intact. Audits are read-only by default for Supabase and Google Play. Do not change remote records/schema, production credentials, billing products, Play Console state, or upload a release unless the user explicitly asks for that specific action.
