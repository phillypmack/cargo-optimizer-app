// src/types/express/index.d.ts

// Define a estrutura do payload que guardamos no token JWT
interface UserPayload {
    userId: string;
    isAdmin: boolean;
    email: string;
}

// Sobrescreve a declaração de tipos do Express para incluir nossa propriedade 'user'
declare namespace Express {
    export interface Request {
        user?: UserPayload;
    }
}