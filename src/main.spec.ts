/* eslint-disable @typescript-eslint/unbound-method */

import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';

jest.mock('@nestjs/core', () => ({
  NestFactory: {
    create: jest.fn(),
  },
}));

jest.mock('helmet', () => jest.fn(() => 'helmet-middleware'));

jest.mock('@nestjs/swagger', () => ({
  DocumentBuilder: jest.fn().mockImplementation(() => ({
    setTitle: jest.fn().mockReturnThis(),
    addBearerAuth: jest.fn().mockReturnThis(),
    setVersion: jest.fn().mockReturnThis(),
    build: jest.fn().mockReturnValue({}),
  })),
  SwaggerModule: {
    createDocument: jest.fn(() => ({})),
    setup: jest.fn(),
  },
  ApiConsumes: jest.fn(() => () => undefined),
  ApiBearerAuth: jest.fn(() => () => undefined),
  ApiOperation: jest.fn(() => () => undefined),
  ApiResponse: jest.fn(() => () => undefined),
  ApiTags: jest.fn(() => () => undefined),
}));

describe('bootstrap (main.ts)', () => {
  const originalEnv = process.env;

  const createMockApp = () => ({
    set: jest.fn(),
    use: jest.fn(),
    useBodyParser: jest.fn(),
    enableCors: jest.fn(),
    listen: jest.fn().mockResolvedValue(undefined),
  });

  const loadMain = async (mockApp: ReturnType<typeof createMockApp>) => {
    (NestFactory.create as jest.Mock).mockResolvedValue(mockApp);

    await new Promise<void>((resolve, reject) => {
      try {
        jest.isolateModules(() => {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          require('./main');
        });
        resolve();
      } catch (error) {
        reject(error);
      }
    });

    // bootstrap() is async
    await new Promise((r) => setImmediate(r));
  };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.NODE_ENV;
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should configure CORS, helmet, Swagger and start listening outside production', async () => {
    const mockApp = createMockApp();
    process.env.PORT = '4000';

    await loadMain(mockApp);

    expect(NestFactory.create).toHaveBeenCalled();
    expect(mockApp.use).toHaveBeenCalled();
    expect(mockApp.useBodyParser).toHaveBeenCalled();

    // Sem `trust proxy` o ThrottlerGuard agrupa todos os clientes no IP do proxy.
    expect(mockApp.set).toHaveBeenCalledWith('trust proxy', 1);

    expect(mockApp.enableCors).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: expect.arrayContaining(['http://localhost:3002', 'http://localhost:3001']),
        methods: expect.arrayContaining(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']),
        allowedHeaders: expect.arrayContaining(['Content-Type', 'Authorization']),
        credentials: true,
      }),
    );

    expect(mockApp.listen).toHaveBeenCalledWith('4000');
    expect(SwaggerModule.setup).toHaveBeenCalledWith('api', mockApp, expect.any(Function));
  });

  it('should not setup Swagger in production', async () => {
    const mockApp = createMockApp();
    process.env.NODE_ENV = 'production';
    process.env.PORT = '4000';

    await loadMain(mockApp);

    expect(SwaggerModule.setup).not.toHaveBeenCalled();
    expect(mockApp.listen).toHaveBeenCalledWith('4000');
  });
});
