export const config = { runtime: 'edge' };

async function fetchJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

function todayStr() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

function implied(ml) {
  if (typeof ml !== 'number' || isNaN(ml)) return null;
  if (ml < 0) return (-ml) / ((-ml) + 100);
  return 100 / (ml + 100);
}

function noVig(awayMl, homeMl) {
  const pA = implied(awayMl);
  const pH = implied(homeMl);
  if (pA == null || pH == null) return { away: null, home: null };
  const d = pA + pH;
  if (d <= 0) return { away: null, home: null };
  return { away: pA / d, home: pH / d };
}

export default async function handler(req) {
  try {
    if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
    let body; try { body = await req.json(); } catch { body = {}; }
    const dateKey = (body?.date || '').replace(/-/g, '') || todayStr();
    const scoreboardUrl = `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates=${dateKey}`;
    const data = await fetchJson(scoreboardUrl);
    const events = Array.isArray(data.events) ? data.events : [];
    const games = [];
    for (const ev of events) {
      const comp = ev.competitions?.[0] || {};
      const comps = comp.competitors || [];
      const away = comps.find(c => c.homeAway === 'away') || {};
      const home = comps.find(c => c.homeAway === 'home') || {};
      const gameId = String(ev.id || comp.id || '');
      const odds0 = comp.odds?.[0] || {};
      const mlAway = Number(odds0?.moneyline?.away?.close?.odds ?? odds0?.moneyline?.away?.open?.odds ?? NaN);
      const mlHome = Number(odds0?.moneyline?.home?.close?.odds ?? odds0?.moneyline?.home?.open?.odds ?? NaN);
      const total   = Number(odds0?.total?.over?.close?.line ?? odds0?.total?.over?.open?.line ?? NaN);
      const novig = noVig(mlAway, mlHome);
      const weather = ev.weather || {};
      const venue = comp.venue || {};
      games.push({
        gameId,
        away: { abr: away?.team?.abbreviation || '', id: away?.team?.id || '' },
        home: { abr: home?.team?.abbreviation || '', id: home?.team?.id || '' },
        odds: { mlAway: isNaN(mlAway) ? null : mlAway, mlHome: isNaN(mlHome) ? null : mlHome, total: isNaN(total) ? null : total, novig },
        weather: { tempF: weather.temperature ?? null, indoor: !!weather.isIndoor },
        venue: { name: venue.fullName || '' }
      });
    }
    const sys = 'Eres un analista MLB. Devuelve SOLO JSON. Para cada juego en input.games produce { "gameId": string, "topPicks": [ { "market": "ML"|"TOTAL"|"K"|"IP", "sideTeam"?: string, "side"?: "Over"|"Under", "line"?: number, "target"?: "away"|"home", "confidence": "strong"|"medium", "reason": string } ] }. Para ML usa "sideTeam" con abreviatura del equipo. Para TOTAL usa side y line. Para K e IP usa target=away|home y side, line si aplica. Máximo 3 picks por juego. Prioriza value según estas señales: abridores combinando 2025+2026, WHIP, K/BB, IP promedio y split relevante del día (home para el local, away para el visitante), ofensiva con R/G 2025+2026, AVG 2025 del equipo, hits por juego L10, proporción de bateadores con hit vs sin hit para medir bate caliente, momios y clima. Da más peso a la localía/split correcto del pitcher que al promedio general. Evita picks débiles si las señales chocan. Razones breves y concretas. No incluyas texto fuera del JSON.';
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: sys }, { role: 'user', content: JSON.stringify({ date: dateKey, games }) }],
        temperature: 0.2,
        response_format: { type: 'json_object' }
      })
    });
    if (!r.ok) return new Response(JSON.stringify({ picks: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    const ai = await r.json();
    const content = ai?.choices?.[0]?.message?.content || '{"picks":[]}';
    return new Response(content, { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ picks: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
}
