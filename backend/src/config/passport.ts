import passport from 'passport';
import { prisma } from './database';
import { env } from './env';
import { logger } from '../utils/logger';

// Only register Google strategy if credentials are provided
if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
  const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
  passport.use(
    new GoogleStrategy(
      {
        clientID: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        callbackURL: env.GOOGLE_CALLBACK_URL,
      },
      async (_accessToken: string, _refreshToken: string, profile: any, done: any) => {
        try {
          const googleId = profile.id;
          const email = profile.emails?.[0]?.value;
          const name = profile.displayName;
          const avatar = profile.photos?.[0]?.value;
          if (!email) return done(new Error('No email from Google profile'));
          const user = await prisma.user.upsert({
            where: { googleId },
            update: { name, avatar, email },
            create: { googleId, name, email, avatar },
          });
          logger.info('Google OAuth user authenticated', { userId: user.id });
          return done(null, user);
        } catch (error) {
          return done(error as Error);
        }
      }
    )
  );
  logger.info('Google OAuth strategy registered');
} else {
  logger.warn('Google OAuth not configured — /api/auth/google will be unavailable');
}

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    done(null, user);
  } catch (error) {
    done(error);
  }
});

export default passport;
