# @flashread/dependencies

Shared types and API contracts for FlashRead monorepo.

## Purpose

This package serves as the single source of truth for:
- **Types**: Domain models shared between frontend and backend
- **API Contracts**: Request/response shapes for all API endpoints

## Usage

### Types

```typescript
import { Flashread, Profile, RenderedBlock } from '@flashread/dependencies/types';
```

### API Contracts

```typescript
import { AuthResult, GetFlashreadsResult } from '@flashread/dependencies/api';
```

## Architecture

Both `backend` and `frontend` packages depend on `dependencies`, ensuring type consistency and preventing circular dependencies.
