# Contributing to Patient Rounding Assistant

Thank you for your interest in contributing! This guide will help you get started.

## Getting Started

### Prerequisites

- Node.js 18+ (LTS recommended)
- npm or bun
- Git

### Development Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Start development server: `npm run dev`
4. Open http://localhost:8080

## Code Style

### TypeScript

- Use explicit types for function parameters and return values
- Prefer interfaces over type aliases for object shapes
- Use `unknown` instead of `any` when type is truly unknown
- Enable strict mode in your IDE

### React

- Use functional components with hooks
- Follow the `import * as React from "react"` pattern for HMR stability
- Prefix hooks with `React.` (e.g., `React.useState`)
- Use semantic HTML elements
- Ensure accessibility with ARIA attributes

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `PatientCard.tsx` |
| Hooks | camelCase with `use` prefix | `usePatients.ts` |
| Utilities | camelCase | `formatDate.ts` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_PATIENTS` |
| Types | PascalCase | `PatientData` |
| CSS Classes | kebab-case | `patient-card` |

### File Organization

```
src/components/
├── FeatureName/
│   ├── index.ts           # Public exports
│   ├── FeatureName.tsx    # Main component
│   ├── SubComponent.tsx   # Sub-components
│   └── useFeature.ts      # Feature-specific hooks
```

## Git Workflow

### Branch Naming

- `feature/description` - New features
- `fix/description` - Bug fixes
- `refactor/description` - Code refactoring
- `docs/description` - Documentation updates
- `test/description` - Test additions/updates

### Commit Messages

Follow the Conventional Commits specification:

```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting (no code change)
- `refactor`: Code refactoring
- `test`: Tests
- `chore`: Maintenance

Examples:
```
feat(patients): add bulk import from CSV
fix(auth): resolve session expiration issue
docs(readme): update installation instructions
```

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch
```

### Writing Tests

```typescript
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MyComponent } from './MyComponent';

describe('MyComponent', () => {
  it('renders correctly', () => {
    const { getByText } = render(<MyComponent />);
    expect(getByText('Expected text')).toBeDefined();
  });
});
```

### Test File Location

Place test files next to the code they test:
```
src/components/
├── PatientCard.tsx
└── PatientCard.test.tsx
```

Or in a `__tests__` directory:
```
src/components/
├── __tests__/
│   └── PatientCard.test.tsx
└── PatientCard.tsx
```

## Pull Request Process

1. Create a feature branch from `main`
2. Make your changes with appropriate tests
3. Ensure all tests pass: `npm test`
4. Ensure no type errors: `npx tsc --noEmit`
5. Ensure no lint errors: `npm run lint`
6. Create a pull request with a clear description

### PR Description Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
Describe how you tested the changes

## Screenshots (if applicable)
Add screenshots for UI changes

## Checklist
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No console errors
- [ ] Accessibility checked
```

## Accessibility Guidelines

- All interactive elements must be keyboard accessible
- Images must have alt text
- Form inputs must have labels
- Color contrast must meet WCAG AA standards
- Use semantic HTML elements
- Test with screen readers

## Performance Guidelines

- Avoid unnecessary re-renders with React.memo
- Use useCallback for event handlers passed as props
- Lazy load heavy components
- Optimize images and assets
- Profile with React DevTools

## Security Guidelines

- Never commit secrets or API keys
- Validate all user input
- Use parameterized queries (handled by Supabase)
- Follow RLS policies for data access
- Sanitize HTML content

## Questions?

Open an issue for:
- Bug reports
- Feature requests
- Questions about the codebase

Thank you for contributing! 🎉
