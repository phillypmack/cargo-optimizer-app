// src/controllers/aiController.ts
import { Request, Response } from 'express';
import { generatePackingTips } from '../services/geminiService';

export const getPackingTipsController = async (req: Request, res: Response) => {
    try {
        // Os dados para construir o prompt virão do corpo da requisição
        const { items, containerConfig } = req.body;

        if (!items || !containerConfig) {
            return res.status(400).json({ message: 'Dados de itens e contêiner são necessários.' });
        }

        // Lógica para construir o prompt (similar à que estava no frontend)
        let prompt = `You are a cargo packing optimization assistant.
Analyze the following container(s) and item(s) to provide specific packing insights.

Container Configuration:
- Number of Identical Containers: ${containerConfig.numContainers}
- Dimensions (per container):
  - Length: ${containerConfig.length.toFixed(2)}m
  - Width: ${containerConfig.width.toFixed(2)}m
  - Height: ${containerConfig.height.toFixed(2)}m

Item Details:\n`;
        items.forEach((item, index) => {
            prompt += `Item ${index + 1} (User named: '${item.name}'):\n`;
            prompt += `- Shape: ${item.shape}\n`;
            prompt += `- Dimensions (L x W x H): ${item.length.toFixed(2)}m x ${item.width.toFixed(2)}m x ${item.height.toFixed(2)}m\n`;
            prompt += `- Quantity: ${item.quantity}\n\n`;
        });

        prompt += `Please provide actionable packing tips based on this data. Focus on space optimization, rotation suggestions, and loading order.`;

        const tips = await generatePackingTips(prompt);
        res.status(200).json({ tips });

    } catch (error: any) {
        console.error('Erro no controlador de IA:', error);
        res.status(500).json({ message: error.message || 'Erro interno do servidor ao buscar dicas.' });
    }
};