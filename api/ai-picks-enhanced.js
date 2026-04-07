/* ══════════════════════════════════════════════════════════
   FASE 1: Sistema mejorado de picks con IA
   - Datos H2H (head-to-head)
   - Sistema de confianza probabilística
   - Filtros de exclusión estrictos
   - Backtesting básico
   ══════════════════════════════════════════════════════════ */

/* ── Formatting helpers ──────────────────────────────────── */
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

/* ── Fetch H2H data ──────────────────────────────────────── */
async function fetchH2HData(awayTeamId, homeTeamId) {
  try {
    // ESPN no tiene endpoint directo de H2H, pero podemos simular con últimos juegos
    // En producción, esto vendría de tu base de datos histórica
    const response = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/teams/${awayTeamId}/schedule`
    );
    if (!response.ok) return null;
    
    const data = await response.json();
    const events = data?.events || [];
    
    // Filtrar juegos contra el equipo rival
    const h2hGames = events.filter(ev => {
      const comp = ev?.competitions?.[0];
      const comps = comp?.competitors || [];
      return comps.some(c => String(c?.team?.id) === String(homeTeamId));
    }).slice(0, 5); // Últimos 5 juegos H2H
    
    if (h2hGames.length === 0) return null;
    
    let awayWins = 0;
    let homeWins = 0;
    let totalAwayRuns = 0;
    let totalHomeRuns = 0;
    
    for (const game of h2hGames) {
      const comp = game?.competitions?.[0];
      if (comp?.status?.type?.completed) {
        const comps = comp.competitors || [];
        const away = comps.find(c => String(c?.team?.id) === String(awayTeamId));
        const home = comps.find(c => String(c?.team?.id) === String(homeTeamId));
        
        if (away && home) {
          const awayScore = safeNum(away.score);
          const homeScore = safeNum(home.score);
          totalAwayRuns += awayScore;
          totalHomeRuns += homeScore;
          
          if (awayScore > homeScore) awayWins++;
          else if (homeScore > awayScore) homeWins++;
        }
      }
    }
    
    const gamesCount = h2hGames.length;
    return {
      gamesPlayed: gamesCount,
      awayWins,
      homeWins,
      awayRunsAvg: gamesCount > 0 ? (totalAwayRuns / gamesCount).toFixed(1) : '0.0',
      homeRunsAvg: gamesCount > 0 ? (totalHomeRuns / gamesCount).toFixed(1) : '0.0'
    };
  } catch (error) {
    return null;
  }
}

/* ── Calculate probability and edge ──────────────────────── */
function calculatePickProbability(pick, gameData) {
  // Sistema de scoring basado en múltiples factores
  let baseProb = 0.50; // 50% base
  let confidence = 0;
  
  const factors = {
    pitcher: 0,
    offense: 0,
    bullpen: 0,
    venue: 0,
    market: 0,
    h2h: 0
  };
  
  // Analizar según el tipo de mercado
  if (pick.market === 'ML') {
    // Moneyline analysis
    const team = pick.sideTeam === gameData.away?.abr ? gameData.away : gameData.home;
    const opponent = pick.sideTeam === gameData.away?.abr ? gameData.home : gameData.away;
    
    // Factor pitcher (si hay datos)
    if (gameData.pitchers) {
      const pitcher = pick.sideTeam === gameData.away?.abr ? gameData.pitchers.away : gameData.pitchers.home;
      const oppPitcher = pick.sideTeam === gameData.away?.abr ? gameData.pitchers.home : gameData.pitchers.away;
      
      if (pitcher && oppPitcher) {
        const whipDiff = safeNum(oppPitcher.whip) - safeNum(pitcher.whip);
        const kbbDiff = safeNum(pitcher.kbb) - safeNum(oppPitcher.kbb);
        factors.pitcher = (whipDiff * 0.15 + kbbDiff * 0.05);
      }
    }
    
    // Factor ofensivo
    if (gameData.offense) {
      const offense = pick.sideTeam === gameData.away?.abr ? gameData.offense.away : gameData.offense.home;
      const oppOffense = pick.sideTeam === gameData.away?.abr ? gameData.offense.home : gameData.offense.away;
      
      if (offense && oppOffense) {
        const rpgDiff = safeNum(offense.rpg2526) - safeNum(oppOffense.rpg2526);
        factors.offense = rpgDiff * 0.02;
      }
    }
    
    // Factor H2H
    if (gameData.h2h && gameData.h2h.gamesPlayed >= 3) {
      const h2hWinRate = pick.sideTeam === gameData.away?.abr 
        ? gameData.h2h.awayWins / gameData.h2h.gamesPlayed
        : gameData.h2h.homeWins / gameData.h2h.gamesPlayed;
      factors.h2h = (h2hWinRate - 0.5) * 0.15;
    }
    
  } else if (pick.market === 'TOTAL') {
    // Total runs analysis
    if (gameData.offense) {
      const awayRpg = safeNum(gameData.offense.away?.rpg2526);
      const homeRpg = safeNum(gameData.offense.home?.rpg2526);
      const projectedTotal = (awayRpg + homeRpg) * safeNum(gameData.venue?.parkFactor || 1.0);
      
      const lineDiff = projectedTotal - safeNum(pick.line);
      if ((pick.side === 'Over' && lineDiff > 0) || (pick.side === 'Under' && lineDiff < 0)) {
        factors.offense = Math.abs(lineDiff) * 0.03;
      }
    }
    
  } else if (pick.market === 'K') {
    // Strikeouts analysis
    const pitcher = pick.target === 'away' ? gameData.pitchers?.away : gameData.pitchers?.home;
    const oppOffense = pick.target === 'away' ? gameData.offense?.home : gameData.offense?.away;
    
    if (pitcher && oppOffense) {
      const oppKpg = safeNum(oppOffense.kpgL10);
      if (pick.side === 'Over' && oppKpg > 8.5) {
        factors.pitcher = 0.08;
      } else if (pick.side === 'Under' && oppKpg < 7.5) {
        factors.pitcher = 0.08;
      }
    }
  }
  
  // Factor de movimiento de mercado
  if (gameData.market?.move) {
    const mlMove = pick.sideTeam === gameData.away?.abr 
      ? Math.abs(safeNum(gameData.market.move.mlAway))
      : Math.abs(safeNum(gameData.market.move.mlHome));
    
    if (mlMove > 10) {
      factors.market = 0.05;
    }
  }
  
  // Calcular probabilidad final
  const totalAdjustment = Object.values(factors).reduce((sum, val) => sum + val, 0);
  baseProb = Math.max(0.35, Math.min(0.75, baseProb + totalAdjustment));
  
  // Calcular confianza en cada factor (0-1)
  confidence = Object.values(factors).filter(v => Math.abs(v) > 0.02).length / 6;
  
  // Calcular edge sobre la línea
  const impliedProb = gameData.odds?.novig?.[pick.sideTeam === gameData.away?.abr ? 'away' : 'home'] || 0.5;
  const edge = baseProb - impliedProb;
  
  return {
    probability: Number(baseProb.toFixed(3)),
    edge: Number(edge.toFixed(3)),
    confidence: Number(confidence.toFixed(2)),
    factors: {
      pitcher: Number(Math.max(0, Math.min(1, 0.5 + factors.pitcher * 2)).toFixed(2)),
      offense: Number(Math.max(0, Math.min(1, 0.5 + factors.offense * 2)).toFixed(2)),
      bullpen: Number(Math.max(0, Math.min(1, 0.5 + factors.bullpen * 2)).toFixed(2)),
      venue: Number(Math.max(0, Math.min(1, 0.5 + factors.venue * 2)).toFixed(2)),
      market: Number(Math.max(0, Math.min(1, 0.5 + factors.market * 2)).toFixed(2)),
      h2h: Number(Math.max(0, Math.min(1, 0.5 + factors.h2h * 2)).toFixed(2))
    }
  };
}

/* ── Filtros de exclusión estrictos ──────────────────────── */
function shouldExcludePick(pick, gameData, analytics) {
  const exclusions = [];
  
  // 1. Edge mínimo requerido
  if (analytics.edge < 0.05) {
    exclusions.push('Edge insuficiente (<5%)');
  }
  
  // 2. Probabilidad muy baja
  if (analytics.probability < 0.52) {
    exclusions.push('Probabilidad muy baja (<52%)');
  }
  
  // 3. Lineup no confirmado para picks "strong"
  if (pick.confidence === 'strong') {
    const lineup = pick.sideTeam === gameData.away?.abr ? gameData.lineup?.away : gameData.lineup?.home;
    if (lineup && !lineup.confirmed) {
      exclusions.push('Lineup no confirmado para pick strong');
    }
  }
  
  // 4. Muestra pequeña del pitcher
  if (pick.market === 'K' || pick.market === 'IP') {
    const pitcher = pick.target === 'away' ? gameData.pitchers?.away : gameData.pitchers?.home;
    if (pitcher && safeNum(pitcher.splitGames) < 3) {
      exclusions.push('Muestra del pitcher muy pequeña (<3 juegos)');
    }
  }
  
  // 5. Conflicto entre factores principales
  const factors = analytics.factors;
  const highFactors = Object.values(factors).filter(v => v > 0.65).length;
  const lowFactors = Object.values(factors).filter(v => v < 0.35).length;
  
  if (highFactors >= 2 && lowFactors >= 2) {
    exclusions.push('Conflicto entre factores principales');
  }
  
  // 6. Movimiento de línea en dirección opuesta
  if (gameData.market?.move && pick.market === 'ML') {
    const mlMove = pick.sideTeam === gameData.away?.abr 
      ? safeNum(gameData.market.move.mlAway)
      : safeNum(gameData.market.move.mlHome);
    
    // Si el movimiento es negativo (línea empeoró) y es significativo
    if (mlMove < -15) {
      exclusions.push('Movimiento de línea en contra (>15 puntos)');
    }
  }
  
  // 7. Clima extremo sin datos históricos
  if (gameData.weather) {
    const temp = safeNum(gameData.weather.tempF);
    const wind = safeNum(gameData.weather.windMph);
    
    if ((temp > 95 || temp < 45) && !gameData.weather.indoor) {
      exclusions.push('Clima extremo sin ajuste histórico');
    }
    
    if (wind > 20 && !gameData.weather.indoor) {
      exclusions.push('Viento extremo (>20 mph)');
    }
  }
  
  return {
    excluded: exclusions.length > 0,
    reasons: exclusions
  };
}

/* ── Build human-readable game block for prompt ─────────── */
function formatGame(g) {
  const lines = [];
  lines.push(`══ ${g.away?.abr || '?'} @ ${g.home?.abr || '?'}  (gameId: ${g.gameId || ''}) ══`);

  /* H2H Data */
  if (g.h2h && g.h2h.gamesPlayed > 0) {
    lines.push(`H2H últimos ${g.h2h.gamesPlayed} juegos: ${g.away?.abr} ${g.h2h.awayWins}-${g.h2h.homeWins} ${g.home?.abr}`);
    lines.push(`H2H runs promedio: ${g.away?.abr} ${g.h2h.awayRunsAvg} · ${g.home?.abr} ${g.h2h.homeRunsAvg}`);
  } else {
    lines.push(`H2H: Sin datos recientes entre estos equipos`);
  }

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

/* ── Enhanced System prompt with stricter rules ──────────── */
const SYSTEM_PROMPT = `Eres un analista experto de apuestas MLB con enfoque en VALUE BETTING y APRENDIZAJE CONTINUO. Recibes datos REALES y detallados de cada juego, además de tu HISTORIAL DE RENDIMIENTO para aprender de picks pasados.

IMPORTANTE: Si recibes un bloque "APRENDIZAJE DE PICKS HISTÓRICOS", úsalo para:
1. PRIORIZAR mercados y patrones con mejor win rate histórico
2. EVITAR patrones que han fallado consistentemente
3. APRENDER de picks exitosos recientes (qué factores tenían en común)
4. APRENDER de picks fallidos recientes (qué señales ignoraste)
5. SER MÁS SELECTIVO con mercados que tienen <50% win rate histórico

DATOS QUE RECIBES POR JUEGO:
• H2H (head-to-head): Historial directo entre equipos (últimos 5 juegos), récord y runs promedio
• Pitcher abridor (L10 starts): WHIP, K/BB, IP promedio, splits home/away, métricas contextuales
• Ofensiva (L10 + temporada): R/G, K/G, H/G, hotRate, splits vs LHP/RHP
• Bullpen (L10): ERA, WHIP, K/9, IP/G
• Momios: ML open/close, O/U, movimiento de línea, probabilidad sin vig
• Venue: park factor, temperatura, viento
• Lineup: confirmado o pendiente
• Descanso del pitcher, umpire con factor K

═══ REGLAS DE ANÁLISIS MEJORADAS ═══

1. ML (moneyline):
   - PRIORIDAD: H2H reciente. Si un equipo domina 4-1 o mejor en L5 H2H → señal fuerte
   - Compara WHIP contextual + K/BB + splitEdge de pitchers
   - Si pitcher superior tiene momio positivo (underdog) → value potencial
   - Bullpen crítico: abridor elite + bullpen ERA > 4.50 = riesgo alto
   - Movimiento ML > 15 puntos = dinero sharp, considéralo seriamente
   - NO sugieras si splitEdge < 0.5 Y H2H está parejo

2. TOTAL (Over/Under):
   - Base = (R/G away visitante + R/G home local) × park factor
   - H2H: Si promedio de runs en H2H difiere >1.5 de la línea → señal
   - Ajustes: temp >85°F +0.5, <55°F -0.5, viento out >10mph +0.5
   - Bullpen WHIP >1.40 ambos equipos → Over. <1.20 ambos → Under
   - MÍNIMO: diferencia señal vs línea > 0.7 runs
   - Movimiento O/U > 0.5 = sharp money

3. K (strikeouts):
   - Base = K promedio pitcher L10
   - K/G rival >9.0 + hotRate <45% = target premium K Over
   - K/G rival <7.5 + hotRate >55% = peligro K Over, considerar Under
   - Umpire kZone >1.04 = +0.5 K esperados. <0.96 = -0.5 K
   - splitEdge en K/9 vs zurdo/derecho importa
   - MÍNIMO: 3+ juegos de muestra del pitcher

4. IP (innings pitched):
   - IP contextual ≥6.0 + rival R/G <4.5 → IP Over
   - IP contextual ≤5.0 + rival R/G >5.0 → IP Under
   - Descanso corto (≤3 días) → reduce IP esperado en 0.5-1.0
   - Si pitcher permite >3.5 R/G → no sugieras IP Over

═══ REGLAS DE CONFIANZA ESTRICTAS ═══
• "strong": 4+ señales alineadas + edge >8% + H2H favorable + sin conflictos
• "medium": 2-3 señales positivas + edge >5% + máximo 1 factor en contra
• NO generes pick si:
  - Edge calculado < 5%
  - Señales contradictorias (ej: pitcher dominante pero bullpen terrible + rival hot)
  - Muestra muy pequeña (pitcher <3 juegos, H2H <2 juegos)
  - Lineup no confirmado para picks "strong"
  - Movimiento de línea >15 puntos en tu contra

MÁXIMO 2 picks por juego. Calidad absoluta > cantidad.

Devuelve SOLO JSON:
{
  "picks": [
    {
      "gameId": "string",
      "topPicks": [
        {
          "market": "ML"|"TOTAL"|"K"|"IP",
          "sideTeam": "ABR del equipo (solo para ML)",
          "side": "Over"|"Under" (para TOTAL, K, IP)",
          "line": number (para TOTAL, K, IP),
          "target": "away"|"home" (para K e IP)",
          "confidence": "strong"|"medium",
          "reason": "Razón concreta con datos específicos del input, menciona H2H si aplica"
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

  // Obtener contexto de aprendizaje de picks históricos
  let learningContext = '';
  try {
    const { generateLearningContext } = await import('./ai-learning.js');
    const learning = await generateLearningContext(30); // Últimos 30 días
    if (learning.hasData) {
      learningContext = learning.context;
    }
  } catch (error) {
    console.warn('No se pudo cargar contexto de aprendizaje:', error.message);
  }

  // Enriquecer juegos con datos H2H
  const enrichedGames = await Promise.all(
    games.map(async (game) => {
      const h2h = await fetchH2HData(game.away?.id, game.home?.id);
      return { ...game, h2h };
    })
  );

  const gamesText = enrichedGames.map(formatGame).join('\n\n');
  const userMsg = `Fecha: ${body?.date || 'hoy'}\nJuegos: ${enrichedGames.length}\n\n${learningContext}\n${gamesText}`;

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
      temperature: 0.12, // Más bajo para mayor consistencia
      response_format: { type: 'json_object' }
    })
  });

  if (!r.ok) {
    return new Response(JSON.stringify({ picks: [], enhanced: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const data = await r.json();
  const content = data?.choices?.[0]?.message?.content || '{"picks":[]}';
  const aiPicks = JSON.parse(content);

  // Aplicar filtros de exclusión y agregar analytics
  const filteredPicks = {
    picks: [],
    excluded: [],
    enhanced: true,
    metadata: {
      totalGenerated: 0,
      totalExcluded: 0,
      totalPassed: 0
    }
  };

  for (const gamePick of (aiPicks.picks || [])) {
    const gameData = enrichedGames.find(g => g.gameId === gamePick.gameId);
    if (!gameData) continue;

    const passedPicks = [];
    const excludedPicks = [];

    for (const pick of (gamePick.topPicks || [])) {
      filteredPicks.metadata.totalGenerated++;

      // Calcular analytics
      const analytics = calculatePickProbability(pick, gameData);
      
      // Aplicar filtros de exclusión
      const exclusion = shouldExcludePick(pick, gameData, analytics);

      if (exclusion.excluded) {
        excludedPicks.push({
          ...pick,
          analytics,
          exclusionReasons: exclusion.reasons
        });
        filteredPicks.metadata.totalExcluded++;
      } else {
        passedPicks.push({
          ...pick,
          analytics
        });
        filteredPicks.metadata.totalPassed++;
      }
    }

    if (passedPicks.length > 0) {
      filteredPicks.picks.push({
        gameId: gamePick.gameId,
        topPicks: passedPicks
      });
    }

    if (excludedPicks.length > 0) {
      filteredPicks.excluded.push({
        gameId: gamePick.gameId,
        excludedPicks
      });
    }
  }

  return new Response(JSON.stringify(filteredPicks), {
    headers: { 'Content-Type': 'application/json' }
  });
}
