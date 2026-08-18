# NewOSM Plugin Tests

Four test layers, modeled on the sibling `lynxjournal` plugin's setup:

| Layer               | Tool                        | Location               | Needs                     |
|----------------------|------------------------------|-------------------------|----------------------------|
| JS Unit              | Vitest                      | `tests/js/`             | nothing extra              |
| PHP Unit             | Pest 4 + Brain Monkey        | `tests/Unit/`           | `composer install`         |
| PHP Integration      | Pest 4 (real WP)             | `tests/Integration/`    | `bin/install-wp-tests.sh`  |
| E2E                  | Playwright                  | `tests/e2e/`            | Docker (`wp-env`)          |

## Running everything

```bash
bin/run-tests.sh
```

## Running one layer at a time

```bash
# JS unit tests (Vitest)
npm test
npm run test:watch
npm run test:js:coverage

# PHP unit tests (Pest + Brain Monkey — no real WordPress needed)
composer install
composer run test:unit

# PHP integration tests (real WordPress + MySQL test DB)
bin/install-wp-tests.sh wordpress_test root '' localhost latest
export WP_TESTS_DIR=/tmp/wordpress-tests-lib
composer run test:integration
composer run test:integration:multisite   # optional, needs WP_TESTS_DIR too

# E2E tests (Playwright against wp-env, requires Docker)
npm run env:start
npm run test:e2e
npm run env:stop
```

## Structure

- `tests/js/` — Vitest unit tests for `src/utils/*`, plus `setup.js` (global mocks).
- `tests/Unit/` — Pest unit tests; `newopm.php` is loaded once under Brain Monkey via `tests/bootstrap-unit.php`, so `add_action`/`add_filter` calls at file scope don't blow up. `tests/stubs/wp-stubs.php` provides no-op WP core function/class stubs; `tests/helpers.php` has shared test builders.
- `tests/Integration/` — Pest tests against a real, in-process WordPress (classic `WP_TESTS_DIR` scaffold via `tests/bootstrap-integration.php` — no Docker needed for this layer).
- `tests/phpunit/multisite.xml` — same Integration suite, run with `WP_TESTS_MULTISITE=1`.
- `tests/e2e/` — Playwright specs (`ui/` browser tests, `api/` REST tests) against a `wp-env` Docker container. `tests/mu-plugins/` auto-activates the plugin and adds a Basic-Auth fallback so tests can authenticate as `admin:password` instead of a real Application Password.
- `constants.json` — shared REST namespace/route/`wp-env` config, read by both Playwright config and specs.

## Coverage (JS)

Enforced via `vitest.config.js` for `src/utils/**` (100% — pure, easily-testable helpers). `src/edit.js`, `src/save.js`, `src/view.js` are excluded from the coverage gate — they're React/DOM-heavy and covered by the E2E layer instead.

## CI

No GitHub Actions workflow currently runs any of these suites (matching lynxjournal) — all four layers are local-only for now.
