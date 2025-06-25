// src/services/geminiService.ts

// CORRIGIDO: Usando o nome da classe correto (GoogleGenAI) na importação nomeada
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
    throw new Error('GEMINI_API_KEY não está definida no ambiente do servidor.');
}

// CORRIGIDO: Usando o nome correto da classe (GoogleGenAI) para criar a instância
const genAI = new GoogleGenAI(apiKey);

/**
 * Gera dicas de empacotamento usando um prompt fornecido.
 * @param {string} prompt - O prompt completo a ser enviado para a API Gemini.
 * @returns {Promise<string>} A resposta em texto da API.
 */
export const generatePackingTips = async (prompt: string): Promise<string> => {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error("Erro ao chamar a API Gemini:", error);
        throw new Error("Falha ao se comunicar com o serviço de IA.");
    }
};