export interface Organization {
  id: string;
  name: string;
  uniqueId: string;
  type?: string;
}

export async function fetchWithAuth<T>(
  endpoint: string, 
  options: RequestInit = {}
): Promise<T> {
  try {
    
    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': process.env.NEXT_PUBLIC_ORG_API_KEY || '',
      ...options.headers,
    };

    
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const url = endpoint.startsWith('/') 
      ? `${baseUrl}${endpoint}` 
      : `${baseUrl}/${endpoint}`;

    
    const response = await fetch(url, {
      ...options,
      headers,
    });

    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    
    return await response.json() as T;
  } catch (error) {
    console.error('API request error:', error);
    throw error;
  }
}


export const organizationsApi = {
  
  async getAll() {
    return fetchWithAuth<Organization[]>('/api/organizations');
  },
  
  
  async getById(orgId: string) {
    return fetchWithAuth<Organization>(`/api/organizations/${orgId}`);
  }
}; 