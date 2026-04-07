import { getDb } from './_mongo.js';

/* ══════════════════════════════════════════════════════════
   BACKTESTING: Analiza el rendimiento histórico de picks
   Calcula win rate, ROI, y patrones exitosos por mercado
   ══════════════════════════════════════════════════════════ */

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
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/* ── Calcular ROI basado en odds americanas ──────────────── */
function calculateROI(picks) {
  let totalStake = 0;
  let totalReturn = 0;
  
  for (const pick of picks) {
    if (pick.result === 'ungraded') continue;
    
    const stake = 1; // Asumimos 1 unidad por pick
    totalStake += stake;
    
    if (pick.result === 'win') {
      // Calcular retorno basado en odds (si están disponibles)
      const odds = safeNum(pick.odds);
      let payout = stake;
      
      if (odds !== 0) {
        if (odds > 0) {
          payout = stake * (1 + odds / 100);
        } else {
          payout = stake * (1 + 100 / Math.abs(odds));
        }
      } else {
        // Si no hay odds, asumimos -110 (estándar)
        payout = stake * (1 + 100 / 110);
      }
      
      totalReturn += payout;
    } else if (pick.result === 'push') {
      totalReturn += stake; // Devuelve la apuesta
    }
    // loss: no suma nada al return
  }
  
  if (totalStake === 0) return 0;
  return ((totalReturn - totalStake) / totalStake);
}

/* ── Analizar patrones exitosos ──────────────────────────── */
function analyzePatterns(picks) {
  const patterns = {};
  
  for (const pick of picks) {
    if (pick.result === 'ungraded') continue;
    
    // Patrón por mercado
    const market = String(pick.market || 'UNKNOWN').toUpperCase();
    if (!patterns[market]) {
      patterns[market] = { wins: 0, losses: 0, pushes: 0, total: 0 };
    }
    patterns[market].total++;
    if (pick.result === 'win') patterns[market].wins++;
    else if (pick.result === 'loss') patterns[market].losses++;
    else if (pick.result === 'push') patterns[market].pushes++;
    
    // Patrón por confianza
    const confKey = `confidence_${pick.confidence || 'unknown'}`;
    if (!patterns[confKey]) {
      patterns[confKey] = { wins: 0, losses: 0, pushes: 0, total: 0 };
    }
    patterns[confKey].total++;
    if (pick.result === 'win') patterns[confKey].wins++;
    else if (pick.result === 'loss') patterns[confKey].losses++;
    else if (pick.result === 'push') patterns[confKey].pushes++;
    
    // Patrón por side (Over/Under)
    if (pick.side) {
      const sideKey = `${market}_${pick.side}`;
      if (!patterns[sideKey]) {
        patterns[sideKey] = { wins: 0, losses: 0, pushes: 0, total: 0 };
      }
      patterns[sideKey].total++;
      if (pick.result === 'win') patterns[sideKey].wins++;
      else if (pick.result === 'loss') patterns[sideKey].losses++;
      else if (pick.result === 'push') patterns[sideKey].pushes++;
    }
  }
  
  // Convertir a array y calcular win rate
  const patternArray = Object.entries(patterns).map(([key, stats]) => {
    const graded = stats.wins + stats.losses;
    return {
      pattern: key,
      ...stats,
      winRate: graded > 0 ? (stats.wins / graded) : 0,
      roi: calculateROI(picks.filter(p => {
        if (key.startsWith('confidence_')) {
          return p.confidence === key.replace('confidence_', '');
        }
        if (key.includes('_Over') || key.includes('_Under')) {
          const [market, side] = key.split('_');
          return p.market === market && p.side === side;
        }
        return p.market === key;
      }))
    };
  });
  
  // Ordenar por win rate
  patternArray.sort((a, b) => b.winRate - a.winRate);
  
  return patternArray;
}

/* ── Identificar mejores y peores patrones ──────────────── */
function identifyKeyPatterns(patterns) {
  const best = patterns
    .filter(p => p.total >= 5) // Mínimo 5 picks para ser significativo
    .filter(p => p.winRate >= 0.60)
    .slice(0, 5)
    .map(p => ({
      pattern: p.pattern,
      winRate: (p.winRate * 100).toFixed(1) + '%',
      record: `${p.wins}-${p.losses}${p.pushes > 0 ? `-${p.pushes}` : ''}`,
      roi: (p.roi * 100).toFixed(1) + '%',
      sample: p.total
    }));
  
  const worst = patterns
    .filter(p => p.total >= 5)
    .filter(p => p.winRate < 0.45)
    .slice(-5)
    .reverse()
    .map(p => ({
      pattern: p.pattern,
      winRate: (p.winRate * 100).toFixed(1) + '%',
      record: `${p.wins}-${p.losses}${p.pushes > 0 ? `-${p.pushes}` : ''}`,
      roi: (p.roi * 100).toFixed(1) + '%',
      sample: p.total
    }));
  
  return { best, worst };
}

