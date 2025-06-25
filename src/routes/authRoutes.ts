// src/routes/authRoutes.ts
import { Router } from 'express';
import passport from 'passport';
import jwt from 'jsonwebtoken';
import { register, login, checkAuthStatus, verifyEmail } from '../controllers/authController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkey';

// === ROTAS DE AUTENTICAÇÃO LOCAL ===
router.post('/register', register);
router.post('/login', login);
router.post('/verify-email', verifyEmail);

// Rota para o frontend verificar se o token JWT ainda é válido
router.get('/status', authenticateToken, checkAuthStatus);


// === ROTAS DE AUTENTICAÇÃO GOOGLE (OAUTH) ===
router.get('/google', passport.authenticate('google', {
    scope: ['profile', 'email']
}));

router.get('/google/callback', passport.authenticate('google', { failureRedirect: '/login', session: false }),
    (req, res) => {
        const user: any = req.user;
        const token = jwt.sign(
            { userId: user._id, isAdmin: user.isAdmin, email: user.email },
            JWT_SECRET,
            { expiresIn: '1h' }
        );
        res.redirect(`${process.env.CLIENT_URL}/auth/callback?token=${token}`);
    }
);

export default router;