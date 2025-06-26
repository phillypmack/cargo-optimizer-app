// src/app.ts
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import passport from 'passport';

// 1. Importe a configuração do Passport PRIMEIRO.
import './config/passport-setup.js';

// 2. Agora, importe suas rotas.
import authRoutes from './routes/authRoutes.js';
// import aiRoutes from './routes/aiRoutes.js'; // ROTA DA IA DESATIVADA TEMPORARIAMENTE

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Configuração da Sessão (necessária para Passport OAuth)
app.use(session({
    secret: process.env.SESSION_SECRET || 'uma-string-secreta-para-a-sessao',
    resave: false,
    saveUninitialized: true,
}));

// Inicializa o Passport
app.use(passport.initialize());
app.use(passport.session());

// Rotas
app.use('/api/auth', authRoutes);
// app.use('/api/ai', aiRoutes); // USO DA ROTA DA IA DESATIVADO TEMPORARIAMENTE

// Rota de teste
app.get('/', (_req, res) => {
    res.send('Cargo Optimizer Backend API is running!');
});

export default app;