/* ── Handler ─────────────────────────────────────────────── */
export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      return jsonResponse(res, 405, { ok: false, error: 'Method Not Allowed' });
    }
    
    const base = isNodeResponse(res) ? 'http://localhost' : undefined;
    const url = new URL(req.url, base);
    const daysParam = url.searchParams.get('days');
    const days = daysParam ? parseInt(daysParam, 10) : 30;
    
    if (days < 1 || days > 365) {
      return jsonResponse(res, 400, { ok: false, error: 'Days must be between 1 and 365' });
    }
    
    const db = await getDb();
    const collection = db.collection('picks');
    
    // Calcular fecha límite
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffDateKey = `${cutoffDate.getFullYear()}${String(cutoffDate.getMonth() + 1).padStart(2, '0')}${String(cutoffDate.getDate()).padStart(2, '0')}`;
    
    // Obtener todos los picks del período (dateKey puede ser string o number)
    const games = await collection
      .find({
        $or: [
          { dateKey: { $gte: cutoffDateKey } },
          { dateKey: { $gte: parseInt(cutoffDateKey, 10) } }
        ]
      })
      .sort({ dateKey: -1 })
      .toArray();
    
    // Extraer todos los picks individuales
    const allPicks = [];
    for (const game of games) {
      for (const result of (game.results || [])) {
        allPicks.push({
          ...result,
          dateKey: game.dateKey,
          gameId: game.gameId
        });
      }
    }
    
    if (allPicks.length === 0) {
      return jsonResponse(res, 200, {
        ok: true,
        period: `last_${days}_days`,
        message: 'No hay picks en este período',
        totalPicks: 0,
        graded: 0,
        wins: 0,
        losses: 0,
        pushes: 0,
        ungraded: 0,
        winRate: null,
        roi: null,
        byMarket: {},
        byConfidence: {},
        patterns: { best: [], worst: [] }
      });
    }
    
    // Calcular estadísticas generales
    const graded = allPicks.filter(p => p.result !== 'ungraded');
    const wins = allPicks.filter(p => p.result === 'win').length;
    const losses = allPicks.filter(p => p.result === 'loss').length;
    const pushes = allPicks.filter(p => p.result === 'push').length;
    const ungraded = allPicks.filter(p => p.result === 'ungraded').length;
    const winRate = graded.length > 0 ? wins / graded.length : null;
    const roi = calculateROI(allPicks);
    
    // Estadísticas por mercado
    const byMarket = {};
    const markets = [...new Set(allPicks.map(p => String(p.market || 'UNKNOWN').toUpperCase()))];
    
    for (const market of markets) {
      const marketPicks = allPicks.filter(p => String(p.market || 'UNKNOWN').toUpperCase() === market);
      const marketGraded = marketPicks.filter(p => p.result !== 'ungraded');
      const marketWins = marketPicks.filter(p => p.result === 'win').length;
      const marketLosses = marketPicks.filter(p => p.result === 'loss').length;
      const marketPushes = marketPicks.filter(p => p.result === 'push').length;
      
      byMarket[market] = {
        picks: marketPicks.length,
        graded: marketGraded.length,
        wins: marketWins,
        losses: marketLosses,
        pushes: marketPushes,
        ungraded: marketPicks.length - marketGraded.length,
        winRate: marketGraded.length > 0 ? (marketWins / marketGraded.length) : null,
        roi: calculateROI(marketPicks)
      };
    }
    
    // Estadísticas por confianza
    const byConfidence = {};
    const confidences = [...new Set(allPicks.map(p => p.confidence || 'unknown'))];
    
    for (const confidence of confidences) {
      const confPicks = allPicks.filter(p => (p.confidence || 'unknown') === confidence);
      const confGraded = confPicks.filter(p => p.result !== 'ungraded');
      const confWins = confPicks.filter(p => p.result === 'win').length;
      const confLosses = confPicks.filter(p => p.result === 'loss').length;
      const confPushes = confPicks.filter(p => p.result === 'push').length;
      
      byConfidence[confidence] = {
        picks: confPicks.length,
        graded: confGraded.length,
        wins: confWins,
        losses: confLosses,
        pushes: confPushes,
        ungraded: confPicks.length - confGraded.length,
        winRate: confGraded.length > 0 ? (confWins / confGraded.length) : null,
        roi: calculateROI(confPicks)
      };
    }
    
    // Analizar patrones
    const patterns = analyzePatterns(allPicks);
    const keyPatterns = identifyKeyPatterns(patterns);
    
    return jsonResponse(res, 200, {
      ok: true,
      period: `last_${days}_days`,
      dateRange: {
        from: cutoffDateKey,
        to: parseInt(
          `${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}`,
          10
        )
      },
      totalPicks: allPicks.length,
      graded: graded.length,
      wins,
      losses,
      pushes,
      ungraded,
      winRate: winRate !== null ? Number(winRate.toFixed(3)) : null,
      roi: Number(roi.toFixed(3)),
      byMarket,
      byConfidence,
      patterns: keyPatterns,
      allPatterns: patterns.slice(0, 20) // Top 20 patrones
    });
    
  } catch (error) {
    return jsonResponse(res, 500, {
      ok: false,
      error: error.message || 'Error en backtesting'
    });
  }
}
