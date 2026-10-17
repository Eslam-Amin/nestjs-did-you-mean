import { Controller, Get, INestApplication, Param, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DidYouMeanModule } from '../src/did-you-mean.module';

@Controller('api/v1/users')
class UsersController {
  @Get()
  getUsers() {
    return [{ id: '1', name: 'Alice' }];
  }

  @Get(':id')
  getUser(@Param('id') id: string) {
    return { id, name: 'Alice' };
  }

  @Post()
  createUser() {
    return { success: true };
  }
}

@Controller('api/v1/auth')
class AuthController {
  @Post('login')
  login() {
    return { token: 'secret' };
  }
}

describe('E2E: NestJS with Express Platform', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.NODE_ENV = 'development';

    const moduleRef = await Test.createTestingModule({
      imports: [
        DidYouMeanModule.forRoot({
          threshold: 0.4,
          maxSuggestions: 3,
        }),
      ],
      controllers: [UsersController, AuthController],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('suggests closest match on typo endpoint (GET /api/v1/usr -> GET /api/v1/users)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/usr')
      .expect(404);

    expect(res.body).toMatchObject({
      statusCode: 404,
      error: 'Not Found',
      message: 'Cannot GET /api/v1/usr',
    });

    expect(Array.isArray(res.body.suggestions)).toBe(true);
    expect(res.body.suggestions.length).toBeGreaterThan(0);

    const first = res.body.suggestions[0];
    expect(first.method).toBe('GET');
    expect(first.path).toBe('/api/v1/users');
    expect(first.score).toBeGreaterThan(0.8);
    expect(first.isMethodMismatch).toBe(false);
  });

  it('prioritizes HTTP method mismatch with score 1.0 (DELETE /api/v1/users)', async () => {
    const res = await request(app.getHttpServer())
      .delete('/api/v1/users')
      .expect(404);

    expect(res.body.statusCode).toBe(404);
    expect(res.body.suggestions.length).toBeGreaterThan(0);

    const first = res.body.suggestions[0];
    expect(first.path).toBe('/api/v1/users');
    expect(first.score).toBe(1.0);
    expect(first.isMethodMismatch).toBe(true);
  });

  it('serves interactive HTML when requested with Accept: text/html', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/usr')
      .set('Accept', 'text/html')
      .expect('Content-Type', /text\/html/)
      .expect(404);

    expect(res.text).toContain('<!DOCTYPE html>');
    expect(res.text).toContain('Did you mean?');
    expect(res.text).toContain('/api/v1/users');
    expect(res.text).toContain('GET');
  });

  it('passes through transparently when disabled in production', async () => {
    const prodModuleRef = await Test.createTestingModule({
      imports: [
        DidYouMeanModule.forRoot({
          enabled: false,
        }),
      ],
      controllers: [UsersController],
    }).compile();

    const prodApp = prodModuleRef.createNestApplication();
    await prodApp.init();

    const res = await request(prodApp.getHttpServer())
      .get('/api/v1/usr')
      .expect(404);

    expect(res.body.statusCode).toBe(404);
    expect(res.body.suggestions).toBeUndefined();

    await prodApp.close();
  });
});
