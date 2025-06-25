// src/middleware/authMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkey';

export const authenticateToken = (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) {
        res.status(401).json({ message: 'Authentication token required.' });
        return;
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            res.status(403).json({ message: 'Invalid or expired token.' });
            return;
        }
        // O TypeScript agora entende isso globalmente, sem precisar de importação aqui
        req.user = user as Express.User;
        next();
    });
};

export const authorizeAdmin = (req: Request, res: Response, next: NextFunction): void => {
    // Acessamos as propriedades de forma segura, pois o tipo pode variar
    const userIsAdmin = req.user && 'isAdmin' in req.user && req.user.isAdmin;

    if (!userIsAdmin) {
        res.status(403).json({ message: 'Admin access required.' });
        return;
    }
    next();
};