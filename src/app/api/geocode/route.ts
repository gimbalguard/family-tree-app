
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (!query) {
    return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
  }

  try {
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
    
    const response = await fetch(nominatimUrl, {
      headers: {
        'User-Agent': 'FamilyTreeApp/1.0',
      },
    });

    if (!response.ok) {
        console.error(`Nominatim API error: ${response.status} ${response.statusText}`);
        return NextResponse.json([], { status: 200 }); // Return empty array on server-side fetch error
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Geocoding API route error:', error);
    // On any server-side error, return an empty array to the client
    return NextResponse.json([], { status: 200 });
  }
}
