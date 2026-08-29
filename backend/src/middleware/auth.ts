import { Request, Response, NextFunction } from 'express';

/**
 * Express middleware that rejects unauthenticated requests with 401.
 * Attach to any route that requires a logged-in user.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.isAuthenticated && req.isAuthenticated()) {
    next();
    return;
  }
  res.status(401).json({ message: 'Authentication required' });
}
