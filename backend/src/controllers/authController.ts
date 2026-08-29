import { Request, Response } from 'express';
import { logger } from '../utils/logger';

export function getMe(req: Request, res: Response): void {
  if (!req.user) {
    res.status(401).json({ message: 'Not authenticated' });
    return;
  }

  const user = req.user as any;
  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
  });
}

export function logout(req: Request, res: Response): void {
  req.logout((err) => {
    if (err) {
      logger.error('Logout error', { error: err });
      res.status(500).json({ message: 'Logout failed' });
      return;
    }

    req.session.destroy((destroyErr) => {
      if (destroyErr) {
        logger.warn('Session destroy error', { error: destroyErr });
      }
      res.clearCookie('connect.sid');
      res.json({ message: 'Logged out successfully' });
    });
  });
}

export function googleAuthCallback(req: Request, res: Response): void {
  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';
  res.redirect(`${frontendUrl}/dashboard`);
}

export function googleAuthFailure(req: Request, res: Response): void {
  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';
  res.redirect(`${frontendUrl}/login?error=auth_failed`);
}
