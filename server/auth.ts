import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import bcrypt from 'bcryptjs';
import { storage } from './storage';
import type { User } from '@shared/schema';

passport.use(
  new LocalStrategy(
    {
      usernameField: 'email', // We keep this name but accept both email and username
      passwordField: 'password',
    },
    async (emailOrUsername, password, done) => {
      try {
        // Try to find user by email first, then by username
        let user = await storage.getUserByEmail(emailOrUsername);
        
        if (!user) {
          user = await storage.getUserByUsername(emailOrUsername);
        }
        
        if (!user) {
          return done(null, false, { message: 'Ungültiger Benutzername/E-Mail oder Passwort' });
        }

        const isValidPassword = await bcrypt.compare(password, user.passwordHash);
        
        if (!isValidPassword) {
          return done(null, false, { message: 'Ungültiger Benutzername/E-Mail oder Passwort' });
        }

        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }
  )
);

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await storage.getUserById(id);
    done(null, user);
  } catch (error) {
    done(error);
  }
});

export default passport;
