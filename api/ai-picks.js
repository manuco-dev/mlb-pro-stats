export const config = { runtime: 'edge' };

/* ── Formatting helpers ──────────────────────────────────── */
function num(v, d = 2) {
  const x = Number(v);
  return Number.isFinite(x) ? x.toFixed(d) : '–';
}
function pct(v) {
  const x = Number(v);
  return Number.isFinite(x) ? `${(x * 100).toFixed(0)}%` : '–';
}

/* ── Build human-readable game block for prompt ─────────── */
function formatGame(g) {
  const lines = [];
  lines.push(`══ ${g.away?.abr || '?'} @ ${g.home?.abr || '?'}  (gameId: ${g.gameId || ''}) ══`);

  /* Pitchers */
  const pa = g.pitchers || {};
  if (pa.away) {
    const p = pa.away;
    lines.push(`Pitcher VIS ${g.away?.abr} (${g.away?.pitcherLast || 'TBD'}):`);
    lines.push(`  WHIP ${num(p.whip)} · K/BB ${num(p.kbb)} · IP prom ${num(p.ipAvg, 1)} · IP visitante ${num(p.ipAway, 1)} · IP local ${num(p.ipHome, 1)}`);
    lines.push(`  WHIP contextual ${num(p.contextWhip)} · IP contextual ${num(p.contextIp, 1)} · splitEdge ${num(p.splitEdge)} · games split ${p.splitGames || 0}`);
  }
  if (pa.home) {
    const p = pa.home;
    lines.push(`Pitcher LOC ${g.home?.abr} (${g.home?.pitcherLast || 'TBD'}):`);
    lines.push(`  WHIP ${num(p.whip)} · K/BB ${num(p.kbb)} · IP prom ${num(p.ipAvg, 1)} · IP local ${num(p.ipHome, 1)} · IP visitante ${num(p.ipAway, 1)}`);
    lines.push(`  WHIP contextual ${num(p.contextWhip)} · IP contextual ${num(p.contextIp, 1)} · splitEdge ${num(p.splitEdge)} · games split ${p.splitGames || 0}`);
  }

  /* Offense */
  const oa = g.offense || {};
  const fmtOff = (tag, abr, o) => {
    if (!o) return;
    lines.push(`Ofensiva ${tag} ${abr}:`);
    lines.push(`  R/G 25+26 ${num(o.rpg2526, 1)} · R/G casa ${num(o.rpg2526Home, 1)} · R/G visita ${num(o.rpg2526Away, 1)}`);
    lines.push(`  L10 K/G ${num(o.kpgL10, 1)} · H/G ${num(o.hpgL10, 1)} · hotRate ${pct(o.hotRate)} · coldRate ${pct(o.coldRate)}`);
    lines.push(`  Hitters con hit/G ${num(o.hotHitters, 1)} · sin hit/G ${num(o.coldHitters, 1)}`);
    lines.push(`  AVG 2025 ${num(o.avg2025, 3)} · R/G vs LHP ${num(o.rpgVsL, 1)} · R/G vs RHP ${num(o.rpgVsR, 1)}`);
  };
  fmtOff('VIS', g.away?.abr, oa.away);
  fmtOff('LOC', g.home?.abr, oa.home);

  /* Bullpen */
  const ba = g.bullpen || {};
  const fmtBp = (abr, b) => {
    if (!b || !(Number(b.whip) > 0)) return;
    lines.push(`Bullpen ${abr}: ERA ${num(b.era)} · WHIP ${num(b.whip)} · K/9 ${num(b.k9, 1)} · IP/G ${num(b.ippg, 1)}`);
  };
  fmtBp(g.away?.abr, ba.away);
  fmtBp(g.home?.abr, ba.home);

  /* Odds & market movement */
  const od = g.odds || {};
  const mk = g.market || {};
  lines.push(`Momios: ML ${g.away?.abr} ${od.mlAway ?? '–'} · ML ${g.home?.abr} ${od.mlHome ?? '–'} · O/U ${od.total ?? '–'}`);
  if (od.novig?.away != null) {
    lines.push(`Prob sin vig: ${g.away?.abr} ${pct(od.novig.away)} · ${g.home?.abr} ${pct(od.novig.home)}`);
  }
  if (mk.move) {
    lines.push(`Apertura: ML ${g.away?.abr} ${mk.mlOpen?.away ?? '–'} · ${g.home?.abr} ${mk.mlOpen?.home ?? '–'} · O/U ${mk.ouOpen ?? '–'}`);
    lines.push(`Movimiento: ML ${g.away?.abr} ${mk.move?.mlAway ?? 0} · ${g.home?.abr} ${mk.move?.mlHome ?? 0} · Total ${mk.move?.total ?? 0}`);
  }

  /* Venue & weather */
  const vn = g.venue || {};
  const wd = g.weather || {};
  lines.push(`Venue: ${vn.name || '?'} · PF ${num(vn.parkFactor)} · ${wd.tempF ?? '–'}°F · indoor ${wd.indoor ? 'sí' : 'no'} · viento ${wd.windMph ?? '–'} mph`);

  /* Lineup */
  const lu = g.lineup || {};
  const fmtLu = (tag, abr, l) => {
    if (!l) return;
    if (l.confirmed) {
      lines.push(`Lineup ${tag} ${abr}: ✅ CONFIRMADO (${l.hitters} bateadores)${l.names?.length ? ' → ' + l.names.join(', ') : ''}`);
    } else {
      lines.push(`Lineup ${tag} ${abr}: ⏳ PENDIENTE`);
    }
  };
  fmtLu('VIS', g.away?.abr, lu.away);
  fmtLu('LOC', g.home?.abr, lu.home);

  /* Rest days */
  const rd = g.restDays || {};
  const fmtRd = (abr, days) => {
    if (days == null) return;
    const note = days <= 3 ? ' (DESCANSO CORTO)' : days >= 6 ? ' (ÓXIDO RISK)' : '';
    lines.push(`Descanso ${abr}: ${days} días${note}`);
  };
  fmtRd(g.away?.abr, rd.away);
  fmtRd(g.home?.abr, rd.home);

  /* Wind */
  const wi = g.wind || {};
  if (wi.mph && wi.mph >= 5 && !wd.indoor) {
    lines.push(`Viento: ${wi.mph} mph ${wi.direction || 'cross'}`);
  }

  /* Umpire */
  const ump = g.umpire || {};
  if (ump.name) {
    const kz = ump.kZone || 1.0;
    const zoneLabel = kz >= 1.04 ? 'ZONA AMPLIA (+K)' : kz <= 0.96 ? 'ZONA ESTRECHA (-K)' : 'zona normal';
    lines.push(`Umpire HP: ${ump.name} → ${zoneLabel} (factor K: ${kz.toFixed(2)})`);
  }

  return lines.join('\n');
}

