async function fetchJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

export default async function handler(req) {
  try {
    if (req.method !== 'GET') {
      return new Response('Method Not Allowed', { status: 405 });
    }
    const url = new URL(req.url);
    const dates = String(url.searchParams.get('dates') || todayStr()).replace(/\D/g, '').slice(0, 8) || todayStr();
    const data = await fetchJson(`https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates=${dates}`);
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
