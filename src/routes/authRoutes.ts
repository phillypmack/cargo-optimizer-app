// src/routes/authRoutes.ts
import { Router } from 'express';
import passport from 'passport';
import jwt from 'jsonwebtoken';
import { register, login, checkAuthStatus, verifyEmail } from '../controllers/authController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkey';

// === ROTAS DE AUTENTICAÇÃO LOCAL ===
router.post('/register', register);
router.post('/login', login);
router.post('/verify-email', verifyEmail);

// CORREÇÃO: Passando o middleware e o controlador como argumentos separados
router.get('/status', authenticateToken, checkAuthStatus);


// === ROTAS DE AUTENTICAÇÃO GOOGLE (OAUTH) ===
router.get('/google', passport.authenticate('google', {
    scope: ['profile', 'email']
}));

router.get('/google/callback', passport.authenticate('google', { failureRedirect: '/login', session: false }),
    (req: any, res) => { // Tipagem de 'req' como 'any' para acomodar a propriedade 'user' do passport
        const user = req.user;
        const token = jwt.sign(
            { userId: user._id, isAdmin: user.isAdmin, email: user.email },
            JWT_SECRET,
            { expiresIn: '1h' }
        );
        // Redireciona para o frontend com o token
        res.redirect(`${process.env.CLIENT_URL}?token=${token}`);
    }
);

export default router;