// src/controllers/authController.ts
import { Request, Response } from 'express';
import { registerUser, loginUser, googleLoginUser, verifyEmailToken } from '../services/authService.js';

/**
 * Registra um novo usuário local.
 */
export const register = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required.' });
        }
        await registerUser(email, password);
        res.status(201).json({ message: 'Registration successful! Please check your email to verify your account.' });
    } catch (error: any) {
        console.error('Registration error:', error);
        if (error.message.includes('User with this email already exists.')) {
            return res.status(409).json({ message: error.message });
        }
        res.status(500).json({ message: 'Server error during registration.' });
    }
};

/**
 * Realiza o login de um usuário local.
 */
export const login = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required.' });
        }
        const token = await loginUser(email, password);
        res.status(200).json({ token, message: 'Login successful!' });
    } catch (error: any) {
        console.error('Login error:', error);
        res.status(401).json({ message: error.message || 'Invalid credentials.' });
    }
};

/**
 * Realiza o login com Google.
 */
export const googleLogin = async (req: Request, res: Response) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ message: 'Email is required for Google login.' });
        }
        const token = await googleLoginUser(email);
        res.status(200).json({ token, message: 'Google login successful!' });
    } catch (error: any) {
        console.error('Google login error:', error);
        res.status(500).json({ message: 'Server error during Google login.' });
    }
};

/**
 * Verifica o token de verificação de e-mail.
 */
export const verifyEmail = async (req: Request, res: Response) => {
    try {
        const { token } = req.body;
        if (!token) {
            return res.status(400).json({ message: 'Token is required.' });
        }
        const jwtToken = await verifyEmailToken(token);
        res.status(200).json({ token: jwtToken, message: 'Email verified successfully! You are now logged in.' });
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

/**
 * Verifica o status de autenticação de um usuário com um token JWT válido.
 */
export const checkAuthStatus = async (req: Request, res: Response) => {
    // A interface customizada para Request pode não estar disponível aqui, usamos 'any' para segurança de tipo.
    // O 'req.user' é adicionado pelo middleware 'authenticateToken'.
    const user = (req as any).user;

    if (user) {
        return res.status(200).json({
            isAuthenticated: true,
            isAdmin: user.isAdmin,
            userEmail: user.email,
            message: 'User is authenticated.'
        });
    } else {
        return res.status(401).json({
            isAuthenticated: false,
            message: 'User is not authenticated.'
        });
    }
};