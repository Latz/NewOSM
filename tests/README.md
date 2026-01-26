# NewOSM Plugin Tests

This directory contains the test infrastructure for the NewOSM WordPress plugin.

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (auto-rerun on file changes)
npm run test:watch

# Run tests with coverage report
npm test -- --coverage
```

## Test Structure

- `setup.js` - Global test setup, runs before each test file
- `__mocks__/` - Mock files for non-JS imports (CSS, images)

## Coverage

The project enforces minimum test coverage thresholds:
- Statements: 70%
- Branches: 60%
- Functions: 70%
- Lines: 70%

## Writing Tests

Tests are colocated with source files using the `.test.js` suffix.

Example:
```
src/utils/validation.js
src/utils/validation.test.js
```

### Test Guidelines

1. **Test critical functions** - Focus on validation, API calls, and business logic
2. **Use descriptive test names** - `test('validates latitude within range', ...)`
3. **Test edge cases** - Boundary values, null/undefined, invalid inputs
4. **Mock external dependencies** - API calls, browser APIs, etc.
5. **Keep tests isolated** - Each test should be independent

### Available Globals

- `wp.i18n.__()` - WordPress internationalization (mocked)
- `console.error`, `console.warn`, `console.log` - Mocked to reduce noise

## Test Coverage

To view detailed coverage report:

```bash
npm test -- --coverage
open coverage/lcov-report/index.html
```
