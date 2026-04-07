/* ── Helpers ──────────────────────────────────────────────── */
async function fetchJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
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

function num(v, d = 2) {
  const x = Number(v);
  return Number.isFinite(x) ? x.toFixed(d) : '–';
}
function pct(v) {
  const x = Number(v);
  return Number.isFinite(x) ? `${(x * 100).toFixed(0)}%` : '–';
}
function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/* ── Park Factors (all 30 MLB venues) ────────────────────── */
const PARK_FACTORS = {
  'Coors Field': 1.15,
  'Fenway Park': 1.08,
  'Great American Ball Park': 1.10,
  'Wrigley Field': 1.04,
  'Yankee Stadium': 1.05,
  'Globe Life Field': 1.04,
  'Dodger Stadium': 1.02,
  'Chase Field': 1.05,
  'Petco Park': 0.97,
  'Oracle Park': 0.96,
  'T-Mobile Park': 0.95,
  'Citizens Bank Park': 1.07,
  'Guaranteed Rate Field': 1.06,
  'Rogers Centre': 1.03,
  'Kauffman Stadium': 1.02,
  'Camden Yards': 1.04,
  'Oriole Park': 1.04,
  'Truist Park': 1.02,
  'Minute Maid Park': 1.03,
  'American Family Field': 1.03,
  'Busch Stadium': 0.98,
  'Target Field': 1.01,
  'Tropicana Field': 0.96,
  'Comerica Park': 0.97,
  'PNC Park': 0.98,
  'loanDepot park': 0.97,
  'Angel Stadium': 1.01,
  'Oakland Coliseum': 0.96,
  'Nationals Park': 1.01,
  'Citi Field': 0.99
};

function getParkFactor(name) {
  for (const [k, v] of Object.entries(PARK_FACTORS)) {
    if ((name || '').includes(k)) return v;
  }
  return 1.0;
}

/* ── Fetch team batting stats from ESPN ──────────────────── */
async function fetchTeamBattingStats(teamId, season) {
  try {
    const data = await fetchJson(
      `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/teams/${teamId}/statistics?season=${season}`
    );
    const batting = (data?.splits?.categories || []).find(c => c.name === 'batting');
    const stats = batting?.stats || [];
    const get = (name) => {
      const s = stats.find(x => x.name === name);
      return s ? safeNum(s.value) : 0;
    };
    const getDisplay = (name) => {
      const s = stats.find(x => x.name === name);
      return s?.displayValue || '';
    };
    const gp = get('teamGamesPlayed') || get('gamesPlayed') || 1;
    const runs = get('runs');
    const ks = get('strikeouts');
    const hits = get('hits');
    const pa = get('plateAppearances') || 1;
    return {
      avg: getDisplay('avg') || num(get('avg'), 3),
      ops: getDisplay('OPS') || num(get('OPS'), 3),
      rpg: (runs / gp).toFixed(1),
      kRate: ((ks / pa) * 100).toFixed(1),
      kpg: (ks / gp).toFixed(1),
      hpg: (hits / gp).toFixed(1),
      gamesPlayed: gp
    };
  } catch (_) {
    return null;
  }
}

