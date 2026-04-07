import { getDb } from './_mongo.js';

/* ══════════════════════════════════════════════════════════
   AI LEARNING: Genera contexto de aprendizaje para la IA
   Analiza picks históricos y extrae patrones exitosos/fallidos
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

/* ── Generar contexto de aprendizaje para el prompt ──────── */
async function generateLearningContext(days = 30) {
  try {
    const db = await getDb();
    const collection = db.collection('picks');
    
    // Calcular fecha límite
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffDateKey = `${cutoffDate.getFullYear()}${String(cutoffDate.getMonth() + 1).padStart(2, '0')}${String(cutoffDate.getDate()).padStart(2, '0')}`;
    
    // Obtener picks del período (dateKey puede ser string o number)
    const games = await collection
      .find({
        $or: [
          { dateKey: { $gte: cutoffDateKey } },
          { dateKey: { $gte: parseInt(cutoffDateKey, 10) } }
        ]
      })
      .sort({ dateKey: -1 })
      .toArray();
    
    // Extraer todos los picks
    const allPicks = [];
    for (const game of games) {
      for (const result of (game.results || [])) {
        allPicks.push({
          ...result,
          dateKey: game.dateKey,
          gameId: game.gameId,
          awayAbr: game.awayAbr,
          homeAbr: game.homeAbr
        });
      }
    }
    
    if (allPicks.length === 0) {
      return {
        hasData: false,
        message: 'No hay datos históricos suficientes para aprender',
        context: ''
      };
    }
    
    // Analizar por mercado
    const byMarket = {};
    const markets = ['ML', 'TOTAL', 'K', 'IP'];
    
    for (const market of markets) {
      const marketPicks = allPicks.filter(p => String(p.market || '').toUpperCase() === market);
      const graded = marketPicks.filter(p => p.result !== 'ungraded');
      const wins = marketPicks.filter(p => p.result === 'win').length;
      
      if (graded.length >= 5) {
        byMarket[market] = {
          total: marketPicks.length,
          graded: graded.length,
          wins,
          winRate: wins / graded.length
        };
      }
    }
    
    // Analizar por confianza
    const byConfidence = {};
    const confidences = ['strong', 'medium'];
    
    for (const confidence of confidences) {
      const confPicks = allPicks.filter(p => p.confidence === confidence);
      const graded = confPicks.filter(p => p.result !== 'ungraded');
      const wins = confPicks.filter(p => p.result === 'win').length;
      
      if (graded.length >= 5) {
        byConfidence[confidence] = {
          total: confPicks.length,
          graded: graded.length,
          wins,
          winRate: wins / graded.length
        };
      }
    }
    
    // Identificar patrones exitosos (win rate >65%)
    const successPatterns = [];
    
    // Patrón: Mercado + Side
    for (const pick of allPicks) {
      if (pick.result === 'ungraded') continue;
      
      const market = String(pick.market || '').toUpperCase();
      const side = pick.side || '';
      
      if (side && ['Over', 'Under'].includes(side)) {
        const patternKey = `${market}_${side}`;
        const patternPicks = allPicks.filter(p => 
          String(p.market || '').toUpperCase() === market && 
          p.side === side &&
          p.result !== 'ungraded'
        );
        
        if (patternPicks.length >= 5) {
          const patternWins = patternPicks.filter(p => p.result === 'win').length;
          const patternWinRate = patternWins / patternPicks.length;
          
          if (patternWinRate >= 0.65 && !successPatterns.find(p => p.pattern === patternKey)) {
            successPatterns.push({
              pattern: patternKey,
              winRate: patternWinRate,
              sample: patternPicks.length,
              wins: patternWins,
              description: `${market} ${side} tiene ${(patternWinRate * 100).toFixed(0)}% win rate en ${patternPicks.length} picks`
            });
          }
        }
      }
    }
    
    // Identificar patrones fallidos (win rate <40%)
    const failurePatterns = [];
    
    for (const pick of allPicks) {
      if (pick.result === 'ungraded') continue;
      
      const market = String(pick.market || '').toUpperCase();
      const side = pick.side || '';
      
      if (side && ['Over', 'Under'].includes(side)) {
        const patternKey = `${market}_${side}`;
        const patternPicks = allPicks.filter(p => 
          String(p.market || '').toUpperCase() === market && 
          p.side === side &&
          p.result !== 'ungraded'
        );
        
        if (patternPicks.length >= 5) {
          const patternWins = patternPicks.filter(p => p.result === 'win').length;
          const patternWinRate = patternWins / patternPicks.length;
          
          if (patternWinRate < 0.40 && !failurePatterns.find(p => p.pattern === patternKey)) {
            failurePatterns.push({
              pattern: patternKey,
              winRate: patternWinRate,
              sample: patternPicks.length,
              wins: patternWins,
              description: `${market} ${side} tiene solo ${(patternWinRate * 100).toFixed(0)}% win rate en ${patternPicks.length} picks - EVITAR`
            });
          }
        }
      }
    }
    
    // Ejemplos de picks exitosos recientes (últimos 10 wins)
    const recentWins = allPicks
      .filter(p => p.result === 'win')
      .slice(0, 10)
      .map(p => ({
        market: p.market,
        side: p.side,
        sideTeam: p.sideTeam,
        confidence: p.confidence,
        reason: p.reason?.substring(0, 100),
        game: `${p.awayAbr} @ ${p.homeAbr}`
      }));
    
    // Ejemplos de picks fallidos recientes (últimos 10 losses)
    const recentLosses = allPicks
      .filter(p => p.result === 'loss')
      .slice(0, 10)
      .map(p => ({
        market: p.market,
        side: p.side,
        sideTeam: p.sideTeam,
        confidence: p.confidence,
        reason: p.reason?.substring(0, 100),
        game: `${p.awayAbr} @ ${p.homeAbr}`
      }));
    
    // Generar contexto en texto para el prompt
    let context = `\n═══ APRENDIZAJE DE PICKS HISTÓRICOS (últimos ${days} días) ═══\n\n`;
    
    // Rendimiento por mercado
    if (Object.keys(byMarket).length > 0) {
      context += `RENDIMIENTO POR MERCADO:\n`;
      for (const [market, stats] of Object.entries(byMarket)) {
        const winRatePct = (stats.winRate * 100).toFixed(1);
        const status = stats.winRate >= 0.60 ? '✅ EXCELENTE' : stats.winRate >= 0.55 ? '✓ BUENO' : stats.winRate >= 0.50 ? '~ REGULAR' : '⚠️ MALO';
        context += `• ${market}: ${winRatePct}% win rate (${stats.wins}W-${stats.graded - stats.wins}L) ${status}\n`;
      }
      context += '\n';
    }
    
    // Rendimiento por confianza
    if (Object.keys(byConfidence).length > 0) {
      context += `RENDIMIENTO POR CONFIANZA:\n`;
      for (const [confidence, stats] of Object.entries(byConfidence)) {
        const winRatePct = (stats.winRate * 100).toFixed(1);
        const status = stats.winRate >= 0.65 ? '✅ EXCELENTE' : stats.winRate >= 0.55 ? '✓ BUENO' : '~ REGULAR';
        context += `• ${confidence.toUpperCase()}: ${winRatePct}% win rate (${stats.wins}W-${stats.graded - stats.wins}L) ${status}\n`;
      }
      context += '\n';
    }
    
    // Patrones exitosos
    if (successPatterns.length > 0) {
      context += `PATRONES EXITOSOS (Win Rate >65%) - PRIORIZAR ESTOS:\n`;
      successPatterns.slice(0, 5).forEach(p => {
        context += `• ${p.description}\n`;
      });
      context += '\n';
    }
    
    // Patrones fallidos
    if (failurePatterns.length > 0) {
      context += `PATRONES FALLIDOS (Win Rate <40%) - EVITAR ESTOS:\n`;
      failurePatterns.slice(0, 5).forEach(p => {
        context += `• ${p.description}\n`;
      });
      context += '\n';
    }
    
    // Ejemplos de wins recientes
    if (recentWins.length > 0) {
      context += `EJEMPLOS DE PICKS EXITOSOS RECIENTES:\n`;
      recentWins.slice(0, 3).forEach((p, i) => {
        context += `${i + 1}. ${p.market} ${p.sideTeam || p.side || ''} (${p.confidence}) en ${p.game}\n`;
        if (p.reason) context += `   Razón: ${p.reason}...\n`;
      });
      context += '\n';
    }
    
    // Ejemplos de losses recientes
    if (recentLosses.length > 0) {
      context += `EJEMPLOS DE PICKS FALLIDOS RECIENTES (aprender de estos errores):\n`;
      recentLosses.slice(0, 3).forEach((p, i) => {
        context += `${i + 1}. ${p.market} ${p.sideTeam || p.side || ''} (${p.confidence}) en ${p.game}\n`;
        if (p.reason) context += `   Razón: ${p.reason}...\n`;
      });
      context += '\n';
    }
    
    context += `INSTRUCCIONES BASADAS EN HISTORIAL:\n`;
    context += `• Prioriza los mercados y patrones con mejor win rate histórico\n`;
    context += `• Evita los patrones que han fallado consistentemente\n`;
    context += `• Aprende de los picks exitosos: qué factores tenían en común\n`;
    context += `• Aprende de los picks fallidos: qué señales ignoraste\n`;
    context += `• Si un mercado tiene <50% win rate, sé MUY selectivo con ese mercado\n`;
    context += `\n═══════════════════════════════════════════════════════════\n`;
    
    return {
      hasData: true,
      totalPicks: allPicks.length,
      gradedPicks: allPicks.filter(p => p.result !== 'ungraded').length,
      byMarket,
      byConfidence,
      successPatterns,
      failurePatterns,
      recentWins: recentWins.slice(0, 3),
      recentLosses: recentLosses.slice(0, 3),
      context
    };
    
  } catch (error) {
    return {
      hasData: false,
      error: error.message,
      context: ''
    };
  }
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
    
    if (days < 1 || days > 90) {
      return jsonResponse(res, 400, { ok: false, error: 'Days must be between 1 and 90' });
    }
    
    const learning = await generateLearningContext(days);
    
    return jsonResponse(res, 200, {
      ok: true,
      ...learning
    });
    
  } catch (error) {
    return jsonResponse(res, 500, {
      ok: false,
      error: error.message || 'Error generando contexto de aprendizaje'
    });
  }
}

/* ── Export para uso interno ─────────────────────────────── */
export { generateLearningContext };
