// src/middleware/authMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkey';

interface UserPayload {
    userId: string;
    isAdmin: boolean;
    email: string;
}

// Estendemos a interface Request do Express para incluir nossa propriedade 'user'
interface AuthenticatedRequest extends Request {
    user?: UserPayload;
}

export const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) {
        res.status(401).json({ message: 'Authentication token required.' });
        return; // Retornamos explicitamente para garantir que a função termine aqui
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            res.status(403).json({ message: 'Invalid or expired token.' });
            return; // Retornamos explicitamente
        }
        req.user = user as UserPayload;
        next();
    });
};

export const authorizeAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !req.user.isAdmin) {
        res.status(403).json({ message: 'Admin access required.' });
        return;
    }
    next();
};