/* ══════════════════════════════════════════════════════════
   FASE 2: Sistema mejorado con Top 5 factores profesionales
   - Momentum del equipo (racha L10)
   - Ventaja de local mejorada
   - Sharp money tracking (RLM)
   - Clima detallado (humedad, hora, viento)
   - Splits avanzados del pitcher
   
   FASE 1: Sistema base
   - Datos H2H (head-to-head)
   - Sistema de confianza probabilística
   - Filtros de exclusión estrictos
   - Backtesting básico
   ══════════════════════════════════════════════════════════ */

/* ── MERCADOS DESHABILITADOS (Win Rate <35%) ─────────────── */
const DISABLED_MARKETS = ['K', 'IP']; // Desactivar hasta mejorar el modelo

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

/* ── Timeout wrapper utility ─────────────────────────────── */
function withTimeout(promise, timeoutMs, fallback = null) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(fallback), timeoutMs))
  ]);
}

/* ── Fetch H2H data with timeout ─────────────────────────── */
async function fetchH2HData(awayTeamId, homeTeamId) {
  try {
    // ESPN no tiene endpoint directo de H2H, pero podemos simular con últimos juegos
    // En producción, esto vendría de tu base de datos histórica
    const response = await withTimeout(
      fetch(`https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/teams/${awayTeamId}/schedule`),
      2000, // 2 second timeout
      null
    );
    
    if (!response || !response.ok) return null;
    
    const data = await withTimeout(response.json(), 1000, null);
    if (!data) return null;
    
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

/* ══════════════════════════════════════════════════════════
   TOP 5 FACTORES PROFESIONALES
   ══════════════════════════════════════════════════════════ */

/* ── 1. MOMENTUM DEL EQUIPO (Racha L10) ──────────────────── */
function getTeamMomentum(teamRecord) {
  // teamRecord puede ser "7-3", "2-8", etc.
  if (!teamRecord || typeof teamRecord !== 'string') {
    return { status: 'NEUTRAL', factor: 1.0, wins: 5 };
  }
  
  const parts = teamRecord.split('-');
  if (parts.length !== 2) {
    return { status: 'NEUTRAL', factor: 1.0, wins: 5 };
  }
  
  const wins = parseInt(parts[0], 10);
  const losses = parseInt(parts[1], 10);
  
  if (!Number.isFinite(wins) || !Number.isFinite(losses)) {
    return { status: 'NEUTRAL', factor: 1.0, wins: 5 };
  }
  
  // Hot team: 7+ wins en L10
  if (wins >= 7) {
    return { status: 'HOT', factor: 1.12, wins };
  }
  
  // Cold team: 3 o menos wins en L10
  if (wins <= 3) {
    return { status: 'COLD', factor: 0.88, wins };
  }
  
  // Warm team: 6 wins
  if (wins === 6) {
    return { status: 'WARM', factor: 1.05, wins };
  }
  
  // Cool team: 4 wins
  if (wins === 4) {
    return { status: 'COOL', factor: 0.95, wins };
  }
  
  return { status: 'NEUTRAL', factor: 1.0, wins };
}

/* ── 2. VENTAJA DE LOCAL MEJORADA ────────────────────────── */
function getHomeFieldAdvantage(venueName, homeTeamAbr) {
  let homeAdvantage = 1.08; // Base: 54% win rate local = 1.08 factor
  
  // Ajuste por estadio específico (ventaja extra)
  const toughVenues = {
    'Coors Field': 1.15,      // Colorado - altitud extrema
    'Fenway Park': 1.12,      // Boston - Green Monster
    'Wrigley Field': 1.10,    // Chicago - viento, historia
    'Oracle Park': 1.09,      // SF - frío, viento, dimensiones
    'Dodger Stadium': 1.09,   // LA - intimidante para visitantes
    'Yankee Stadium': 1.10    // NY - presión, dimensiones
  };
  
  if (venueName && toughVenues[venueName]) {
    homeAdvantage = toughVenues[venueName];
  }
  
  // Equipos con ventaja home especialmente fuerte
  const strongHomeTeams = {
    'COL': 1.18,  // Rockies: dominantes en casa por altitud
    'BOS': 1.12,  // Red Sox: Fenway es único
    'LAD': 1.10,  // Dodgers: excelentes en casa
    'NYY': 1.10   // Yankees: presión del público
  };
  
  if (homeTeamAbr && strongHomeTeams[homeTeamAbr]) {
    homeAdvantage = Math.max(homeAdvantage, strongHomeTeams[homeTeamAbr]);
  }
  
  return homeAdvantage;
}

/* ── 3. SHARP MONEY TRACKING (RLM) ───────────────────────── */
function detectSharpMoney(marketMove, publicPercent) {
  // Reverse Line Movement (RLM): línea se mueve opuesto al público
  // Steam Move: movimiento súbito >15 puntos
  
  if (!marketMove) {
    return { isSharp: false, type: 'NONE', side: null, confidence: 0 };
  }
  
  const mlMoveAway = safeNum(marketMove.mlAway);
  const mlMoveHome = safeNum(marketMove.mlHome);
  const publicOnAway = safeNum(publicPercent?.away || 50);
  
  // RLM Detection
  // Si >65% del público apuesta por away pero línea se mueve a favor de home
  if (publicOnAway > 65 && mlMoveHome > 12) {
    return {
      isSharp: true,
      type: 'RLM',
      side: 'home',
      confidence: 0.85,
      message: `${publicOnAway.toFixed(0)}% público en away pero línea favorece home +${mlMoveHome} = SHARP en home`
    };
  }
  
  // Si <35% del público apuesta por away pero línea se mueve a favor de away
  if (publicOnAway < 35 && mlMoveAway > 12) {
    return {
      isSharp: true,
      type: 'RLM',
      side: 'away',
      confidence: 0.85,
      message: `${publicOnAway.toFixed(0)}% público en away pero línea favorece away +${mlMoveAway} = SHARP en away`
    };
  }
  
  // Steam Move Detection (movimiento >15 puntos)
  if (Math.abs(mlMoveAway) > 15) {
    return {
      isSharp: true,
      type: 'STEAM',
      side: mlMoveAway > 0 ? 'away' : 'home',
      confidence: 0.70,
      message: `Steam move de ${Math.abs(mlMoveAway).toFixed(0)} puntos hacia ${mlMoveAway > 0 ? 'away' : 'home'}`
    };
  }
  
  if (Math.abs(mlMoveHome) > 15) {
    return {
      isSharp: true,
      type: 'STEAM',
      side: mlMoveHome > 0 ? 'home' : 'away',
      confidence: 0.70,
      message: `Steam move de ${Math.abs(mlMoveHome).toFixed(0)} puntos hacia ${mlMoveHome > 0 ? 'home' : 'away'}`
    };
  }
  
  return { isSharp: false, type: 'NONE', side: null, confidence: 0 };
}

/* ── 4. CLIMA DETALLADO ──────────────────────────────────── */
function getWeatherImpact(weather, wind, gameTime) {
  const impact = {
    totalAdjustment: 0,
    hrAdjustment: 0,
    kAdjustment: 0,
    factors: []
  };
  
  if (!weather) return impact;
  
  // Indoor = sin impacto climático
  if (weather.indoor) {
    impact.factors.push('Indoor: sin impacto climático');
    return impact;
  }
  
  const temp = safeNum(weather.tempF);
  const windMph = safeNum(wind?.mph || weather.windMph);
  const windDir = wind?.direction || weather.windDirection || 'cross';
  
  // Temperatura (impacto en vuelo de pelota)
  if (temp > 85) {
    impact.totalAdjustment += 0.6; // Aire caliente = pelota vuela más
    impact.hrAdjustment += 0.4;
    impact.factors.push(`Temp ${temp}°F (calor): +0.6 runs esperadas`);
  } else if (temp < 55) {
    impact.totalAdjustment -= 0.5; // Aire frío = pelota no vuela
    impact.hrAdjustment -= 0.3;
    impact.factors.push(`Temp ${temp}°F (frío): -0.5 runs esperadas`);
  }
  
  // Humedad (si está disponible)
  const humidity = safeNum(weather.humidity);
  if (humidity > 70) {
    impact.totalAdjustment -= 0.3; // Alta humedad = pelota pesada
    impact.hrAdjustment -= 0.25;
    impact.factors.push(`Humedad ${humidity}%: -0.3 runs (pelota pesada)`);
  }
  
  // Hora del juego (día vs noche)
  if (gameTime) {
    try {
      const hour = new Date(gameTime).getHours();
      if (hour >= 13 && hour <= 16) {
        // Juego de día = más runs (sol, calor, cansancio)
        impact.totalAdjustment += 0.4;
        impact.factors.push('Juego de día: +0.4 runs (sol, visibilidad)');
      }
    } catch (e) {
      // Ignorar si gameTime no es válido
    }
  }
  
  // Viento (CRÍTICO para totales)
  if (windMph >= 10) {
    if (windDir === 'out' || windDir === 'Out') {
      // Viento a favor = más HR, más runs
      const windImpact = windMph >= 15 ? 1.0 : 0.6;
      impact.totalAdjustment += windImpact;
      impact.hrAdjustment += windImpact * 0.6;
      impact.factors.push(`Viento ${windMph}mph OUT: +${windImpact.toFixed(1)} runs`);
    } else if (windDir === 'in' || windDir === 'In') {
      // Viento en contra = menos HR, menos runs
      const windImpact = windMph >= 15 ? -0.8 : -0.5;
      impact.totalAdjustment += windImpact;
      impact.hrAdjustment += windImpact * 0.6;
      impact.factors.push(`Viento ${windMph}mph IN: ${windImpact.toFixed(1)} runs`);
    } else if (windMph >= 15) {
      // Viento cruzado fuerte = impredecible, reduce confianza
      impact.kAdjustment -= 0.3; // Más difícil para pitchers
      impact.factors.push(`Viento ${windMph}mph CROSS: -0.3 K esperados`);
    }
  }
  
  return impact;
}

/* ── 5. SPLITS AVANZADOS DEL PITCHER ─────────────────────── */
function getAdvancedPitcherSplits(pitcher, opposingOffense, gameData) {
  const adjustments = {
    kAdjustment: 0,
    ipAdjustment: 0,
    eraAdjustment: 0,
    probabilityMultiplier: 1.0,
    factors: []
  };
  
  if (!pitcher) return adjustments;
  
  // Split home/away (ya lo tienes, pero vamos a usarlo mejor)
  const isHome = gameData.pitchers?.home?.name === pitcher.name;
  const contextWhip = safeNum(pitcher.contextWhip);
  const baseWhip = safeNum(pitcher.whip);
  
  if (contextWhip > 0 && baseWhip > 0) {
    const whipDiff = contextWhip - baseWhip;
    if (Math.abs(whipDiff) > 0.15) {
      // Diferencia significativa en split
      if (whipDiff > 0.15) {
        // Peor en este contexto
        adjustments.eraAdjustment += 0.5;
        adjustments.ipAdjustment -= 0.5;
        adjustments.probabilityMultiplier *= 0.93;
        adjustments.factors.push(`WHIP contextual peor (+${whipDiff.toFixed(2)}): pitcher vulnerable`);
      } else {
        // Mejor en este contexto
        adjustments.eraAdjustment -= 0.3;
        adjustments.ipAdjustment += 0.3;
        adjustments.probabilityMultiplier *= 1.07;
        adjustments.factors.push(`WHIP contextual mejor (${whipDiff.toFixed(2)}): pitcher dominante`);
      }
    }
  }
  
  // Rival ofensivo (vs LHP/RHP si está disponible)
  const pitcherHand = pitcher.hand || 'R'; // Asumir derecho si no hay dato
  const oppRpgVsHand = pitcherHand === 'L' 
    ? safeNum(opposingOffense?.rpgVsL)
    : safeNum(opposingOffense?.rpgVsR);
  
  if (oppRpgVsHand > 0) {
    const oppRpgGeneral = safeNum(opposingOffense?.rpg2526);
    if (oppRpgGeneral > 0) {
      const rpgDiff = oppRpgVsHand - oppRpgGeneral;
      if (Math.abs(rpgDiff) > 0.5) {
        if (rpgDiff > 0.5) {
          // Rival es mejor vs este tipo de pitcher
          adjustments.eraAdjustment += 0.6;
          adjustments.kAdjustment -= 0.5;
          adjustments.probabilityMultiplier *= 0.90;
          adjustments.factors.push(`Rival fuerte vs ${pitcherHand}HP (+${rpgDiff.toFixed(1)} R/G): peligro`);
        } else {
          // Rival es peor vs este tipo de pitcher
          adjustments.eraAdjustment -= 0.4;
          adjustments.kAdjustment += 0.5;
          adjustments.probabilityMultiplier *= 1.10;
          adjustments.factors.push(`Rival débil vs ${pitcherHand}HP (${rpgDiff.toFixed(1)} R/G): ventaja`);
        }
      }
    }
  }
  
  // K/BB ratio (control del pitcher)
  const kbb = safeNum(pitcher.kbb);
  if (kbb > 3.5) {
    // Excelente control
    adjustments.kAdjustment += 0.5;
    adjustments.ipAdjustment += 0.3;
    adjustments.probabilityMultiplier *= 1.05;
    adjustments.factors.push(`K/BB ${kbb.toFixed(2)} (elite): excelente control`);
  } else if (kbb < 2.0) {
    // Mal control
    adjustments.kAdjustment -= 0.5;
    adjustments.ipAdjustment -= 0.5;
    adjustments.probabilityMultiplier *= 0.95;
    adjustments.factors.push(`K/BB ${kbb.toFixed(2)} (bajo): control pobre`);
  }
  
  // Descanso del pitcher
  const restDays = isHome 
    ? safeNum(gameData.restDays?.home)
    : safeNum(gameData.restDays?.away);
  
  if (restDays > 0) {
    if (restDays <= 3) {
      // Descanso corto = menos IP, más riesgo
      adjustments.ipAdjustment -= 0.8;
      adjustments.eraAdjustment += 0.3;
      adjustments.probabilityMultiplier *= 0.92;
      adjustments.factors.push(`Descanso corto (${restDays}d): menos IP esperado`);
    } else if (restDays >= 6) {
      // Descanso largo = óxido, menos K primeras entradas
      adjustments.kAdjustment -= 0.5;
      adjustments.ipAdjustment -= 0.3;
      adjustments.probabilityMultiplier *= 0.94;
      adjustments.factors.push(`Descanso largo (${restDays}d): riesgo de óxido`);
    }
  }
  
  return adjustments;
}

/* ── Calculate probability and edge (CON TOP 5 FACTORES) ─── */
function calculatePickProbability(pick, gameData) {
  // Sistema de scoring basado en múltiples factores + TOP 5
  let baseProb = 0.50; // 50% base
  let confidence = 0;
  
  const factors = {
    pitcher: 0,
    offense: 0,
    bullpen: 0,
    venue: 0,
    market: 0,
    h2h: 0,
    momentum: 0,      // NUEVO
    homeAdvantage: 0, // NUEVO
    sharpMoney: 0,    // NUEVO
    weather: 0,       // NUEVO
    splits: 0         // NUEVO
  };
  
  // Analizar según el tipo de mercado
  if (pick.market === 'ML') {
    // Moneyline analysis
    const team = pick.sideTeam === gameData.away?.abr ? gameData.away : gameData.home;
    const opponent = pick.sideTeam === gameData.away?.abr ? gameData.home : gameData.away;
    const isHome = pick.sideTeam === gameData.home?.abr;
    
    // ═══ TOP 5 FACTORES ═══
    
    // 1. MOMENTUM (racha del equipo)
    const teamMomentum = getTeamMomentum(team?.record?.last10);
    const oppMomentum = getTeamMomentum(opponent?.record?.last10);
    
    if (teamMomentum.status === 'HOT' && oppMomentum.status === 'COLD') {
      factors.momentum = 0.12; // +12% probabilidad
    } else if (teamMomentum.status === 'HOT') {
      factors.momentum = 0.08;
    } else if (teamMomentum.status === 'COLD') {
      factors.momentum = -0.08;
    } else if (teamMomentum.status === 'WARM') {
      factors.momentum = 0.04;
    } else if (teamMomentum.status === 'COOL') {
      factors.momentum = -0.04;
    }
    
    // 2. VENTAJA DE LOCAL (solo si pick es home)
    if (isHome) {
      const homeAdv = getHomeFieldAdvantage(gameData.venue?.name, team?.abr);
      // Convertir factor (1.08-1.18) a ajuste de probabilidad
      factors.homeAdvantage = (homeAdv - 1.0) * 0.8; // 0.08 factor = +6.4% prob
    }
    
    // 3. SHARP MONEY
    const sharpMoney = detectSharpMoney(gameData.market?.move, gameData.market?.publicPercent);
    if (sharpMoney.isSharp) {
      const sharpSide = sharpMoney.side === 'away' ? gameData.away?.abr : gameData.home?.abr;
      if (sharpSide === pick.sideTeam) {
        // Sharp money a nuestro favor
        factors.sharpMoney = 0.08 * sharpMoney.confidence;
      } else {
        // Sharp money en contra (PELIGRO)
        factors.sharpMoney = -0.10 * sharpMoney.confidence;
      }
    }
    
    // 4. CLIMA
    const weatherImpact = getWeatherImpact(gameData.weather, gameData.wind, gameData.evtIso);
    // Para ML, clima afecta menos, pero viento extremo puede favorecer ofensiva
    if (Math.abs(weatherImpact.totalAdjustment) > 0.8) {
      // Clima extremo favorece al equipo con mejor bullpen
      const teamBullpen = isHome ? gameData.bullpen?.home : gameData.bullpen?.away;
      const oppBullpen = isHome ? gameData.bullpen?.away : gameData.bullpen?.home;
      const bullpenDiff = safeNum(oppBullpen?.era) - safeNum(teamBullpen?.era);
      if (bullpenDiff > 0.5) {
        factors.weather = 0.03; // Nuestro bullpen es mejor
      }
    }
    
    // 5. SPLITS AVANZADOS DEL PITCHER
    const teamPitcher = isHome ? gameData.pitchers?.home : gameData.pitchers?.away;
    const oppPitcher = isHome ? gameData.pitchers?.away : gameData.pitchers?.home;
    const teamOffense = isHome ? gameData.offense?.home : gameData.offense?.away;
    const oppOffense = isHome ? gameData.offense?.away : gameData.offense?.home;
    
    if (teamPitcher && oppOffense) {
      const teamSplits = getAdvancedPitcherSplits(teamPitcher, oppOffense, gameData);
      const oppSplits = getAdvancedPitcherSplits(oppPitcher, teamOffense, gameData);
      
      // Comparar splits
      const splitDiff = teamSplits.probabilityMultiplier - oppSplits.probabilityMultiplier;
      factors.splits = splitDiff * 0.15; // Convertir a ajuste de probabilidad
    }
    
    // ═══ FACTORES ORIGINALES ═══
    
    // Factor pitcher (si hay datos)
    if (gameData.pitchers) {
      const pitcher = isHome ? gameData.pitchers.home : gameData.pitchers.away;
      const oppPitcher = isHome ? gameData.pitchers.away : gameData.pitchers.home;
      
      if (pitcher && oppPitcher) {
        const whipDiff = safeNum(oppPitcher.whip) - safeNum(pitcher.whip);
        const kbbDiff = safeNum(pitcher.kbb) - safeNum(oppPitcher.kbb);
        factors.pitcher = (whipDiff * 0.15 + kbbDiff * 0.05);
      }
    }
    
    // Factor ofensivo
    if (gameData.offense) {
      const offense = isHome ? gameData.offense.home : gameData.offense.away;
      const oppOffense = isHome ? gameData.offense.away : gameData.offense.home;
      
      if (offense && oppOffense) {
        const rpgDiff = safeNum(offense.rpg2526) - safeNum(oppOffense.rpg2526);
        factors.offense = rpgDiff * 0.02;
      }
    }
    
    // Factor H2H
    if (gameData.h2h && gameData.h2h.gamesPlayed >= 3) {
      const h2hWinRate = isHome
        ? gameData.h2h.homeWins / gameData.h2h.gamesPlayed
        : gameData.h2h.awayWins / gameData.h2h.gamesPlayed;
      factors.h2h = (h2hWinRate - 0.5) * 0.15;
    }
    
  } else if (pick.market === 'TOTAL') {
    // Total runs analysis
    
    // ═══ TOP 5 FACTORES PARA TOTAL ═══
    
    // 4. CLIMA (CRÍTICO para totales)
    const weatherImpact = getWeatherImpact(gameData.weather, gameData.wind, gameData.evtIso);
    const projectedAdjustment = weatherImpact.totalAdjustment;
    
    // Base projection
    let projectedTotal = 0;
    if (gameData.offense) {
      const awayRpg = safeNum(gameData.offense.away?.rpg2526Away || gameData.offense.away?.rpg2526);
      const homeRpg = safeNum(gameData.offense.home?.rpg2526Home || gameData.offense.home?.rpg2526);
      projectedTotal = (awayRpg + homeRpg) * safeNum(gameData.venue?.parkFactor || 1.0);
      
      // Aplicar ajuste climático
      projectedTotal += projectedAdjustment;
    }
    
    const lineDiff = projectedTotal - safeNum(pick.line);
    
    // Determinar si el clima favorece nuestro pick
    if (pick.side === 'Over' && projectedAdjustment > 0.3) {
      factors.weather = 0.08; // Clima favorece Over
    } else if (pick.side === 'Under' && projectedAdjustment < -0.3) {
      factors.weather = 0.08; // Clima favorece Under
    } else if (pick.side === 'Over' && projectedAdjustment < -0.5) {
      factors.weather = -0.10; // Clima en contra de Over
    } else if (pick.side === 'Under' && projectedAdjustment > 0.5) {
      factors.weather = -0.10; // Clima en contra de Under
    }
    
    // 5. SPLITS AVANZADOS (afectan runs permitidas)
    const awayPitcher = gameData.pitchers?.away;
    const homePitcher = gameData.pitchers?.home;
    const awayOffense = gameData.offense?.away;
    const homeOffense = gameData.offense?.home;
    
    if (awayPitcher && homePitcher && awayOffense && homeOffense) {
      const awaySplits = getAdvancedPitcherSplits(awayPitcher, homeOffense, gameData);
      const homeSplits = getAdvancedPitcherSplits(homePitcher, awayOffense, gameData);
      
      // ERA adjustments afectan total
      const totalEraAdjustment = awaySplits.eraAdjustment + homeSplits.eraAdjustment;
      
      if (pick.side === 'Over' && totalEraAdjustment > 0.8) {
        factors.splits = 0.06; // Pitchers vulnerables = Over
      } else if (pick.side === 'Under' && totalEraAdjustment < -0.8) {
        factors.splits = 0.06; // Pitchers dominantes = Under
      }
    }
    
    // ═══ FACTORES ORIGINALES ═══
    
    if ((pick.side === 'Over' && lineDiff > 0) || (pick.side === 'Under' && lineDiff < 0)) {
      factors.offense = Math.abs(lineDiff) * 0.03;
    }
    
    // Bullpen factor
    if (gameData.bullpen) {
      const avgBullpenWhip = (safeNum(gameData.bullpen.away?.whip) + safeNum(gameData.bullpen.home?.whip)) / 2;
      if (pick.side === 'Over' && avgBullpenWhip > 1.40) {
        factors.bullpen = 0.05;
      } else if (pick.side === 'Under' && avgBullpenWhip < 1.20) {
        factors.bullpen = 0.05;
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
  
  // Factor de movimiento de mercado (mejorado con sharp money)
  if (gameData.market?.move && pick.market === 'ML') {
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
  const activeFactors = Object.values(factors).filter(v => Math.abs(v) > 0.02).length;
  confidence = activeFactors / Object.keys(factors).length;
  
  // Calcular edge sobre la línea
  let impliedProb = 0.5;
  if (pick.market === 'ML' && gameData.odds?.novig) {
    impliedProb = pick.sideTeam === gameData.away?.abr 
      ? gameData.odds.novig.away 
      : gameData.odds.novig.home;
  }
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
      h2h: Number(Math.max(0, Math.min(1, 0.5 + factors.h2h * 2)).toFixed(2)),
      momentum: Number(Math.max(0, Math.min(1, 0.5 + factors.momentum * 2)).toFixed(2)),
      homeAdvantage: Number(Math.max(0, Math.min(1, 0.5 + factors.homeAdvantage * 2)).toFixed(2)),
      sharpMoney: Number(Math.max(0, Math.min(1, 0.5 + factors.sharpMoney * 2)).toFixed(2)),
      weather: Number(Math.max(0, Math.min(1, 0.5 + factors.weather * 2)).toFixed(2)),
      splits: Number(Math.max(0, Math.min(1, 0.5 + factors.splits * 2)).toFixed(2))
    }
  };
}

/* ── Generate detailed explanation for strong picks ─────── */
function generateDetailedExplanation(pick, gameData, analytics) {
  if (pick.confidence !== 'strong') {
    return pick.reason; // Solo picks strong tienen explicación detallada
  }
  
  const explanationParts = [];
  const factors = analytics.factors;
  
  // Encabezado
  explanationParts.push(`🌟 PICK FUERTE - Análisis Detallado:`);
  explanationParts.push('');
  
  // Razón principal de la IA
  explanationParts.push(`📊 Razón Principal: ${pick.reason}`);
  explanationParts.push('');
  
  // Analytics generales
  explanationParts.push(`📈 Métricas:`);
  explanationParts.push(`• Probabilidad: ${(analytics.probability * 100).toFixed(1)}%`);
  explanationParts.push(`• Edge sobre línea: ${(analytics.edge * 100).toFixed(1)}%`);
  explanationParts.push(`• Confianza del modelo: ${(analytics.confidence * 100).toFixed(0)}%`);
  explanationParts.push('');
  
  // Factores clave (Top 5 + originales)
  explanationParts.push(`🔍 Factores Analizados:`);
  
  // Momentum
  if (factors.momentum > 0.60) {
    const team = pick.sideTeam === gameData.away?.abr ? gameData.away : gameData.home;
    const opponent = pick.sideTeam === gameData.away?.abr ? gameData.home : gameData.away;
    const teamMomentum = getTeamMomentum(team?.record?.last10);
    const oppMomentum = getTeamMomentum(opponent?.record?.last10);
    explanationParts.push(`✅ MOMENTUM: ${team?.abr} está ${teamMomentum.status} (${teamMomentum.wins}-${10-teamMomentum.wins} L10) vs ${opponent?.abr} ${oppMomentum.status} (${oppMomentum.wins}-${10-oppMomentum.wins} L10)`);
  } else if (factors.momentum < 0.40) {
    explanationParts.push(`⚠️ Momentum: Factor neutral o negativo`);
  }
  
  // Ventaja de local
  if (factors.homeAdvantage > 0.55 && pick.market === 'ML') {
    const isHome = pick.sideTeam === gameData.home?.abr;
    if (isHome) {
      const homeAdv = getHomeFieldAdvantage(gameData.venue?.name, gameData.home?.abr);
      const homeAdvPct = ((homeAdv - 1.0) * 100).toFixed(0);
      explanationParts.push(`✅ VENTAJA LOCAL: ${gameData.home?.abr} en ${gameData.venue?.name} (+${homeAdvPct}% histórico)`);
    }
  }
  
  // Sharp money
  if (factors.sharpMoney > 0.55) {
    const sharpMoney = detectSharpMoney(gameData.market?.move, gameData.market?.publicPercent);
    if (sharpMoney.isSharp) {
      explanationParts.push(`✅ SHARP MONEY: ${sharpMoney.message}`);
    }
  } else if (factors.sharpMoney < 0.45) {
    explanationParts.push(`⚠️ Sharp Money: Movimiento en contra o neutral`);
  }
  
  // Clima
  if (Math.abs(factors.weather - 0.5) > 0.08) {
    const weatherImpact = getWeatherImpact(gameData.weather, gameData.wind, gameData.evtIso);
    if (weatherImpact.factors.length > 0) {
      explanationParts.push(`${factors.weather > 0.55 ? '✅' : '⚠️'} CLIMA:`);
      weatherImpact.factors.slice(0, 2).forEach(f => {
        explanationParts.push(`  • ${f}`);
      });
    }
  }
  
  // Splits del pitcher
  if (factors.splits > 0.55 || factors.splits < 0.45) {
    const isHome = pick.sideTeam === gameData.home?.abr;
    const pitcher = isHome ? gameData.pitchers?.home : gameData.pitchers?.away;
    const oppOffense = isHome ? gameData.offense?.away : gameData.offense?.home;
    
    if (pitcher && oppOffense) {
      const splits = getAdvancedPitcherSplits(pitcher, oppOffense, gameData);
      if (splits.factors.length > 0) {
        explanationParts.push(`${factors.splits > 0.55 ? '✅' : '⚠️'} SPLITS DEL PITCHER:`);
        splits.factors.slice(0, 2).forEach(f => {
          explanationParts.push(`  • ${f}`);
        });
      }
    }
  }
  
  // Pitcher
  if (factors.pitcher > 0.60) {
    explanationParts.push(`✅ PITCHER: Ventaja significativa en WHIP y K/BB`);
  } else if (factors.pitcher < 0.40) {
    explanationParts.push(`⚠️ Pitcher: En desventaja`);
  }
  
  // Ofensiva
  if (factors.offense > 0.60) {
    explanationParts.push(`✅ OFENSIVA: Ventaja en producción de runs`);
  } else if (factors.offense < 0.40) {
    explanationParts.push(`⚠️ Ofensiva: En desventaja`);
  }
  
  // Bullpen
  if (factors.bullpen > 0.55) {
    explanationParts.push(`✅ BULLPEN: Ventaja en relevistas`);
  } else if (factors.bullpen < 0.45) {
    explanationParts.push(`⚠️ Bullpen: En desventaja`);
  }
  
  // H2H
  if (factors.h2h > 0.60) {
    if (gameData.h2h && gameData.h2h.gamesPlayed >= 3) {
      const isHome = pick.sideTeam === gameData.home?.abr;
      const wins = isHome ? gameData.h2h.homeWins : gameData.h2h.awayWins;
      const losses = gameData.h2h.gamesPlayed - wins;
      explanationParts.push(`✅ HEAD-TO-HEAD: ${pick.sideTeam} domina ${wins}-${losses} en últimos ${gameData.h2h.gamesPlayed} juegos`);
    }
  }
  
  // Venue/Park Factor
  if (pick.market === 'TOTAL' && gameData.venue?.parkFactor) {
    const pf = safeNum(gameData.venue.parkFactor);
    if (pf > 1.05) {
      explanationParts.push(`✅ VENUE: ${gameData.venue.name} favorece ofensiva (PF ${pf.toFixed(2)})`);
    } else if (pf < 0.95) {
      explanationParts.push(`✅ VENUE: ${gameData.venue.name} favorece pitcheo (PF ${pf.toFixed(2)})`);
    }
  }
  
  explanationParts.push('');
  
  // Resumen final
  const activeFactors = Object.entries(factors).filter(([_, v]) => v > 0.55 || v < 0.45).length;
  explanationParts.push(`📌 Resumen: ${activeFactors} factores alineados a favor de este pick.`);
  
  // Advertencias si las hay
  const warnings = [];
  if (!gameData.lineup?.away?.confirmed || !gameData.lineup?.home?.confirmed) {
    warnings.push('Lineup pendiente de confirmar');
  }
  if (gameData.weather && !gameData.weather.indoor) {
    const temp = safeNum(gameData.weather.tempF);
    if (temp > 90 || temp < 45) {
      warnings.push(`Clima extremo (${temp}°F)`);
    }
  }
  
  if (warnings.length > 0) {
    explanationParts.push('');
    explanationParts.push(`⚠️ Consideraciones: ${warnings.join(', ')}`);
  }
  
  return explanationParts.join('\n');
}
function shouldExcludePick(pick, gameData, analytics) {
  const exclusions = [];
  
  // 0. MERCADOS DESHABILITADOS (K e IP tienen <35% win rate)
  if (DISABLED_MARKETS.includes(pick.market)) {
    exclusions.push(`Mercado ${pick.market} DESHABILITADO (win rate histórico <35%)`);
    return { excluded: true, reasons: exclusions }; // Retornar inmediatamente
  }
  
  // 1. Edge mínimo requerido (AUMENTADO de 5% a 8%)
  if (analytics.edge < 0.08) {
    exclusions.push('Edge insuficiente (<8%)');
  }
  
  // 2. Probabilidad muy baja (AUMENTADO de 52% a 55%)
  if (analytics.probability < 0.55) {
    exclusions.push('Probabilidad muy baja (<55%)');
  }
  
  // 3. Filtros específicos para Over/Under (históricamente malos)
  if (pick.side === 'Over' && analytics.probability < 0.60) {
    exclusions.push('Over requiere probabilidad >60% (win rate histórico 29%)');
  }
  
  if (pick.side === 'Under' && analytics.probability < 0.58) {
    exclusions.push('Under requiere probabilidad >58% (win rate histórico 38%)');
  }
  
  // 4. TOTAL requiere edge >10% (win rate histórico 42.6%)
  if (pick.market === 'TOTAL' && analytics.edge < 0.10) {
    exclusions.push('TOTAL requiere edge >10% (win rate histórico bajo)');
  }
  
  // 5. Sharp money en dirección opuesta (CRÍTICO)
  const sharpMoney = detectSharpMoney(gameData.market?.move, gameData.market?.publicPercent);
  if (sharpMoney.isSharp && pick.market === 'ML') {
    const sharpSide = sharpMoney.side === 'away' ? gameData.away?.abr : gameData.home?.abr;
    if (sharpSide !== pick.sideTeam && sharpMoney.confidence > 0.75) {
      exclusions.push(`Sharp money en dirección opuesta: ${sharpMoney.message}`);
    }
  }
  
  // 6. Lineup no confirmado para picks "strong"
  if (pick.confidence === 'strong' && pick.market === 'ML') {
    const lineup = pick.sideTeam === gameData.away?.abr ? gameData.lineup?.away : gameData.lineup?.home;
    if (lineup && !lineup.confirmed) {
      exclusions.push('Lineup no confirmado para pick strong');
    }
  }
  
  // 7. Muestra pequeña del pitcher (para K/IP, aunque están deshabilitados)
  if (pick.market === 'K' || pick.market === 'IP') {
    const pitcher = pick.target === 'away' ? gameData.pitchers?.away : gameData.pitchers?.home;
    if (pitcher && safeNum(pitcher.splitGames) < 5) {
      exclusions.push('Muestra del pitcher muy pequeña (<5 juegos)');
    }
  }
  
  // 8. Conflicto entre factores principales
  const factors = analytics.factors;
  const highFactors = Object.values(factors).filter(v => v > 0.65).length;
  const lowFactors = Object.values(factors).filter(v => v < 0.35).length;
  
  if (highFactors >= 2 && lowFactors >= 2) {
    exclusions.push('Conflicto entre factores principales');
  }
  
  // 9. Movimiento de línea en dirección opuesta (AUMENTADO de 15 a 12 puntos)
  if (gameData.market?.move && pick.market === 'ML') {
    const mlMove = pick.sideTeam === gameData.away?.abr 
      ? safeNum(gameData.market.move.mlAway)
      : safeNum(gameData.market.move.mlHome);
    
    // Si el movimiento es negativo (línea empeoró) y es significativo
    if (mlMove < -12) {
      exclusions.push(`Movimiento de línea en contra (${Math.abs(mlMove).toFixed(0)} puntos)`);
    }
  }
  
  // 10. Clima extremo sin datos históricos
  if (gameData.weather && !gameData.weather.indoor) {
    const temp = safeNum(gameData.weather.tempF);
    const wind = safeNum(gameData.wind?.mph || gameData.weather.windMph);
    
    if (temp > 95 || temp < 40) {
      exclusions.push(`Clima extremo (${temp}°F): alta varianza`);
    }
    
    if (wind > 22) {
      exclusions.push(`Viento extremo (${wind} mph): alta varianza`);
    }
  }
  
  // 11. Momentum extremadamente negativo
  if (pick.market === 'ML') {
    const team = pick.sideTeam === gameData.away?.abr ? gameData.away : gameData.home;
    const teamMomentum = getTeamMomentum(team?.record?.last10);
    
    if (teamMomentum.status === 'COLD' && analytics.probability < 0.58) {
      exclusions.push(`Equipo en racha fría (${teamMomentum.wins}-${10-teamMomentum.wins}) con probabilidad baja`);
    }
  }
  
  return {
    excluded: exclusions.length > 0,
    reasons: exclusions
  };
}

/* ── Build human-readable game block for prompt (FASE 2) ─── */
function formatGame(g) {
  const lines = [];
  lines.push(`══ ${g.away?.abr || '?'} @ ${g.home?.abr || '?'}  (gameId: ${g.gameId || ''}) ══`);

  /* ═══ TOP 5 FACTORES ═══ */
  
  /* Momentum del equipo */
  const awayMomentum = getTeamMomentum(g.away?.record?.last10);
  const homeMomentum = getTeamMomentum(g.home?.record?.last10);
  lines.push(`MOMENTUM: ${g.away?.abr} ${awayMomentum.status} (${awayMomentum.wins}-${10-awayMomentum.wins} L10) · ${g.home?.abr} ${homeMomentum.status} (${homeMomentum.wins}-${10-homeMomentum.wins} L10)`);
  
  /* Ventaja de local */
  const homeAdv = getHomeFieldAdvantage(g.venue?.name, g.home?.abr);
  const homeAdvPct = ((homeAdv - 1.0) * 100).toFixed(0);
  lines.push(`VENTAJA LOCAL: ${g.home?.abr} +${homeAdvPct}% (${g.venue?.name || 'venue desconocido'})`);
  
  /* Sharp money */
  const sharpMoney = detectSharpMoney(g.market?.move, g.market?.publicPercent);
  if (sharpMoney.isSharp) {
    lines.push(`SHARP MONEY: ${sharpMoney.type} → ${sharpMoney.side?.toUpperCase()} (${(sharpMoney.confidence * 100).toFixed(0)}% confianza)`);
    lines.push(`  ${sharpMoney.message}`);
  } else {
    lines.push(`SHARP MONEY: No detectado`);
  }
  
  /* Clima detallado */
  const weatherImpact = getWeatherImpact(g.weather, g.wind, g.evtIso);
  if (weatherImpact.factors.length > 0) {
    lines.push(`CLIMA DETALLADO:`);
    weatherImpact.factors.forEach(f => lines.push(`  ${f}`));
    lines.push(`  Ajuste total: ${weatherImpact.totalAdjustment > 0 ? '+' : ''}${weatherImpact.totalAdjustment.toFixed(1)} runs esperadas`);
  }
  
  /* Splits avanzados */
  if (g.pitchers?.away && g.offense?.home) {
    const awaySplits = getAdvancedPitcherSplits(g.pitchers.away, g.offense.home, g);
    if (awaySplits.factors.length > 0) {
      lines.push(`SPLITS ${g.away?.abr} pitcher:`);
      awaySplits.factors.forEach(f => lines.push(`  ${f}`));
    }
  }
  if (g.pitchers?.home && g.offense?.away) {
    const homeSplits = getAdvancedPitcherSplits(g.pitchers.home, g.offense.away, g);
    if (homeSplits.factors.length > 0) {
      lines.push(`SPLITS ${g.home?.abr} pitcher:`);
      homeSplits.factors.forEach(f => lines.push(`  ${f}`));
    }
  }

  /* ═══ DATOS ORIGINALES ═══ */

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
  if (mk.publicPercent) {
    lines.push(`Público: ${g.away?.abr} ${num(mk.publicPercent.away, 0)}% · ${g.home?.abr} ${num(mk.publicPercent.home, 0)}%`);
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

/* ══════════════════════════════════════════════════════════
   PIPELINE 2 ETAPAS:
   ETAPA 1 → gpt-4o-mini: Escanea TODOS los juegos y puntúa candidatos (0-10)
   ETAPA 2 → gpt-4o: Análisis profundo SOLO de candidatos con score ≥ 5
   ══════════════════════════════════════════════════════════ */

/* ── ETAPA 1: Prompt de scoring rápido (gpt-4o-mini) ────── */
const STAGE1_SYSTEM_PROMPT = `Eres un scout rápido de apuestas MLB. Tu único trabajo es identificar qué juegos tienen POTENCIAL DE VALUE, NO hacer picks finales.

Para cada juego asigna un SCORE de 0 a 10 basado en estos criterios:
• SCORE 9-10: Múltiples señales fuertes alineadas (momentum claro + pitcher dominante + sharp money + edge obvio)
• SCORE 7-8: 3+ señales claras en la misma dirección sin señales en contra
• SCORE 5-6: 2 señales positivas, pocas contradicciones, vale la pena análisis profundo
• SCORE 3-4: Señales mixtas o débiles, no hay edge claro
• SCORE 0-2: Sin señales, juego parejo, no apostar

SEÑALES QUE SUBEN EL SCORE:
✅ Un equipo es HOT (7+ wins L10) y el rival es COLD (≤3 wins L10)
✅ Diferencia de WHIP contextual entre pitchers > 0.30
✅ Sharp money detectado (Reverse Line Movement)
✅ Movimiento de línea ML > 10 puntos en una dirección
✅ Clima extremo con edge claro en TOTAL (viento out >15mph, temp extrema)
✅ splitEdge > 1.0 para el pitcher jugando en su contexto favorable
✅ Lineup confirmado con ventaja clara vs pitcher rival
✅ H2H domina 4-1 o mejor en los últimos 5 juegos

SEÑALES QUE BAJAN EL SCORE:
❌ Ambos pitchers similares (WHIP contextual diferencia < 0.15)
❌ Ambos equipos con momentum NEUTRAL
❌ Sin movimiento de línea (mercado inactivo)
❌ Lineups no confirmados
❌ Juego indoor sin factores climáticos

Devuelve SOLO JSON sin texto adicional:
{
  "stage1": [
    {
      "gameId": "string",
      "score": 0-10,
      "markets": ["ML", "TOTAL"],
      "topSignal": "La señal más fuerte detectada en una frase",
      "risk": "El mayor riesgo o señal en contra en una frase"
    }
  ]
}`;

/* ── ETAPA 2: Prompt de análisis profundo (gpt-4o) ────────── */
const SYSTEM_PROMPT = `Eres el analista senior de apuestas MLB con el mejor historial del equipo. Los juegos que recibes ya fueron PRE-SELECCIONADOS por un scout como los de mayor potencial del día — son los MEJORES candidatos.

Tu trabajo es encontrar picks de máxima calidad en estos juegos. Eres la segunda capa del proceso, el juicio final.

═══ TU HISTORIAL REAL (CRÍTICO - APRENDE DE ESTO) ═══
• Win Rate Global: 43.0% ❌ (Objetivo: >52.4%)
• ML: 56.2% ✅ (50W-39L) - ÚNICO MERCADO RENTABLE
• TOTAL: 42.6% ❌ (23W-28L) - BAJO BREAKEVEN
• K: 30.3% ❌ (20W-46L) - DESASTROSO (DESHABILITADO)
• IP: 28.6% ❌ (6W-15L) - DESASTROSO (DESHABILITADO)
• Over: 29.2% ❌ (14W-34L) - MUY MALO
• Under: 37.6% ❌ (35W-55L) - MALO

CONCLUSIÓN: Solo ML es rentable. TOTAL necesita edge >10%. Over/Under requieren probabilidad >58-60%.

IMPORTANTE: Si recibes un bloque "APRENDIZAJE DE PICKS HISTÓRICOS", úsalo para:
1. PRIORIZAR ML (único mercado con 56% win rate)
2. SER EXTREMADAMENTE SELECTIVO con TOTAL (solo edge >10%)
3. EVITAR Over a menos que probabilidad >60%
4. EVITAR Under a menos que probabilidad >58%
5. K e IP están DESHABILITADOS (win rate <35%)

DATOS QUE RECIBES POR JUEGO (ya son los mejores candidatos del día):
• H2H (head-to-head): Historial directo entre equipos (últimos 5 juegos), récord y runs promedio
• Pitcher abridor (L10 starts): WHIP, K/BB, IP promedio, splits home/away, métricas contextuales
• Ofensiva (L10 + temporada): R/G, K/G, H/G, hotRate, splits vs LHP/RHP
• Bullpen (L10): ERA, WHIP, K/9, IP/G
• Momios: ML open/close, O/U, movimiento de línea, probabilidad sin vig
• Venue: park factor, temperatura, viento, humedad
• Lineup: confirmado o pendiente
• Descanso del pitcher, umpire con factor K
• Momentum del equipo (racha L10)
• Score del scout (0-10) y señal principal detectada

═══ REGLAS DE ANÁLISIS MEJORADAS (FASE 2) ═══

1. ML (moneyline) - PRIORIDAD MÁXIMA:
   - MOMENTUM: Equipo HOT (7+ wins L10) vs COLD (≤3 wins L10) = señal FUERTE
   - VENTAJA LOCAL: Coors Field, Fenway, Wrigley = +8-15% probabilidad
   - SHARP MONEY: RLM (reverse line movement) = seguir el dinero profesional
   - H2H reciente: Si un equipo domina 4-1 o mejor en L5 H2H → señal fuerte
   - Compara WHIP contextual + K/BB + splitEdge de pitchers
   - Si pitcher superior tiene momio positivo (underdog) → value potencial
   - Bullpen crítico: abridor elite + bullpen ERA > 4.50 = riesgo alto
   - Movimiento ML > 12 puntos en contra = EVITAR
   - NO sugieras si splitEdge < 0.5 Y H2H está parejo Y momentum neutral

2. TOTAL (Over/Under) - EXTREMADAMENTE SELECTIVO:
   - CLIMA: Temp >85°F +0.6, <55°F -0.5, viento out >15mph +1.0, humedad >70% -0.3
   - HORA: Juego de día (1-4pm) = +0.4 runs
   - Base = (R/G away visitante + R/G home local) × park factor + ajustes climáticos
   - H2H: Si promedio de runs en H2H difiere >1.5 de la línea → señal
   - Bullpen WHIP >1.40 ambos equipos → Over. <1.20 ambos → Under
   - MÍNIMO: edge > 10% (no 5%) debido a win rate histórico bajo
   - Over requiere probabilidad >60%, Under >58%
   - Movimiento O/U > 0.5 = sharp money

3. K (strikeouts) - DESHABILITADO:
   - Win rate histórico 30.3% = NO GENERAR PICKS DE K

4. IP (innings pitched) - DESHABILITADO:
   - Win rate histórico 28.6% = NO GENERAR PICKS DE IP

═══ REGLAS DE CONFIANZA ESTRICTAS ═══
• "strong": 5+ señales alineadas + edge >10% + momentum favorable + sharp money a favor + sin conflictos
• "medium": 3-4 señales positivas + edge >8% + máximo 1 factor en contra
• NO generes pick si:
  - Edge calculado < 8%
  - Probabilidad < 55%
  - Over con probabilidad <60%
  - Under con probabilidad <58%
  - TOTAL con edge <10%
  - Señales contradictorias
  - Sharp money en dirección opuesta (RLM)
  - Equipo COLD sin ventajas compensatorias
  - Movimiento de línea >12 puntos en tu contra

MÁXIMO 1 PICK POR JUEGO. Si un juego no tiene edge claro, NO GENERES PICK — es mejor no apostar.

PRIORIDAD: 90% ML, 10% TOTAL (solo con edge >10%).

Devuelve SOLO JSON:
{
  "picks": [
    {
      "gameId": "string",
      "topPicks": [
        {
          "market": "ML"|"TOTAL",
          "sideTeam": "ABR del equipo (solo para ML)",
          "side": "Over"|"Under",
          "line": number,
          "confidence": "strong"|"medium",
          "reason": "Razón concreta con datos específicos: momentum, sharp money, clima, splits, H2H"
        }
      ]
    }
  ]
}`;

/* ── Stage 1: gpt-4o-mini scores all games (cheap + fast) ── */
async function stage1ScoreGames(formattedGames, date) {
  // Build a lightweight summary per game for stage 1
  const summaries = formattedGames.map(({ gameId, text }) => `[${gameId}]\n${text}`).join('\n\n---\n\n');
  const userMsg = `Fecha: ${date || 'hoy'}\nJuegos a evaluar: ${formattedGames.length}\n\n${summaries}`;

  try {
    const r = await withTimeout(
      fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: STAGE1_SYSTEM_PROMPT },
            { role: 'user', content: userMsg }
          ],
          temperature: 0.10,
          response_format: { type: 'json_object' }
        })
      }),
      4000, // 4 second timeout for stage 1
      null
    );

    if (!r || !r.ok) return [];
    const data = await withTimeout(r.json(), 1000, null);
    if (!data) return [];
    
    const content = data?.choices?.[0]?.message?.content || '{"stage1":[]}';
    const parsed = JSON.parse(content);
    return Array.isArray(parsed?.stage1) ? parsed.stage1 : [];
  } catch (err) {
    console.error('Stage 1 scoring failed:', err.message);
    return [];
  }
}