/* ── System prompt ───────────────────────────────────────── */
const SYSTEM_PROMPT = `Eres un analista experto de apuestas MLB. Recibes datos REALES y detallados de cada juego del día. Tu trabajo es encontrar VALUE: diferencias entre la probabilidad real implícita en los datos y lo que dicen las líneas del sportsbook.

DATOS QUE RECIBES POR JUEGO (todos son calculados sobre datos reales de ESPN):
• Pitcher abridor (L10 starts): WHIP, K/BB, IP promedio, IP split home/away, WHIP contextual del split del día, IP contextual, splitEdge (ventaja cuantificada del split), games_split (muestra del split)
• Ofensiva (L10 + temporada 2025+2026): R/G combinado, R/G en casa y visita, K/G (ponches recibidos), H/G (hits), hotRate (bateadores activos con hit), AVG 2025, R/G vs LHP y vs RHP
• Bullpen (L10 juegos): ERA, WHIP, K/9, IP por juego
• Momios: ML open/close, O/U open/close, movimiento de línea, probabilidad implícita sin vig
• Venue: park factor (>1.0 favorece ofensiva, <1.0 favorece pitcheo), temperatura, indoor, viento
• Lineup: CONFIRMADO (con nombres de bateadores) o PENDIENTE. Si está pendiente, reduce tu confianza a "medium" como máximo.
• Descanso del pitcher: días desde su última apertura. 4-5 días = normal. ≤3 días = descanso corto (menos IP esperado, más riesgo). ≥6 días = posible óxido (menos K esperado en primeras entradas).
• Viento: dirección "out" = más jonrones, favorece Over. "in" = menos vuelo de pelota, favorece Under. Solo relevante en estadios outdoor con viento ≥8 mph.
• Umpire HP: nombre del umpire de home plate con su factor K (>1.0 = zona amplia = más strikeouts, <1.0 = zona estrecha = menos strikeouts). Ajusta tus expectativas de K del pitcher según este factor.

═══ REGLAS DE ANÁLISIS ═══

1. ML (moneyline):
   - Compara WHIP contextual + K/BB + splitEdge de cada pitcher.
   - Si el pitcher con mejor perfil tiene momio positivo (dog), hay value.
   - Si ambos pitchers son similares (splitEdge < 0.5), NO sugieras ML.
   - Bullpen importa: abridor dominante + bullpen ERA > 4.50 pierde value en ML.
   - El split R/G del equipo (casa para local, visita para visitante) pesa más que el R/G general.
   - Movimiento de ML > 10 puntos = dinero inteligente. Considéralo.

2. TOTAL (Over/Under):
   - Señal = (R promedio permitidas por pitcher away + R prom pitcher home) + (R/G ofensivo equipo away como visitante + R/G equipo home como local) / 2
   - Ajustar: park factor × señal. Temp > 85°F → +0.5 runs. Temp < 55°F → −0.5 runs.
   - Bullpen WHIP > 1.40 → sube señal +0.35. WHIP < 1.20 → baja −0.35.
   - Solo sugiere si la diferencia entre señal y línea es > 0.5 runs.
   - Movimiento de O/U > 0.5 = señal fuerte del mercado.

3. K (strikeouts del pitcher):
   - Base = K promedio del pitcher en L10 (está implícito en sus gamelogs procesados).
   - Factor rival = K/G L10 del equipo que batea + hotRate bajo (equipo frío = más K).
   - K/G rival > 9.0 con hotRate < 45% = target premium para K Over.
   - K/G rival < 7.5 con hotRate > 55% = peligro, considerar K Under o no apostar.
   - splitEdge del pitcher en K/9 vs zurdo/derecho importa.

4. IP (innings pitched):
   - IP contextual ≥ 6.0 + ofensiva rival R/G < 4.5 → IP Over.
   - IP contextual ≤ 5.0 + ofensiva rival R/G > 5.0 → IP Under.
   - Si el pitcher permite R promedio > 3.5 → reduce confianza en IP Over.

═══ REGLAS DE CONFIANZA ═══
• "strong": 3+ señales alineadas sin contradicción (pitcher dominante + rival débil + bullpen favorable + momio con value + movimiento a favor).
• "medium": señales positivas pero con algún factor en contra, o muestra pequeña (games_split < 3).
• NO generes pick si las señales chocan fuertemente. Calidad > cantidad. Máximo 3 picks por juego.

Devuelve SOLO JSON sin texto adicional:
{
  "picks": [
    {
      "gameId": "string",
      "topPicks": [
        {
          "market": "ML"|"TOTAL"|"K"|"IP",
          "sideTeam": "ABR del equipo (solo para ML)",
          "side": "Over"|"Under" (para TOTAL, K, IP),
          "line": number (para TOTAL, K, IP),
          "target": "away"|"home" (para K e IP: indica de qué pitcher),
          "confidence": "strong"|"medium",
          "reason": "Razón breve y concreta usando datos del input"
        }
      ]
    }
  ]
}`;

