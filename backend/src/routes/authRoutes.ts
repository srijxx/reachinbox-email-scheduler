import { Router } from 'express';
import passport from '../config/passport';
import { getMe, logout, googleAuthCallback, googleAuthFailure } from '../controllers/authController';
import { requireAuth } from '../middleware/auth';
import { prisma } from '../config/database';

const router = Router();

// GET /api/auth/google - Initiates Google OAuth flow
router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    prompt: 'select_account',
  })
);

// GET /api/auth/google/callback - Google OAuth callback
router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: '/api/auth/google/failure' }),
  googleAuthCallback
);

// GET /api/auth/google/failure
router.get('/google/failure', googleAuthFailure);

// GET /api/auth/me - Get current authenticated user
router.get('/me', requireAuth, getMe);

// POST /api/auth/logout - Log out
router.post('/logout', requireAuth, logout);

// GET /api/auth/logout (also support GET for simplicity)
router.get('/logout', requireAuth, logout);

// ─── DEV-ONLY: instant login (no Google) ──────────────────────────────────
// Only active when NODE_ENV=development AND GOOGLE_CLIENT_ID is not set.
// Creates/finds a test user and establishes a real session.
if (process.env.NODE_ENV !== 'production' && !process.env.GOOGLE_CLIENT_ID) {
  router.post('/dev/login', async (req, res) => {
    try {
      const user = await prisma.user.upsert({
        where: { email: 'dev@reachinbox.local' },
        update: {},
        create: {
          googleId: 'dev-local-user',
          name: 'Dev User',
          email: 'dev@reachinbox.local',
          avatar: null,
        },
      });
      req.logIn(user, (err) => {
        if (err) { res.status(500).json({ message: 'Login failed', error: String(err) }); return; }
        res.json({ id: user.id, name: user.name, email: user.email });
      });
    } catch (err) {
      res.status(500).json({ message: 'Dev login failed', error: String(err) });
    }
  });
}

export default router;
