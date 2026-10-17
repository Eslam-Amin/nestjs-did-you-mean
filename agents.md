# Multi-Agent Operational Guidelines: `nestjs-did-you-mean` 🧭

## 1. System Mission & Package Overview

`nestjs-did-you-mean` is a lightweight, production-ready, **zero-dependency** 404 Route Suggester for NestJS applications. When a client requests a nonexistent endpoint (e.g., `GET /api/v1/usr`), the package intercepts the `NotFoundException` and returns closest matching registered endpoints (e.g., `Did you mean: GET /api/v1/users?`).

The package is:
- **Platform-Agnostic**: Operates identically on `@nestjs/platform-express` and `@nestjs/platform-fastify` via NestJS's `HttpAdapterHost`.
- **Zero Runtime Dependencies**: Uses pure TypeScript similarity algorithms; depends only on standard Node.js and NestJS peer dependencies.
- **Production-Safe**: Acts as an immediate, transparent zero-overhead pass-through when disabled or in production (`process.env.NODE_ENV === 'production'`).

---

## 2. Coding Philosophy: Clean Architecture Without Over-Engineering

1. **Keep Code Simple & Idiomatic**:
   - Favor straightforward, direct TypeScript code over complex generic layers, abstract factory cascades, or redundant wrapper classes.
   - Integrate naturally with core NestJS patterns: dynamic modules (`forRoot`, `forRootAsync`), exception filters (`@Catch(NotFoundException)`), and dependency injection tokens.
2. **Mandatory Descriptive Documentation**:
   - Every exported class, method, function, type, decorator, and token must include comprehensive TSDoc comments with `@param`, `@returns`, and `@throws` where applicable.
3. **Constructor Dependency Injection Safety**:
   - In NestJS classes with DI (such as `DidYouMeanFilter` and `RouteDiscoveryService`), avoid union types in constructor parameter declarations. TypeScript emits `Object` metadata for union types, which breaks NestJS reflection. Keep explicit class types on parameters and use runtime parameter identification for manual instantiation fallbacks.
4. **Zero Runtime Dependencies**:
   - Do NOT add external runtime dependencies (`dependencies` in `package.json` must remain `{}`).
   - All string similarity, normalizers, and formatting algorithms must remain self-contained pure TypeScript.

---

## 3. Subsystem Architecture & Route Harvesting

```
src/
├── index.ts                     # Main entrypoint barrel
├── did-you-mean.module.ts       # Dynamic Module (forRoot, forRootAsync)
├── did-you-mean.filter.ts       # @Catch(NotFoundException) ExceptionFilter
├── constants.ts                 # DID_YOU_MEAN_OPTIONS & DEFAULT_OPTIONS
├── types.ts                     # Interfaces, options, RouteDefinition, RouteSuggestion
├── discovery/
│   ├── discovery.service.ts     # Harvests controller routes, prefixes, and versioning
│   ├── swagger.parser.ts        # Parses @nestjs/swagger OpenAPI documents
│   └── index.ts
├── matcher/
│   ├── similarity.ts            # Normalized Levenshtein & Jaro-Winkler
│   ├── normalizer.ts            # Segment parsing, :id/{id} token matching, path cleaning
│   ├── ranker.ts                # Scoring & HTTP method mismatch prioritization
│   └── index.ts
└── formatters/
    └── index.ts                 # JSON payload & interactive dev HTML formatter
```

### Route Harvesting Priority
1. **Priority 1 (`@nestjs/swagger`)**:
   - If `options.swaggerDoc` is provided, parse routes, HTTP verbs, summaries, and operation IDs directly using `parseSwaggerDoc()`.
2. **Priority 2 (`DiscoveryService` & `Reflector`)**:
   - If no Swagger document is supplied, harvest routes from registered controllers using NestJS's `DiscoveryService`, `MetadataScanner`, and `Reflector`.
   - Incorporate global route prefixes (`app.setGlobalPrefix('api')` or `options.globalPrefix`).
   - Account for URI API versioning (`@Version('1')` or `VersioningType.URI`).
   - Cache discovered routes in memory on application bootstrap (`OnApplicationBootstrap` / `OnModuleInit`).

### Fuzzy Matching & Method Mismatch Rules
- **Full Path Similarity**: Blended score of normalized Levenshtein distance and Jaro-Winkler similarity.
- **Segment Structural Matching**: Matches parameter tokens (`:id`, `{userId}`, dynamic segments) against concrete values (e.g. `/api/v1/users/42` matches `/api/v1/users/:id`).
- **HTTP Method Mismatch Prioritization**:
  - If a requested path matches an existing route under a different HTTP method (e.g., `POST /api/users` called when only `GET /api/users` exists), assign score `1.0` with `isMethodMismatch: true` and rank it at the top of the suggestions list.

---

## 4. Strict Git & Branching Protocol

AI assistants and contributors must strictly abide by the following Git workflow:

1. **Feature Branches Only**:
   - **Never commit directly to `main` or `master`**.
   - Always check out a dedicated feature or fix branch before starting work:
     ```bash
     git checkout -b feat/<feature-name>
     # or
     git checkout -b fix/<bug-name>
     ```
2. **Commit Granularly Per File / Function**:
   - Whenever a file is modified or created, stage it individually.
   - Use conventional commit messages: `feat:`, `fix:`, `test:`, `docs:`, `chore:`.
   - Keep code changes, test suites, and documentation in distinct commits.
3. **Push Immediately**:
   - Push each commit to the remote tracking branch:
     ```bash
     git push -u origin <current-branch>
     ```

---

## 5. Verification & Testing Gates

Before committing or pushing any change, execute the complete verification gate:

```bash
# 1. Typecheck TypeScript definitions
npm run typecheck

# 2. Run unit and integration tests with coverage
npm run test:cov

# 3. Build dual CJS & ESM bundles
npm run build
```

### Coverage Requirements
- Global line coverage must exceed **90%**.
- All unit tests for similarity algorithms (`tests/similarity.spec.ts`), normalizers (`tests/normalizer.spec.ts`), rankers (`tests/ranker.spec.ts`), discovery (`tests/discovery.spec.ts`), formatters (`tests/formatters.spec.ts`), module registration (`tests/module.spec.ts`), and filters (`tests/filter.spec.ts`) must pass.
- End-to-end tests must pass for both platforms:
  - Express adapter (`tests/e2e-express.spec.ts`)
  - Fastify adapter (`tests/e2e-fastify.spec.ts`)
