import { getDb } from './api/_mongo.js';

(async () => {
  try {
    const db = await getDb();
    const collection = db.collection('picks');
    
    const games = await collection.find({}).sort({ dateKey: -1 }).toArray();
    
    let allPicks = [];
    for (const game of games) {
      for (const result of (game.results || [])) {
        allPicks.push({
          ...result,
          dateKey: game.dateKey,
          gameId: game.gameId,
          badge: result.badge || result.confidence || 'unknown',
          source: result.source || 'unknown'
        });
      }
    }
    
    const graded = allPicks.filter(p => p.result !== 'ungraded');
    const wins = allPicks.filter(p => p.result === 'win').length;
    const losses = allPicks.filter(p => p.result === 'loss').length;
    const pushes = allPicks.filter(p => p.result === 'push').length;
    
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('📊 ANÁLISIS COMPLETO DE WIN RATE');
    console.log('═══════════════════════════════════════════════════════\n');
    
    console.log('📈 RESUMEN GENERAL:');
    console.log('Total picks:', allPicks.length);
    console.log('Evaluados:', graded.length);
    console.log('Wins:', wins);
    console.log('Losses:', losses);
    console.log('Pushes:', pushes);
    console.log('Win Rate:', ((wins / graded.length) * 100).toFixed(1) + '%');
    console.log('ROI estimado:', (((wins * 0.91 - losses) / graded.length) * 100).toFixed(1) + '%');
    
    console.log('\n═══ POR MERCADO ═══\n');
    const markets = ['ML', 'TOTAL', 'K', 'IP'];
    for (const market of markets) {
      const marketPicks = allPicks.filter(p => p.market === market && p.result !== 'ungraded');
      const marketWins = marketPicks.filter(p => p.result === 'win').length;
      const marketLosses = marketPicks.filter(p => p.result === 'loss').length;
      const wr = marketPicks.length > 0 ? ((marketWins / marketPicks.length) * 100).toFixed(1) : '0.0';
      const status = parseFloat(wr) >= 55 ? '✅' : parseFloat(wr) >= 50 ? '⚠️' : '❌';
      console.log(`${status} ${market}: ${marketWins}W-${marketLosses}L (${wr}%) - ${marketPicks.length} picks`);
    }
    
    console.log('\n═══ POR CONFIANZA ═══\n');
    const badges = ['strong', 'medium', 'unknown'];
    for (const badge of badges) {
      const badgePicks = allPicks.filter(p => p.badge === badge && p.result !== 'ungraded');
      const badgeWins = badgePicks.filter(p => p.result === 'win').length;
      const badgeLosses = badgePicks.filter(p => p.result === 'loss').length;
      const wr = badgePicks.length > 0 ? ((badgeWins / badgePicks.length) * 100).toFixed(1) : '0.0';
      const status = parseFloat(wr) >= 60 ? '✅' : parseFloat(wr) >= 50 ? '⚠️' : '❌';
      console.log(`${status} ${badge}: ${badgeWins}W-${badgeLosses}L (${wr}%) - ${badgePicks.length} picks`);
    }
    
    console.log('\n═══ POR SIDE (Over/Under) ═══\n');
    const overPicks = allPicks.filter(p => p.side === 'Over' && p.result !== 'ungraded');
    const overWins = overPicks.filter(p => p.result === 'win').length;
    const overLosses = overPicks.filter(p => p.result === 'loss').length;
    const overWr = overPicks.length > 0 ? ((overWins / overPicks.length) * 100).toFixed(1) : '0.0';
    
    const underPicks = allPicks.filter(p => p.side === 'Under' && p.result !== 'ungraded');
    const underWins = underPicks.filter(p => p.result === 'win').length;
    const underLosses = underPicks.filter(p => p.result === 'loss').length;
    const underWr = underPicks.length > 0 ? ((underWins / underPicks.length) * 100).toFixed(1) : '0.0';
    
    const overStatus = parseFloat(overWr) >= 55 ? '✅' : parseFloat(overWr) >= 50 ? '⚠️' : '❌';
    const underStatus = parseFloat(underWr) >= 55 ? '✅' : parseFloat(underWr) >= 50 ? '⚠️' : '❌';
    
    console.log(`${overStatus} Over: ${overWins}W-${overLosses}L (${overWr}%) - ${overPicks.length} picks`);
    console.log(`${underStatus} Under: ${underWins}W-${underLosses}L (${underWr}%) - ${underPicks.length} picks`);
    
    console.log('\n═══ COMBINACIONES MERCADO + SIDE ═══\n');
    const combos = [
      { market: 'TOTAL', side: 'Over' },
      { market: 'TOTAL', side: 'Under' },
      { market: 'K', side: 'Over' },
      { market: 'K', side: 'Under' },
      { market: 'IP', side: 'Over' },
      { market: 'IP', side: 'Under' }
    ];
    
    for (const combo of combos) {
      const comboPicks = allPicks.filter(p => 
        p.market === combo.market && 
        p.side === combo.side && 
        p.result !== 'ungraded'
      );
      if (comboPicks.length >= 5) {
        const comboWins = comboPicks.filter(p => p.result === 'win').length;
        const comboLosses = comboPicks.filter(p => p.result === 'loss').length;
        const wr = ((comboWins / comboPicks.length) * 100).toFixed(1);
        const status = parseFloat(wr) >= 55 ? '✅' : parseFloat(wr) >= 50 ? '⚠️' : '❌';
        console.log(`${status} ${combo.market} ${combo.side}: ${comboWins}W-${comboLosses}L (${wr}%) - ${comboPicks.length} picks`);
      }
    }
    
    console.log('\n═══ POR FUENTE ═══\n');
    const sources = [...new Set(allPicks.map(p => p.source))];
    for (const source of sources) {
      const sourcePicks = allPicks.filter(p => p.source === source && p.result !== 'ungraded');
      const sourceWins = sourcePicks.filter(p => p.result === 'win').length;
      const sourceLosses = sourcePicks.filter(p => p.result === 'loss').length;
      const wr = sourcePicks.length > 0 ? ((sourceWins / sourcePicks.length) * 100).toFixed(1) : '0.0';
      const status = parseFloat(wr) >= 55 ? '✅' : parseFloat(wr) >= 50 ? '⚠️' : '❌';
      console.log(`${status} ${source}: ${sourceWins}W-${sourceLosses}L (${wr}%) - ${sourcePicks.length} picks`);
    }
    
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('🎯 CONCLUSIONES Y RECOMENDACIONES');
    console.log('═══════════════════════════════════════════════════════\n');
    
    // Identificar peores mercados
    const worstMarkets = markets
      .map(m => {
        const picks = allPicks.filter(p => p.market === m && p.result !== 'ungraded');
        const wins = picks.filter(p => p.result === 'win').length;
        return { market: m, wr: picks.length > 0 ? wins / picks.length : 0, count: picks.length };
      })
      .filter(m => m.count >= 10)
      .sort((a, b) => a.wr - b.wr);
    
    if (worstMarkets.length > 0 && worstMarkets[0].wr < 0.45) {
      console.log('❌ MERCADOS A EVITAR:');
      worstMarkets.filter(m => m.wr < 0.45).forEach(m => {
        console.log(`   - ${m.market}: ${(m.wr * 100).toFixed(1)}% win rate (${m.count} picks)`);
      });
      console.log('');
    }
    
    // Identificar mejores mercados
    const bestMarkets = markets
      .map(m => {
        const picks = allPicks.filter(p => p.market === m && p.result !== 'ungraded');
        const wins = picks.filter(p => p.result === 'win').length;
        return { market: m, wr: picks.length > 0 ? wins / picks.length : 0, count: picks.length };
      })
      .filter(m => m.count >= 10)
      .sort((a, b) => b.wr - a.wr);
    
    if (bestMarkets.length > 0 && bestMarkets[0].wr >= 0.50) {
      console.log('✅ MERCADOS A PRIORIZAR:');
      bestMarkets.filter(m => m.wr >= 0.50).forEach(m => {
        console.log(`   - ${m.market}: ${(m.wr * 100).toFixed(1)}% win rate (${m.count} picks)`);
      });
      console.log('');
    }
    
    console.log('═══════════════════════════════════════════════════════\n');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
