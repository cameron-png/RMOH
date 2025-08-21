
'use server';

const GIFTBIT_API_URL = 'https://api-testbed.giftbit.com/papi/v1';

interface FetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: object;
  params?: Record<string, string>;
}

async function fetchGiftbitAPI(endpoint: string, options: FetchOptions = {}) {
  const { method = 'GET', body, params } = options;
  const apiKey = process.env.GIFTBIT_API_KEY;

  if (!apiKey) {
    throw new Error('GIFTBIT_API_KEY is not configured on the server.');
  }
  
  const queryParams = new URLSearchParams(params).toString();
  const url = `${GIFTBIT_API_URL}/${endpoint}${queryParams ? `?${queryParams}` : ''}`;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  };

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    
    if (!response.ok) {
        let errorDetails = 'No details available.';
        try {
            const errorJson = await response.json();
            errorDetails = JSON.stringify(errorJson, null, 2);
        } catch (e) {
            errorDetails = await response.text();
        }
        console.error(`Giftbit API Error (${response.status}):`, errorDetails);
        throw new Error(`Giftbit API request failed with status ${response.status}.`);
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to fetch from Giftbit API:', error);
    throw error;
  }
}

export interface GiftbitBrand {
    brand_code: string;
    name: string;
    image_url: string;
    disclaimer: string;
    description: string;
    terms: string;
    value_type: 'VARIABLE' | 'FIXED';
    min_value_in_cents: number | null;
    max_value_in_cents: number | null;
    face_value_in_cents: number | null;
}

export async function listBrands(): Promise<GiftbitBrand[]> {
    try {
        const response = await fetchGiftbitAPI('brands', { params: { currencyisocode: 'USD', limit: '200' }});
        return response?.brands || [];
    } catch (error) {
        console.error("Could not fetch brands from Giftbit:", error);
        return [];
    }
}

interface CreateGiftPayload {
    brand_code: string;
    price_in_cents: number;
    id: string;
}

export async function createGift(payload: CreateGiftPayload) {
    const response = await fetchGiftbitAPI('direct_links', {
        method: 'POST',
        body: payload,
    });
    return response.direct_link;
}
