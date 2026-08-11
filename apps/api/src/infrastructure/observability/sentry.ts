import env from '@/env.js';
import * as Sentry from '@sentry/node';

const sentryDsn = env.SENTRY_DSN;

if (sentryDsn) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    debug: false,
    enableLogs: false,
    integrations: [
      Sentry.pinoIntegration({
        log: { levels: ['info', 'warn', 'error', 'fatal'] },
      }),
    ],
    tracesSampleRate: 0.2,
    dataCollection: {
      // To disable sending user data and HTTP bodies, uncomment the lines below. For more info visit:
      // https://docs.sentry.io/platforms/javascript/guides/node/configuration/options/#dataCollection
      userInfo: false,
      httpBodies: [],
    },
  });
}
