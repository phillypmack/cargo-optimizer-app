// src/services/emailService.ts
import dotenv from 'dotenv';

dotenv.config();

// IMPORTANTE: Este é um serviço de e-mail de simulação.
// Para produção, você deve implementar uma integração real
// com um serviço como Nodemailer, SendGrid, etc.

/**
 * Envia um e-mail de verificação para o usuário (simulado).
 * @param to O endereço de e-mail do destinatário.
 * @param token O token de verificação a ser enviado.
 */
export const sendVerificationEmail = async (to: string, token: string) => {
    // Montamos o link/token que seria enviado no e-mail real
    const verificationLink = `${process.env.CLIENT_URL}/verify-email?token=${token}`;
    const subject = 'Verifique seu e-mail para o 3D Cargo Optimizer';
    const textBody = `Olá! Obrigado por se registrar. Por favor, use o seguinte token para verificar seu e-mail: ${token}\n\nOu clique no link para verificar seu e-mail: ${verificationLink}`;

    // Para fins de desenvolvimento, imprimimos as informações no console do backend.
    // Você pode copiar o token ou o link daqui para testar no frontend.
    console.log('----------------------------------------------------');
    console.log('📧 SERVIÇO DE E-MAIL (SIMULAÇÃO) 📧');
    console.log(`Para: ${to}`);
    console.log(`Assunto: ${subject}`);
    console.log(`Corpo: ${textBody}`);
    console.log('----------------------------------------------------');

    // Retorna uma promessa resolvida para simular que a operação foi concluída.
    return Promise.resolve();
};