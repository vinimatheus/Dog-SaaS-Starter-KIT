/**
 * Cliente API para fazer requisições para as APIs internas
 * com autorização adequada
 */

// Tipos para a API de organizações
export interface Organization {
  id: string;
  name: string;
  uniqueId: string;
  type?: string;
}

// Função genérica para buscar dados da API com cabeçalhos de autorização
export async function fetchWithAuth<T>(
  endpoint: string, 
  options: RequestInit = {}
): Promise<T> {
  try {
    // Combinar os cabeçalhos default com os fornecidos
    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': process.env.NEXT_PUBLIC_ORG_API_KEY || '',
      ...options.headers,
    };

    // Construir a URL completa
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const url = endpoint.startsWith('/') 
      ? `${baseUrl}${endpoint}` 
      : `${baseUrl}/${endpoint}`;

    // Fazer a requisição com os cabeçalhos atualizados
    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Verificar se a resposta foi bem-sucedida
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    // Retornar os dados parseados
    return await response.json() as T;
  } catch (error) {
    console.error('API request error:', error);
    throw error;
  }
}

// Cliente específico para a API de organizações
export const organizationsApi = {
  // Buscar todas as organizações do usuário
  async getAll() {
    return fetchWithAuth<Organization[]>('/api/organizations');
  },
  
  // Buscar uma organização específica
  async getById(orgId: string) {
    return fetchWithAuth<Organization>(`/api/organizations/${orgId}`);
  }
}; 