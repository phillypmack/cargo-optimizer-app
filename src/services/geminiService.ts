// src/services/geminiService.ts
import * as genai from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
    throw new Error('GEMINI_API_KEY não está definida no ambiente do servidor.');
}

// Acessa a classe através do namespace importado
const genAI = new genai.GoogleGenerativeAI(apiKey);

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