/* ── Handler ─────────────────────────────────────────────── */
export default async function handler(req) {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  let body;
  try { body = await req.json(); } catch (_) { return new Response('Bad Request', { status: 400 }); }

  const games = Array.isArray(body?.games) ? body.games : [];
  if (!games.length) {
    return new Response(JSON.stringify({ picks: [] }), { headers: { 'Content-Type': 'application/json' } });
  }

  // Obtener contexto de aprendizaje de picks históricos (con timeout)
  let learningContext = '';
  try {
    const { generateLearningContext } = await import('./ai-learning.js');
    const learning = await withTimeout(
      generateLearningContext(30), // Últimos 30 días
      3000, // 3 second timeout
      { hasData: false, context: '' }
    );
    if (learning.hasData) {
      learningContext = learning.context;
    }
  } catch (error) {
    console.warn('No se pudo cargar contexto de aprendizaje:', error.message);
  }

  // ═══ Enriquecer juegos con datos H2H (con timeout y límite de concurrencia) ═══
  // Procesar en lotes de 3 para evitar sobrecarga
  const enrichedGames = [];
  const batchSize = 3;
  
  for (let i = 0; i < games.length; i += batchSize) {
    const batch = games.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (game) => {
        const h2h = await withTimeout(
          fetchH2HData(game.away?.id, game.home?.id),
          2500, // 2.5 second timeout per game
          null
        );
        return { ...game, h2h };
      })
    );
    enrichedGames.push(...batchResults);
  }

  // Pre-formatear todos los juegos (se usa en ambas etapas)
  const formattedGames = enrichedGames.map(g => ({
    gameId: g.gameId,
    text: formatGame(g),
    data: g
  }));

  // ═══ ETAPA 1: gpt-4o-mini puntúa TODOS los juegos ═══
  console.log(`[Pipeline] Etapa 1: Evaluando ${formattedGames.length} juegos con gpt-4o-mini...`);
  const stage1Results = await stage1ScoreGames(formattedGames, body?.date);

  // Filtrar candidatos con score >= 5
  const candidateScores = new Map(stage1Results.map(r => [r.gameId, r]));
  const candidateGames = formattedGames.filter(g => {
    const score = candidateScores.get(g.gameId);
    return score && score.score >= 5;
  });

  console.log(`[Pipeline] Etapa 1 completada: ${candidateGames.length}/${formattedGames.length} candidatos (score ≥ 5)`);

  // Sin candidatos: retornar vacío
  if (candidateGames.length === 0) {
    return new Response(JSON.stringify({
      picks: [],
      enhanced: true,
      pipeline: '2-stage',
      stage1: {
        totalGames: formattedGames.length,
        candidates: 0,
        scores: stage1Results
      },
      metadata: { totalGenerated: 0, totalExcluded: 0, totalPassed: 0 }
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  // ═══ ETAPA 2: gpt-4o analiza SOLO los candidatos ═══
  // Incluir el score y señal del scout en el texto del juego
  const candidateTexts = candidateGames.map(g => {
    const scout = candidateScores.get(g.gameId);
    const scoutHeader = scout
      ? `[SCOUT SCORE: ${scout.score}/10 | Señal: ${scout.topSignal} | Riesgo: ${scout.risk}]\n`
      : '';
    return scoutHeader + g.text;
  }).join('\n\n');

  const userMsg = `Fecha: ${body?.date || 'hoy'}
Juegos candidatos: ${candidateGames.length} de ${formattedGames.length} totales
(Solo los juegos con mayor potencial de value según el scout)

${learningContext}
${candidateTexts}`;

  console.log(`[Pipeline] Etapa 2: Análisis profundo con gpt-4o en ${candidateGames.length} candidatos...`);

  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o',          // ← Modelo premium solo en candidatos
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMsg }
      ],
      temperature: 0.10,        // Más bajo aún: gpt-4o no necesita temperatura alta
      response_format: { type: 'json_object' }
    })
  });

  if (!r.ok) {
    const errText = await r.text().catch(() => '');
    console.error('[Pipeline] Etapa 2 falló:', r.status, errText);
    return new Response(JSON.stringify({
      picks: [],
      enhanced: true,
      pipeline: '2-stage',
      stage1: { totalGames: formattedGames.length, candidates: candidateGames.length, scores: stage1Results },
      error: `Stage 2 HTTP ${r.status}`
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  const data = await r.json();
  const content = data?.choices?.[0]?.message?.content || '{"picks":[]}';
  const aiPicks = JSON.parse(content);

  // ═══ Aplicar filtros cuantitativos de exclusión ═══
  const filteredPicks = {
    picks: [],
    excluded: [],
    enhanced: true,
    pipeline: '2-stage',
    stage1: {
      totalGames: formattedGames.length,
      candidates: candidateGames.length,
      threshold: 5,
      scores: stage1Results
    },
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

      // Calcular analytics cuantitativos
      const analytics = calculatePickProbability(pick, gameData);

      // Agregar score del scout al analytics
      const scout = candidateScores.get(gamePick.gameId);
      analytics.scoutScore = scout?.score ?? null;
      analytics.scoutSignal = scout?.topSignal ?? null;

      // Aplicar filtros de exclusión
      const exclusion = shouldExcludePick(pick, gameData, analytics);

      if (exclusion.excluded) {
        excludedPicks.push({ ...pick, analytics, exclusionReasons: exclusion.reasons });
        filteredPicks.metadata.totalExcluded++;
      } else {
        // Generar explicación detallada para picks strong
        const detailedExplanation = generateDetailedExplanation(pick, gameData, analytics);
        
        passedPicks.push({ 
          ...pick, 
          reason: detailedExplanation, // Reemplazar con explicación detallada
          analytics 
        });
        filteredPicks.metadata.totalPassed++;
      }
    }

    if (passedPicks.length > 0) {
      filteredPicks.picks.push({ gameId: gamePick.gameId, topPicks: passedPicks });
    }
    if (excludedPicks.length > 0) {
      filteredPicks.excluded.push({ gameId: gamePick.gameId, excludedPicks });
    }
  }

  console.log(`[Pipeline] Resultado final: ${filteredPicks.metadata.totalPassed} picks pasaron | ${filteredPicks.metadata.totalExcluded} excluidos`);

  return new Response(JSON.stringify(filteredPicks), {
    headers: { 'Content-Type': 'application/json' }
  });
}
