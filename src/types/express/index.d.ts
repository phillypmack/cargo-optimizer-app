// src/types/express/index.d.ts
import { IUser } from '../../models/User'; // Importa a interface do Mongoose

// Define a estrutura do payload que guardamos no token JWT
interface UserPayload {
    userId: string;
    isAdmin: boolean;
    email: string;
}

// Sobrescreve a declaração de tipos do Express
declare global {
    namespace Express {
        // Permite que req.user seja o usuário completo do Mongoose ou nosso payload do JWT
        export interface User extends IUser { }

        export interface Request {
            user?: User | UserPayload;
        }
    }
}