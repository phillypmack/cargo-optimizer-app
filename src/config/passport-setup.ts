// src/config/passport-setup.ts
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import User from '../models/User'; // O import do modelo já deve estar correto
import dotenv from 'dotenv';

dotenv.config();

passport.serializeUser((user: any, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});

passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            callbackURL: `${process.env.SERVER_URL}/api/auth/google/callback`,
            passReqToCallback: true
        },
        async (req, accessToken, refreshToken, profile, done) => {
            try {
                const email = profile.emails?.[0].value;
                if (!email) {
                    return done(new Error("Email não encontrado no perfil do Google."), false);
                }

                let user = await User.findOne({ email: email });

                if (user) {
                    // Usuário já existe, prossiga
                    return done(null, user);
                } else {
                    // Novo usuário, vamos registrá-lo com todos os campos necessários
                    const newUser = new User({
                        googleId: profile.id,                 // <-- Adicionado: Vincula o ID do Google
                        email: email,
                        displayName: profile.displayName,     // <-- Adicionado: Pega o nome do perfil
                        authProvider: 'google',               // <-- Adicionado: Define o provedor
                        isAdmin: email === process.env.ADMIN_EMAIL,
                    });
                    await newUser.save();
                    return done(null, newUser);
                }
            } catch (err) {
                return done(err as Error, false);
            }
        }
    )
);