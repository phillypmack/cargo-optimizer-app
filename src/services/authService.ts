// src/services/authService.ts
import User from '../models/User';
import jwt from 'jsonwebtoken';
import crypto from 'crypto'; // NOVO: Módulo para gerar o token
import { sendVerificationEmail } from './emailService'; // NOVO: Importa nosso serviço de e-mail
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkey';

// REGISTRO ATUALIZADO
export const registerUser = async (email: string, password: string): Promise<void> => {
    let user = await User.findOne({ email });
    if (user) {
        throw new Error('User with this email already exists.');
    }

    const displayName = email.split('@')[0];

    // NOVO: Gera um token de verificação
    const verificationToken = crypto.randomBytes(32).toString('hex');

    user = new User({
        email,
        password,
        displayName,
        authProvider: 'local',
        emailVerificationToken: verificationToken,
        emailVerificationTokenExpires: Date.now() + 3600000, // Token expira em 1 hora
    });

    await user.save();

    // NOVO: Envia o e-mail de verificação (usando nosso serviço simulado)
    await sendVerificationEmail(user.email, verificationToken);

    // IMPORTANTE: Não retornamos mais um token JWT aqui. O usuário precisa verificar o e-mail primeiro.
};


// LOGIN ATUALIZADO
export const loginUser = async (email: string, password: string): Promise<string> => {
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
        throw new Error('Invalid credentials.');
    }

    // NOVO: Verifica se o e-mail do usuário foi verificado antes de permitir o login
    if (user.authProvider === 'local' && !user.isEmailVerified) {
        throw new Error('Please verify your email before logging in.');
    }

    if (!user.password) {
        throw new Error('User registered via Google, please use Google login.');
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
        throw new Error('Invalid credentials.');
    }

    user.lastLoginAt = new Date();
    await user.save();

    const token = jwt.sign(
        { userId: user._id, isAdmin: user.isAdmin, email: user.email },
        JWT_SECRET,
        { expiresIn: '1h' }
    );

    return token;
};

// NOVA FUNÇÃO DE VERIFICAÇÃO
export const verifyEmailToken = async (token: string): Promise<string> => {
    const user = await User.findOne({
        emailVerificationToken: token,
        emailVerificationTokenExpires: { $gt: Date.now() }, // Verifica se o token não expirou
    });

    if (!user) {
        throw new Error('Token is invalid or has expired.');
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationTokenExpires = undefined;
    user.lastLoginAt = new Date();
    await user.save();

    // Após a verificação, gera um token JWT para o usuário fazer login automaticamente
    const jwtToken = jwt.sign(
        { userId: user._id, isAdmin: user.isAdmin, email: user.email },
        JWT_SECRET,
        { expiresIn: '1h' }
    );
    return jwtToken;
};


// ... o resto do arquivo permanece como na correção anterior ...
// (googleLoginUser não precisa de verificação, pois o Google já verifica o e-mail)
export const googleLoginUser = async (email: string): Promise<string> => {
    let user = await User.findOne({ email });

    if (!user) {
        const displayName = email.split('@')[0];
        user = new User({
            email,
            authProvider: 'google',
            displayName: displayName,
            isAdmin: email === process.env.ADMIN_EMAIL,
            isEmailVerified: true, // Usuários do Google já são considerados verificados
        });
        await user.save();
    }

    user.lastLoginAt = new Date();
    await user.save();

    const token = jwt.sign(
        { userId: user._id, isAdmin: user.isAdmin, email: user.email },
        JWT_SECRET,
        { expiresIn: '1h' }
    );

    return token;
};