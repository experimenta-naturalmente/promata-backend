import { Reflector } from '@nestjs/core';
import { RoleGuard } from './role.guard';
import { ExecutionContext } from '@nestjs/common';
import { UserType } from 'generated/prisma';
import { AuthGuard } from '../auth.guard';
import { IS_PUBLIC_KEY } from './public.decorator';

describe('RoleGuard', () => {
  let reflector: Reflector;
  let authGuard: AuthGuard;
  let guard: RoleGuard;

  const makeExecutionContext = (userRole?: UserType): ExecutionContext => {
    const req = { user: { userType: userRole } };

    const context = {
      switchToHttp: () => ({
        getRequest: () => req,
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as ExecutionContext;

    return context;
  };

  beforeEach(() => {
    reflector = {
      get: jest.fn(),
      getAllAndOverride: jest.fn().mockReturnValue(false),
    } as unknown as Reflector;

    authGuard = {
      canActivate: async () => Promise.resolve(true),
    } as unknown as AuthGuard;

    guard = new RoleGuard(reflector, authGuard);
  });

  it('deve negar quando não há metadata de roles (default deny)', async () => {
    (reflector.get as jest.Mock).mockReturnValue(undefined);

    const ctx = makeExecutionContext(UserType.GUEST);
    const result = await guard.canActivate(ctx);

    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    expect(result).toBe(false);
  });

  it('deve permitir rotas marcadas como @Public()', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(true);

    const ctx = makeExecutionContext();
    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(reflector.get).not.toHaveBeenCalled();
  });

  it('deve permitir quando o usuário possui um dos papéis requeridos', async () => {
    (reflector.get as jest.Mock).mockReturnValue([
      UserType.PROFESSOR,
      UserType.ADMIN,
    ] as UserType[]);

    const ctx = makeExecutionContext(UserType.PROFESSOR);
    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
  });

  it('deve negar quando o usuário não possui um dos papéis requeridos', async () => {
    (reflector.get as jest.Mock).mockReturnValue([
      UserType.PROFESSOR,
      UserType.ADMIN,
    ] as UserType[]);

    const ctx = makeExecutionContext(UserType.GUEST);
    const result = await guard.canActivate(ctx);

    expect(result).toBe(false);
  });

  it('deve permitir um professor acessar todas as rotas de usuários comuns', async () => {
    (reflector.get as jest.Mock).mockReturnValue([UserType.GUEST] as UserType[]);

    const ctx = makeExecutionContext(UserType.PROFESSOR);
    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
  });

  it('deve permitir um root acessar todas as rotas de admins comuns', async () => {
    (reflector.get as jest.Mock).mockReturnValue([UserType.ADMIN] as UserType[]);

    const ctx = makeExecutionContext(UserType.ROOT);
    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
  });
});
