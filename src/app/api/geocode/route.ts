
import { NextResponse } from 'next/server';

// Function to introduce a delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (!query) {
    return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
  }

  try {
    // Respect Nominatim's rate limit policy (max 1 request per second)
    await delay(1000);

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
