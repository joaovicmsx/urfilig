import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis;
const databaseUrl = configurarUrlDoPool(process.env.DATABASE_URL);

function configurarUrlDoPool(urlOriginal) {
  if (!urlOriginal) return undefined;
  try {
    const url = new URL(urlOriginal);
    // Respeite valores explícitos; no app local, use poucas conexões por
    // processo e uma fila maior para absorver rajadas do frontend no Neon.
    if (!url.searchParams.has('connection_limit')) {
      url.searchParams.set('connection_limit', process.env.PRISMA_CONNECTION_LIMIT || '3');
    }
    if (!url.searchParams.has('pool_timeout')) {
      url.searchParams.set('pool_timeout', process.env.PRISMA_POOL_TIMEOUT || '20');
    }
    return url.toString();
  } catch {
    return urlOriginal;
  }
}

export const prisma = globalForPrisma.prisma || new PrismaClient({
  ...(databaseUrl ? { datasources: { db: { url: databaseUrl } } } : {}),
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

// Prisma has a per-client pool. Queue bursts before they reach it so concurrent
// chat, socket and UI refreshes cannot occupy every connection at once.
if (!globalForPrisma.prismaConcurrencyMiddlewareAttached) {
  const maxConcurrentQueries = 2;
  let activeQueries = 0;
  const waitingQueries = [];

  const acquireQuerySlot = () => new Promise((resolve) => {
    if (activeQueries < maxConcurrentQueries) {
      activeQueries += 1;
      resolve();
      return;
    }
    waitingQueries.push(resolve);
  });

  const releaseQuerySlot = () => {
    const next = waitingQueries.shift();
    if (next) next();
    else activeQueries -= 1;
  };

  prisma.$use(async (params, next) => {
    await acquireQuerySlot();
    try {
      return await next(params);
    } finally {
      releaseQuerySlot();
    }
  });

  globalForPrisma.prismaConcurrencyMiddlewareAttached = true;
}

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
