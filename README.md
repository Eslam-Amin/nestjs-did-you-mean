# nestjs-did-you-mean 🧭

> Production-ready, **zero-dependency** 404 Route Suggester for NestJS with seamless **Express** & **Fastify** support, OpenAPI/Swagger harvesting, parameterized segment matching, and HTTP method mismatch prioritization.

[![npm version](https://img.shields.io/npm/v/nestjs-did-you-mean.svg)](https://www.npmjs.com/package/nestjs-did-you-mean)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript: Strict](https://img.shields.io/badge/TypeScript-Strict%20ES2022-blue)](https://www.typescriptlang.org/)
[![Dependencies: Zero](https://img.shields.io/badge/dependencies-0-success.svg)](https://www.npmjs.com/package/nestjs-did-you-mean)
[![Platform: Express & Fastify](https://img.shields.io/badge/platform-Express%20%7C%20Fastify-green)](https://nestjs.com)
[![Coverage: >90%](https://img.shields.io/badge/coverage-98%25-brightgreen)](https://vitest.dev/)

---

## ✨ Features

- ⚡ **Zero Runtime Dependencies** — Pure TypeScript string similarity algorithms; uses only standard Node.js and NestJS peer dependencies.
- 🌐 **Platform-Agnostic** — Built upon NestJS `HttpAdapterHost`, running identically on `@nestjs/platform-express` and `@nestjs/platform-fastify`.
- 🔍 **Dual Route Discovery Engine**:
  - **Priority 1 (OpenAPI / Swagger Spec)**: Parses paths, HTTP methods, summaries, and operation IDs directly from `@nestjs/swagger`.
  - **Priority 2 (NestJS Discovery & Reflector)**: Introspects registered controllers, route decorators, global prefixes (`app.setGlobalPrefix('api')`), and URI versioning (`@Version('1')`).
- 🎯 **Advanced Fuzzy Matching**:
  - Combined **Normalized Levenshtein** distance + **Jaro-Winkler** similarity (prioritizing route prefixes).
  - **Segment-Based Structural Matching**: Recognizes parameterized tokens (`:id`, `{userId}`, dynamic segments), matching `/api/v1/users/42` against `/api/v1/users/:id` with high structural fidelity.
- 🔀 **HTTP Method Mismatch Prioritization**:
  - If a requested route matches an existing path under a different HTTP verb (e.g., calling `POST /api/users` when only `GET /api/users` exists), it receives a `1.0` score with `isMethodMismatch: true` and is placed at the top of suggestions.
- 🛡️ **Zero-Overhead Production Guardrails**:
  - By default, active only in non-production environments (`process.env.NODE_ENV !== 'production'`).
  - In production, functions as an immediate transparent pass-through with **zero reflection, zero regex evaluation, and zero memory overhead**.
- 🎨 **Multi-Format Output**:
  - **Standard JSON Payload** for API clients and tools (cURL, Postman).
  - **Interactive Developer HTML UI** automatically delivered when opening 404 URLs in a web browser (`Accept: text/html`), complete with method badges, match percentages, and one-click copy buttons.
- 📦 **Dual Build**: Dual CommonJS (`.cjs`) and ECMAScript Module (`.js`) distribution with full `.d.ts` declaration maps.

---

## 🏗️ Architecture

```mermaid
flowchart TD
    Req([Client Request]) --> Catch[404 NotFoundException Intercepted]
    Catch --> Guard{Enabled in Environment?}

    Guard -- No (Production Pass-Through) --> PassThrough[Delegate immediately to default filter\nZero reflection, zero regex]
    PassThrough --> RespRaw([Standard 404 Response])

    Guard -- Yes (Non-Production) --> Inspect[Inspect URL & Method via HttpAdapterHost]

    Inspect --> Harvester{Harvest Candidates}
    Harvester -- Swagger Provided --> SwagSpec[Parse OpenAPI Spec paths & operations]
    Harvester -- No Swagger --> ControllerScan[Scan DiscoveryService, Reflector,\nGlobal Prefix & URI Versioning]

    SwagSpec --> Cache[(In-Memory Route Cache)]
    ControllerScan --> Cache

    Cache --> Matcher[Fuzzy & Structural Matcher]
    Matcher --> StructCheck[Segment Tokenizer :id / {userId}]
    Matcher --> JaroLev[Normalized Levenshtein + Jaro-Winkler]
    Matcher --> MismatchCheck{Exact Path but Different Method?}

    MismatchCheck -- Yes --> ScoreMismatch[Assign Score 1.0 + isMethodMismatch: true]
    MismatchCheck -- No --> ScoreFuzzy[Compute Combined Similarity Score]

    ScoreMismatch --> Ranker[Rank & Limit Suggestions]
    ScoreFuzzy --> Ranker

    Ranker --> Formatter{Content Negotiation}
    Formatter -- Accept: text/html --> HTMLView[Render Interactive Dev HTML UI]
    Formatter -- JSON / Default --> JSONView[Format Standard JSON Error Payload]

    HTMLView --> ClientResp([Client Response])
    JSONView --> ClientResp
```

---

## 📦 Installation

```bash
# npm
npm install nestjs-did-you-mean

# pnpm
pnpm add nestjs-did-you-mean

# yarn
yarn add nestjs-did-you-mean
```

> **Peer Dependencies**: Requires `@nestjs/common` (>= 9.0.0), `@nestjs/core` (>= 9.0.0), `reflect-metadata`, and `rxjs` (>= 7.0.0).

---

## 🚀 Quick Start

### 1. Dynamic Module (`forRoot`)

Import `DidYouMeanModule` in your root `AppModule`. By default, it automatically binds the global exception filter.

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { DidYouMeanModule } from 'nestjs-did-you-mean';

@Module({
  imports: [
    DidYouMeanModule.forRoot({
      threshold: 0.4,       // Minimum similarity score (0.0 to 1.0)
      maxSuggestions: 3,    // Limit returned suggestions
      enabled: process.env.NODE_ENV !== 'production', // Active in dev/test
    }),
  ],
})
export class AppModule {}
```

### 2. With `@nestjs/swagger` OpenAPI Specification

If you use `@nestjs/swagger`, pass the generated document to enable route summaries, descriptions, and operation IDs:

```typescript
// main.ts
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { RouteDiscoveryService } from 'nestjs-did-you-mean';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = new DocumentBuilder()
    .setTitle('My API')
    .setVersion('1.0')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  // Provide Swagger document to RouteDiscoveryService
  const discoveryService = app.get(RouteDiscoveryService);
  discoveryService.setSwaggerDoc(document);

  await app.listen(3000);
}
bootstrap();
```

Or pass `swaggerDoc` directly in module configuration:

```typescript
DidYouMeanModule.forRoot({
  swaggerDoc: swaggerDocument,
})
```

### 3. Asynchronous Configuration (`forRootAsync`)

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DidYouMeanModule } from 'nestjs-did-you-mean';

@Module({
  imports: [
    ConfigModule.forRoot(),
    DidYouMeanModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        threshold: config.get<number>('SUGGESTION_THRESHOLD', 0.4),
        maxSuggestions: config.get<number>('MAX_SUGGESTIONS', 3),
        enabled: config.get<string>('NODE_ENV') !== 'production',
      }),
    }),
  ],
})
export class AppModule {}
```

### 4. Manual Exception Filter Registration

If you prefer to register the filter manually in `main.ts`:

```typescript
// app.module.ts
DidYouMeanModule.forRoot({
  isGlobalFilter: false, // Disable automatic APP_FILTER provider
})

// main.ts
import { HttpAdapterHost } from '@nestjs/core';
import { DidYouMeanFilter, RouteDiscoveryService } from 'nestjs-did-you-mean';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  const httpAdapterHost = app.get(HttpAdapterHost);
  const discoveryService = app.get(RouteDiscoveryService);

  app.useGlobalFilters(new DidYouMeanFilter(httpAdapterHost, discoveryService, {
    maxSuggestions: 3,
    threshold: 0.4,
  }));

  await app.listen(3000);
}
```

---

## ⚡ Output Formats

### 1. Standard JSON Response

When a client hits a non-existent route (e.g. `GET /api/v1/usr`):

```json
{
  "statusCode": 404,
  "error": "Not Found",
  "message": "Cannot GET /api/v1/usr",
  "suggestions": [
    {
      "method": "GET",
      "path": "/api/v1/users",
      "score": 0.88,
      "isMethodMismatch": false,
      "summary": "Retrieve user list"
    }
  ]
}
```

### 2. HTTP Method Mismatch Prioritization

When a route exists but was called with the wrong HTTP verb (e.g. client invoked `POST /api/v1/users/42` when only `GET /api/v1/users/:id` and `DELETE /api/v1/users/:id` exist):

```json
{
  "statusCode": 404,
  "error": "Not Found",
  "message": "Cannot POST /api/v1/users/42",
  "suggestions": [
    {
      "method": "GET",
      "path": "/api/v1/users/:id",
      "score": 1.0,
      "isMethodMismatch": true
    },
    {
      "method": "DELETE",
      "path": "/api/v1/users/:id",
      "score": 1.0,
      "isMethodMismatch": true
    }
  ]
}
```

### 3. Interactive Developer HTML UI

Opening non-existent routes in a browser automatically yields a clean, responsive developer dashboard (respects dark & light OS themes):

- 🎨 **Visual HTTP Method Badges** (Green `GET`, Blue `POST`, Yellow `PUT`, Red `DELETE`, Purple `PATCH`)
- 📋 **One-Click Clipboard Copy**
- 🔗 **Direct URL Navigation** for `GET` endpoints
- 🎯 **Match Percentage Badges** or **Method Mismatch Pills**

---

## ⚙️ Configuration Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `enabled` | `boolean \| ((req: any) => boolean)` | `process.env.NODE_ENV !== 'production'` | Enable/disable suggestions or provide a custom per-request predicate. |
| `enabledEnvironments` | `string[]` | `undefined` | List of environments (e.g. `['development', 'test', 'staging']`) where suggestions are active. |
| `threshold` | `number` | `0.4` | Minimum similarity score (0.0 to 1.0) required to include a candidate route. |
| `maxSuggestions` | `number` | `3` | Maximum number of suggestions returned. |
| `swaggerDoc` | `any` | `undefined` | OpenAPI 3.0 / Swagger 2.0 document from `SwaggerModule.createDocument`. |
| `globalPrefix` | `string` | `undefined` | Global route prefix (auto-detected from NestJS application config if omitted). |
| `excludePaths` | `(string \| RegExp)[]` | `[]` | Exclude matching paths from suggestions (e.g. internal routes, metrics). |
| `format` | `'auto' \| 'json' \| 'html' \| ((ctx) => any)` | `'auto'` | Response format: `'auto'` content-negotiates based on `Accept` header. |
| `includeMethodInScore` | `boolean` | `true` | Whether HTTP method compatibility factors into candidate ranking. |
| `isGlobalFilter` | `boolean` | `true` | Automatically bind `DidYouMeanFilter` as a global `APP_FILTER`. |
| `customRanker` | `Function` | `undefined` | Provide custom ranking and scoring algorithm. |

---

## 🛡️ Production Safety & Performance

In production environments, `nestjs-did-you-mean` operates with **zero overhead**:
1. Checks the environment condition (`process.env.NODE_ENV !== 'production'` or `options.enabled`).
2. Immediately delegates to the default exception filter via `httpAdapter.reply(res, exception.getResponse(), 404)`.
3. Skips reflection, route table iteration, string distance calculation, and template rendering entirely.

---

## 🧪 Testing

The library is thoroughly tested with unit, integration, and E2E test suites on both **Express** and **Fastify** platforms with over **95% coverage**:

```bash
# Run all tests
npm test

# Run tests with code coverage
npm run test:cov

# Typecheck TypeScript definitions
npm run typecheck

# Build dual CJS & ESM bundles
npm run build
```

---

## 📄 License

MIT License © 2026 Antigravity
