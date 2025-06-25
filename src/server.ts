// src/server.ts
import app from './app.ts'
import connectDB from './config/database';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 5000; // Porta do servidor, padrão 5000

// Conecta ao banco de dados e inicia o servidor
connectDB().then(() => {
    app.listen(PORT, () => {
        console.log(`Servidor rodando na porta ${PORT}`);
        console.log(`Acesse: http://localhost:${PORT}`);
    });
}).catch(err => {
    console.error('Falha ao iniciar o servidor devido a erro no DB:', err);
    process.exit(1);
});