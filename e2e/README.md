# PhotoRank E2E Tests

End-to-end testing suite for PhotoRank application using Playwright.

## Setup

1. Install dependencies:
```bash
cd e2e
npm install
```

2. Install Playwright browsers:
```bash
npx playwright install --with-deps
```

## Running Tests

### Basic test execution:
```bash
npm test
```

### With headed browser (visible UI):
```bash
npm run test:headed
```

### Interactive UI mode:
```bash
npm run test:ui
```

### Debug mode:
```bash
npm run test:debug
```

### View test reports:
```bash
npm run report
```

## Configuration

- Base URL: `BASE_URL` env var (default: http://localhost:3000)
- Web Server: Automatically starts parent dev server (`npm run dev`) before tests
- Browsers: Chromium, Firefox, WebKit, Mobile Chrome, Mobile Safari

## Test Structure

### Smoke Tests (`smoke.spec.ts`)
- Basic page loading and PhotoRank visibility
- Mobile responsive design
- JavaScript error detection

### Route Guards (`guards.spec.ts`)
- Authentication redirects for protected routes
- Public page accessibility
- Sign-up/login button visibility for unauthenticated users

## Environment Variables

```bash
# Custom base URL (optional)
BASE_URL=http://localhost:3000 npm test

# CI environment (affects retry behavior)
CI=true npm test
```

## Development

### Generate test code:
```bash
npm run codegen
```

### Run specific test file:
```bash
npx playwright test smoke.spec.ts
```

### Run tests in specific browser:
```bash
npx playwright test --project=chromium
```

## Troubleshooting

1. Port conflicts: Ensure the dev server runs on 3000 (Vite default here)
2. Browser installation: Run `npx playwright install --with-deps` if browsers are missing
3. Network issues: Ensure the application is accessible at the base URL

## CI/CD Integration

The configuration automatically:
- Starts the web server before tests
- Runs tests with retries on CI
- Generates HTML reports
- Captures screenshots and videos on failure
