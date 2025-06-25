// src/middleware/authMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { UserPayload } from '../types/express/index.d'; // Importamos o tipo se necessário em outros lugares

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
        // Agora o TypeScript sabe que req.user existe!
        req.user = user as UserPayload;
        next();
    });
};

export const authorizeAdmin = (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !req.user.isAdmin) {
        res.status(403).json({ message: 'Admin access required.' });
        return;
    }
    next();
};