// src/api/authApiService.ts

// URL base da sua API backend. Certifique-se de que seu servidor backend esteja rodando.
const API_BASE_URL = 'http://localhost:5000/api/auth';

/**
 * Registra um novo usuário.
 * @param email O email do usuário.
 * @param password A senha do usuário.
 * @returns A resposta da API em caso de sucesso.
 */
export const registerUser = async (email: string, password: string) => {
    const response = await fetch(`${API_BASE_URL}/register`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
    });

    // CORRIGIDO: Verifica se a resposta HTTP indica um erro
    if (!response.ok) {
        // Se não for 'ok' (ex: status 409, 500), lê o corpo do erro e o lança
        const errorData = await response.json();
        throw new Error(errorData.message || `Server responded with status: ${response.status}`);
    }

    // Se a resposta for 'ok' (ex: status 201), retorna o corpo JSON
    return response.json();
};

/**
 * Realiza o login de um usuário.
 * @param email O email do usuário.
 * @param password A senha do usuário.
 * @returns A resposta da API.
 */
export const loginUser = async (email: string, password: string) => {
    const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
    });
    return response.json();
};

/**
 * Verifica o status de autenticação usando um token.
 * @param token O token JWT.
 * @returns A resposta da API com os dados do usuário.
 */
export const checkAuthStatus = async (token: string) => {
    const response = await fetch(`${API_BASE_URL}/status`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            // Envia o token no cabeçalho de autorização
            'Authorization': `Bearer ${token}`,
        },
    });
    return response.json();
};
/**
 * Envia o token de verificação para o backend.
 * @param token O token que o usuário recebeu por e-mail.
 * @returns A resposta da API com um novo token JWT.
 */
export const verifyUserEmail = async (token: string) => {
    const response = await fetch(`${API_BASE_URL}/verify-email`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
    });
    return response.json();
};