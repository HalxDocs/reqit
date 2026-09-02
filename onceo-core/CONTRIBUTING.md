# Contributing to onceo-core

## Getting Started

1. Fork the repository.
2. Run `make test` to verify the existing tests pass.
3. Create a feature branch.

## Adding a New Provider

See [docs/adding-a-provider.md](docs/adding-a-provider.md) for the step-by-step guide.

## Pull Request Requirements

- Pass CI: `make lint && make test`
- Include tests for any new behaviour
- Add godoc comments to all exported symbols
- Use Conventional Commits: `feat:`, `fix:`, `docs:`, `test:`, `chore:`

## Code Style

- `gofmt` and `goimports` are enforced by CI
- No global state, no panics
- `context.Context` on every I/O-adjacent call
- Sentinel errors with `errors.Is`/`errors.As`
- Table-driven tests with descriptive names

## Review Process

A reviewer should be able to approve a new provider adapter PR without needing to trust the contributor. The fixtures and tests make correctness self-evident.