/* ── Build enriched game text for AI ─────────────────────── */
function formatGameForAI(g, teamStatsMap) {
  const awayStats = teamStatsMap[g.away.id] || null;
  const homeStats = teamStatsMap[g.home.id] || null;

  const lines = [];
  lines.push(`══ ${g.away.abr} @ ${g.home.abr}  (gameId: ${g.gameId}) ══`);
  lines.push(`Abridores: ${g.away.pitcher} (VIS) vs ${g.home.pitcher} (LOC)`);

  if (awayStats) {
    lines.push(`Bateo ${g.away.abr} ${g.season}: AVG ${awayStats.avg} · OPS ${awayStats.ops} · R/G ${awayStats.rpg} · K% ${awayStats.kRate}% · K/G ${awayStats.kpg} · H/G ${awayStats.hpg} (${awayStats.gamesPlayed} juegos)`);
  }
  if (homeStats) {
    lines.push(`Bateo ${g.home.abr} ${g.season}: AVG ${homeStats.avg} · OPS ${homeStats.ops} · R/G ${homeStats.rpg} · K% ${homeStats.kRate}% · K/G ${homeStats.kpg} · H/G ${homeStats.hpg} (${homeStats.gamesPlayed} juegos)`);
  }

  lines.push(`Momios: ML ${g.away.abr} ${g.odds.mlAway ?? '–'} · ML ${g.home.abr} ${g.odds.mlHome ?? '–'} · O/U ${g.odds.total ?? '–'}`);
  if (g.odds.novig?.away != null) {
    lines.push(`Sin vig: ${g.away.abr} ${pct(g.odds.novig.away)} · ${g.home.abr} ${pct(g.odds.novig.home)}`);
  }
  if (g.odds.mlMove?.away != null || g.odds.ouMove != null) {
    lines.push(`Apertura: ML ${g.away.abr} ${g.odds.mlOpen?.away ?? '–'} · ${g.home.abr} ${g.odds.mlOpen?.home ?? '–'} · O/U ${g.odds.ouOpen ?? '–'}`);
    lines.push(`Movimiento: ML ${g.away.abr} ${g.odds.mlMove?.away ?? 0} · ${g.home.abr} ${g.odds.mlMove?.home ?? 0} · Total ${g.odds.ouMove ?? 0}`);
  }

  lines.push(`${g.venue.name} (PF: ${g.venue.parkFactor}) · ${g.weather.tempF ?? '–'}°F · indoor: ${g.weather.indoor ? 'sí' : 'no'} · viento: ${g.weather.wind || '–'}`);

  return lines.join('\n');
}

/* ── System prompt ───────────────────────────────────────── */
const SYSTEM_PROMPT = `Eres un analista experto de apuestas MLB. Recibes datos REALES de estadísticas de equipo de la temporada actual de ESPN, momios de sportsbook y condiciones de juego.

DATOS QUE RECIBES POR JUEGO:
• Pitchers abridores probables (nombre)
• Estadísticas de bateo de equipo (temporada actual): AVG, OPS, R/G (carreras por juego), K% (tasa de ponches como porcentaje), K/G (ponches recibidos por juego), H/G (hits por juego)
• Momios: ML (moneyline) open y close, O/U (over/under total), probabilidad implícita sin vig
• Movimiento de línea (apertura vs cierre): indica hacia dónde se movió el dinero inteligente (sharp money)
• Venue con park factor: >1.0 favorece ofensiva, <1.0 favorece pitcheo
• Clima: temperatura y viento afectan el scoring

═══ REGLAS DE ANÁLISIS ═══

1. ML (moneyline):
   - Equipo con mejor combinación de OPS + R/G + pitcher nombrado vs stats del rival.
   - Si la probabilidad sin vig difiere mucho de lo que sugieren los stats → hay value.
   - Movimiento de ML fuerte (>10 puntos) confirma o invalida la señal.
   - El nombre del pitcher importa: si reconoces al pitcher como dominante o débil, úsalo.

2. TOTAL (Over/Under):
   - Base = (R/G equipo A + R/G equipo B) × park factor.
   - Ajuste clima: temp > 85°F → +0.5. Temp < 55°F → -0.5.
   - K% altas de ambos equipos → más outs → favorece Under.
   - OPS altos de ambos → favorece Over.
   - Solo sugerir si la diferencia señal vs línea es > 0.5.

3. K (strikeouts de un pitcher):
   - K/G rival alto (>9.0) con K% alta (>23%) = target para K Over del pitcher contrario.
   - K/G rival bajo (<7.5) = cuidado con K Over.
   - El pitcher conocido como ponchador (por su nombre/reputación) ayuda.

4. IP (innings del pitcher):
   - Pitcher reliable vs ofensiva con R/G bajo (<4.0) → IP Over si conoces al pitcher.
   - Ofensiva rival con R/G alto (>5.0) → IP Under.

═══ CONFIANZA ═══
• "strong": múltiples señales alineadas + pitcher elite + momio con value
• "medium": señales positivas pero algún factor contrario
• NO generes pick sin value real. Máximo 3 picks por juego. Calidad > cantidad.

Devuelve SOLO JSON:
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
          "reason": "Razón breve con datos concretos del input"
        }
      ]
    }
  ]
}`;

