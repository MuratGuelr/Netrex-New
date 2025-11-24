import { NextRequest, NextResponse } from 'next/server';
import { AccessToken } from 'livekit-server-sdk';

export const dynamic = 'force-dynamic';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const room = searchParams.get('room') || 'default-room';
    const username = searchParams.get('username') || 'anonymous';

    // Room ve username validasyonu
    if (!room || room.trim().length === 0) {
      return NextResponse.json(
        { error: 'Room name is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!username || username.trim().length === 0) {
      return NextResponse.json(
        { error: 'Username is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    if (!apiKey || !apiSecret) {
      console.error('LiveKit API credentials are missing');
      console.error('Please set LIVEKIT_API_KEY and LIVEKIT_API_SECRET environment variables');
      return NextResponse.json(
        { 
          error: 'Server configuration error: LiveKit credentials not found',
          hint: 'Please set LIVEKIT_API_KEY and LIVEKIT_API_SECRET environment variables'
        },
        { status: 500, headers: corsHeaders }
      );
    }

    // AccessToken oluştur - Her kullanıcı için benzersiz identity
    // Aynı kullanıcı adı ile birden fazla bağlantı olabilir, bu yüzden timestamp ekliyoruz
    const uniqueIdentity = `${username.trim()}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    
    const at = new AccessToken(apiKey, apiSecret, {
      identity: uniqueIdentity,
      name: username.trim(),
    });

    // Grant ekle
    at.addGrant({
      room: room.trim(),
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await at.toJwt();

    return NextResponse.json({ token }, { headers: corsHeaders });
  } catch (error: any) {
    console.error('Error generating LiveKit token:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate token' },
      { status: 500, headers: corsHeaders }
    );
  }
}

