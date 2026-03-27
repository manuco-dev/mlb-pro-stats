export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
  let body;
  try { body = await req.json(); } catch (_) { return new Response('Bad Request', { status: 400 }); }
  const sys = 'Eres un analista MLB. Devuelve SOLO JSON. Para cada juego en input.games produce { "gameId": string, "topPicks": [ { "market": "ML"|"TOTAL"|"K"|"IP", "sideTeam"?: string, "side"?: "Over"|"Under", "line"?: number, "target"?: "away"|"home", "confidence": "strong"|"medium", "reason": string } ] }. Para ML usa "sideTeam" con abreviatura del equipo. Para TOTAL usa side y line. Para K e IP usa target=away|home y side, line si aplica. Máximo 3 picks por juego. Prioriza value según estas señales: abridores combinando 2025+2026, WHIP, K/BB, IP promedio y split relevante del día (home para el local, away para el visitante), ofensiva con R/G 2025+2026, AVG 2025 del equipo, hits por juego L10, proporción de bateadores con hit vs sin hit para medir bate caliente, momios y clima. Da más peso a la localía/split correcto del pitcher que al promedio general. Evita picks débiles si las señales chocan. Razones breves y concretas. No incluyas texto fuera del JSON.';
  const usr = JSON.stringify(body);
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: sys }, { role: 'user', content: usr }],
      temperature: 0.2,
      response_format: { type: 'json_object' }
    })
  });
  if (!r.ok) return new Response(JSON.stringify({ picks: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  const data = await r.json();
  const content = data?.choices?.[0]?.message?.content || '{"picks":[]}';
  return new Response(content, { headers: { 'Content-Type': 'application/json' } });
}