/* ── Handler ─────────────────────────────────────────────── */
export default async function handler(req) {
  try {
    if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

    let body;
    try { body = await req.json(); } catch { body = {}; }
    const dateKey = (body?.date || '').replace(/-/g, '') || todayStr();
    const season = new Date().getFullYear();

    /* 1. Fetch scoreboard */
    const data = await fetchJson(
      `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates=${dateKey}`
    );
    const events = Array.isArray(data.events) ? data.events : [];

    /* 2. Extract games + collect team IDs */
    const teamIds = new Set();
    const gameInfos = [];

    for (const ev of events) {
      const comp = ev.competitions?.[0] || {};
      const comps = comp.competitors || [];
      const away = comps.find(c => c.homeAway === 'away') || {};
      const home = comps.find(c => c.homeAway === 'home') || {};
      const awayId = String(away?.team?.id || '');
      const homeId = String(home?.team?.id || '');
      if (awayId) teamIds.add(awayId);
      if (homeId) teamIds.add(homeId);

      const odds0 = comp.odds?.[0] || {};
      const mlAway = Number(odds0?.moneyline?.away?.close?.odds ?? odds0?.moneyline?.away?.open?.odds ?? NaN);
      const mlHome = Number(odds0?.moneyline?.home?.close?.odds ?? odds0?.moneyline?.home?.open?.odds ?? NaN);
      const total = Number(odds0?.total?.over?.close?.line ?? odds0?.total?.over?.open?.line ?? NaN);
      const mlAwayOpen = Number(odds0?.moneyline?.away?.open?.odds ?? NaN);
      const mlHomeOpen = Number(odds0?.moneyline?.home?.open?.odds ?? NaN);
      const ouOpen = Number(odds0?.total?.over?.open?.line ?? NaN);

      const awayPitcher = away.probables?.find(p => p.name === 'probableStartingPitcher');
      const homePitcher = home.probables?.find(p => p.name === 'probableStartingPitcher');

      const weather = ev.weather || {};
      const venue = comp.venue || {};
      const parkFactor = getParkFactor(venue.fullName || '');

      gameInfos.push({
        gameId: String(ev.id || comp.id || ''),
        season,
        away: {
          abr: away?.team?.abbreviation || '',
          id: awayId,
          pitcher: awayPitcher?.athlete?.fullName || 'TBD'
        },
        home: {
          abr: home?.team?.abbreviation || '',
          id: homeId,
          pitcher: homePitcher?.athlete?.fullName || 'TBD'
        },
        odds: {
          mlAway: isNaN(mlAway) ? null : mlAway,
          mlHome: isNaN(mlHome) ? null : mlHome,
          total: isNaN(total) ? null : total,
          novig: noVig(mlAway, mlHome),
          mlOpen: {
            away: isNaN(mlAwayOpen) ? null : mlAwayOpen,
            home: isNaN(mlHomeOpen) ? null : mlHomeOpen
          },
          ouOpen: isNaN(ouOpen) ? null : ouOpen,
          mlMove: {
            away: isNaN(mlAway) || isNaN(mlAwayOpen) ? null : mlAway - mlAwayOpen,
            home: isNaN(mlHome) || isNaN(mlHomeOpen) ? null : mlHome - mlHomeOpen
          },
          ouMove: isNaN(total) || isNaN(ouOpen) ? null : total - ouOpen
        },
        weather: {
          tempF: weather.temperature ?? null,
          indoor: !!weather.isIndoor,
          wind: weather.wind || null
        },
        venue: { name: venue.fullName || '', parkFactor: num(parkFactor) }
      });
    }

    /* 3. Fetch team batting stats in parallel (batches of 8) */
    const teamStatsMap = {};
    const teamIdArray = [...teamIds];
    for (let i = 0; i < teamIdArray.length; i += 8) {
      const batch = teamIdArray.slice(i, i + 8);
      const results = await Promise.allSettled(
        batch.map(id => fetchTeamBattingStats(id, season))
      );
      for (let j = 0; j < batch.length; j++) {
        if (results[j].status === 'fulfilled' && results[j].value) {
          teamStatsMap[batch[j]] = results[j].value;
        }
      }
    }

    /* 4. Build enriched prompt text */
    const gamesText = gameInfos.map(g => formatGameForAI(g, teamStatsMap)).join('\n\n');
    const userMsg = `Fecha: ${dateKey}\nJuegos: ${gameInfos.length}\n\n${gamesText}`;

    /* 5. Call OpenAI */
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
      return new Response(JSON.stringify({ picks: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const ai = await r.json();
    const content = ai?.choices?.[0]?.message?.content || '{"picks":[]}';
    return new Response(content, { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ picks: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
