async function fetchJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

function isNodeResponse(res) {
  return !!res && typeof res.setHeader === 'function' && typeof res.end === 'function';
}

function jsonResponse(res, status, payload) {
  if (isNodeResponse(res)) {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(payload));
    return;
  }
  return new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } });
}

function textResponse(res, status, text) {
  if (isNodeResponse(res)) {
    res.statusCode = status;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end(text);
    return;
  }
  return new Response(text, { status });
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      return textResponse(res, 405, 'Method Not Allowed');
    }
    const base = isNodeResponse(res) ? 'http://localhost' : undefined;
    const url = new URL(req.url, base);
    const dates = String(url.searchParams.get('dates') || todayStr()).replace(/\D/g, '').slice(0, 8) || todayStr();
    const data = await fetchJson(`https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates=${dates}`);
    return jsonResponse(res, 200, data);
  } catch (error) {
    return jsonResponse(res, 500, { ok: false, error: error.message });
  }
}
