import type { AuthenticatedUser } from './request-context.js';

declare module 'express-serve-static-core' {
  interface Request {
    authUser?: AuthenticatedUser;
  }
}