/* ── Handler ─────────────────────────────────────────────── */
export default async function handler(req) {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  let body;
  try { body = await req.json(); } catch (_) { return new Response('Bad Request', { status: 400 }); }

  const games = Array.isArray(body?.games) ? body.games : [];
  if (!games.length) {
    return new Response(JSON.stringify({ picks: [] }), { headers: { 'Content-Type': 'application/json' } });
  }

  // Opción para usar el sistema mejorado (enhanced)
  const useEnhanced = body?.enhanced === true;
  
  if (useEnhanced) {
    // Redirigir al endpoint mejorado
    try {
      const enhancedResponse = await fetch(new URL('/api/ai-picks-enhanced', req.url).href, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      if (enhancedResponse.ok) {
        const enhancedData = await enhancedResponse.json();
        return new Response(JSON.stringify(enhancedData), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
    } catch (error) {
      // Si falla el enhanced, continuar con el sistema original
      console.error('Enhanced picks failed, falling back to original:', error);
    }
  }

  const gamesText = games.map(formatGame).join('\n\n');
  const userMsg = `Fecha: ${body?.date || 'hoy'}\nJuegos: ${games.length}\n\n${gamesText}`;

  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMsg }
      ],
      temperature: 0.15,
      response_format: { type: 'json_object' }
    })
  });

  if (!r.ok) {
    return new Response(JSON.stringify({ picks: [], enhanced: false }), { 
      status: 200, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }

  const data = await r.json();
  const content = data?.choices?.[0]?.message?.content || '{"picks":[]}';
  const picks = JSON.parse(content);
  picks.enhanced = false;
  
  return new Response(JSON.stringify(picks), { 
    headers: { 'Content-Type': 'application/json' } 
  });
}
