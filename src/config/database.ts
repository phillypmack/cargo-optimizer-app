// src/config/database.ts
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config(); // Carrega variáveis de ambiente do .env

const connectDB = async () => {
    try {
        const mongoUri = process.env.MONGO_URI;

        if (!mongoUri) {
            throw new Error('MONGO_URI not defined in environment variables. Please check your .env file.');
        }

        await mongoose.connect(mongoUri);
        console.log('MongoDB conectado com sucesso!');
    } catch (err) {
        console.error('Erro ao conectar ao MongoDB:', err);
        process.exit(1); // Sai do processo com erro
    }
};

export default connectDB;