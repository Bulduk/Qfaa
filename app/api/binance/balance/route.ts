import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(req: Request) {
  try {
    const { apiKey, secretKey } = await req.json();

    if (!apiKey || !secretKey) {
      return NextResponse.json({ error: 'API Key and Secret Key are required' }, { status: 400 });
    }

    const baseUrl = 'https://fapi.binance.com';
    const endpoint = '/fapi/v2/account';
    const timestamp = Date.now();
    
    const queryString = `timestamp=${timestamp}`;
    const signature = crypto.createHmac('sha256', secretKey).update(queryString).digest('hex');
    
    const url = `${baseUrl}${endpoint}?${queryString}&signature=${signature}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-MBX-APIKEY': apiKey,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      if (errorData && errorData.code === -2015) {
        return NextResponse.json({ 
          error: 'Geçersiz API Anahtarı, yetki eksikliği veya IP kısıtlaması. Lütfen Binance üzerinden "Enable Futures" iznini açtığınızdan ve IP kısıtlamasını ("Unrestricted") kaldırdığınızdan emin olun.' 
        }, { status: 401 });
      }
      return NextResponse.json({ 
        error: `Binance API hatası: ${response.status} - ${errorData ? JSON.stringify(errorData) : 'Bilinmeyen hata'}` 
      }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Binance Balance Fetch Error:', error.message);
    return NextResponse.json({ error: error.message || 'Bakiye çekilemedi' }, { status: 500 });
  }
}
