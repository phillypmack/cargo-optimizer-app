// src/middleware/authMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkey'; // Usar a mesma chave do authService

interface UserPayload {
    userId: string;
    isAdmin: boolean;
    email: string;
}

export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Espera "Bearer TOKEN"

    if (token == null) {
        return res.status(401).json({ message: 'Authentication token required.' }); // Não autorizado
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            // Se o token for inválido ou expirado
            return res.status(403).json({ message: 'Invalid or expired token.' }); // Proibido
        }
        // Adiciona as informações do usuário à requisição para uso em controladores posteriores
        (req as any).user = user as UserPayload;
        next(); // Continua para a próxima função middleware/controller
    });
};

export const authorizeAdmin = (req: Request, res: Response, next: NextFunction) => {
    if (!(req as any).user || !(req as any).user.isAdmin) {
        return res.status(403).json({ message: 'Admin access required.' });
    }
    next();
};