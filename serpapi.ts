import axios from 'axios';

export async function searchGoogleMaps(query: string, lat: number, lng: number, apiKey: string) {
  const params = {
    engine: 'google_maps',
    q: query,
    ll: `@${lat},${lng},14z`,
    type: 'search',
    api_key: apiKey,
  };

  const { data } = await axios.get('https://serpapi.com/search', { params });
  return data.local_results || [];
}
