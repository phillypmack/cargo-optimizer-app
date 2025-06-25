// src/api/aiApiService.ts

const API_BASE_URL = 'http://localhost:5000/api/ai';

/**
 * Busca dicas de empacotamento do backend seguro.
 * @param payload - Os dados contendo { items, containerConfig }.
 * @param token - O token JWT do usuário para autorização.
 * @returns A resposta da API.
 */
export const fetchPackingTips = async (payload: any, token: string) => {
    const response = await fetch(`${API_BASE_URL}/packing-tips`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`, // Envia o token para autenticação
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        // Tenta ler a mensagem de erro do corpo da resposta
        const errorData = await response.json();
        throw new Error(errorData.message || `Erro do servidor: ${response.statusText}`);
    }

    return response.json();
};