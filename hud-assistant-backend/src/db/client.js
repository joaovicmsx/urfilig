import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis;

export const prisma = globalForPrisma.prisma || new PrismaClient({
  log: ['error'],
});

// The Neon endpoint can resolve to several addresses, and some routes may
// intermittently fail before a query reaches PostgreSQL. Retry only connection
// initialization failures; authentication and query errors are returned as-is.
if (!globalForPrisma.prismaRetryMiddlewareAttached) {
  const retryDelaysMs = [250, 700, 1500];

  prisma.$use(async (params, next) => {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await next(params);
      } catch (error) {
        const cannotReachDatabase =
          error?.code === 'P1001' ||
          (error?.name === 'PrismaClientInitializationError' &&
            /Can't reach database server/i.test(error.message || ''));

        if (!cannotReachDatabase || attempt >= retryDelaysMs.length) {
          throw error;
        }

        console.warn(
          `[prisma] banco indisponível; nova tentativa ${attempt + 2}/${retryDelaysMs.length + 1}`,
        );
        await new Promise((resolve) => setTimeout(resolve, retryDelaysMs[attempt]));
      }
    }
  });

  globalForPrisma.prismaRetryMiddlewareAttached = true;
}

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
