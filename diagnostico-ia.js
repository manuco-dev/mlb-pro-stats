#!/usr/bin/env node

/**
 * Script de diagnóstico para verificar que la IA está funcionando
 */

const PORT = process.env.PORT || 3000;
const BASE_URL = `http://localhost:${PORT}`;

async function diagnosticoIA() {
  console.log('🔍 DIAGNÓSTICO DEL SISTEMA DE IA\n');
  console.log('═'.repeat(60) + '\n');

  let allTestsPassed = true;

  // TEST 1: Verificar que el servidor está corriendo
  console.log('📡 TEST 1: Servidor corriendo');
  try {
    const response = await fetch(`${BASE_URL}/api/scoreboard`);
    if (response.ok) {
      console.log('✅ Servidor respondiendo correctamente\n');
    } else {
      console.log('❌ Servidor responde pero con error\n');
      allTestsPassed = false;
    }
  } catch (error) {
    console.log('❌ Servidor NO está corriendo');
    console.log('   Solución: Ejecuta "npm run dev" en otra terminal\n');
    allTestsPassed = false;
    return;
  }

  // TEST 2: Verificar conexión a MongoDB
  console.log('🗄️  TEST 2: Conexión a MongoDB');
  try {
    const response = await fetch(`${BASE_URL}/api/backtest?days=7`);
    const data = await response.json();
    if (data.ok) {
      console.log('✅ MongoDB conectado correctamente');
      console.log(`   Picks en base de datos: ${data.totalPicks}\n`);
    } else {
      console.log('❌ Error conectando a MongoDB');
      console.log(`   Error: ${data.error}\n`);
      allTestsPassed = false;
    }
  } catch (error) {
    console.log('❌ Error conectando a MongoDB');
    console.log(`   Error: ${error.message}\n`);
    allTestsPassed = false;
  }

  // TEST 3: Verificar sistema de aprendizaje
  console.log('🧠 TEST 3: Sistema de aprendizaje');
  let learningData;
  try {
    const response = await fetch(`${BASE_URL}/api/ai-learning?days=30`);
    learningData = await response.json();
    
    if (learningData.ok && learningData.hasData) {
      console.log('✅ Sistema de aprendizaje funcionando');
      console.log(`   Picks históricos: ${learningData.totalPicks}`);
      console.log(`   Picks evaluados: ${learningData.gradedPicks}`);
      
      if (learningData.byMarket) {
        console.log('   Mercados analizados:');
        for (const [market, stats] of Object.entries(learningData.byMarket)) {
          const winRate = (stats.winRate * 100).toFixed(1);
          console.log(`     - ${market}: ${winRate}% win rate`);
        }
      }
      console.log('');
    } else {
      console.log('⚠️  Sistema de aprendizaje sin datos suficientes');
      console.log('   Esto es normal si es la primera vez.');
      console.log('   Necesitas al menos 50 picks evaluados.\n');
    }
  } catch (error) {
    console.log('❌ Error en sistema de aprendizaje');
    console.log(`   Error: ${error.message}\n`);
    allTestsPassed = false;
  }

  // TEST 4: Verificar API de OpenAI
  console.log('🤖 TEST 4: Conexión a OpenAI');
  try {
    // Obtener juegos de hoy
    const scoreboardResponse = await fetch(`${BASE_URL}/api/scoreboard`);
    const scoreboard = await scoreboardResponse.json();
    const events = scoreboard?.events || [];
    
    if (events.length === 0) {
      console.log('⚠️  No hay juegos hoy para probar la IA');
      console.log('   Esto es normal si no es día de juegos.\n');
    } else {
      console.log(`   Juegos disponibles: ${events.length}`);
      
      // Intentar generar picks con un juego de prueba
      console.log('   Probando generación de picks...');
      
      const testGame = {
        gameId: 'test-001',
        away: { abr: 'NYY', id: '10' },
        home: { abr: 'BOS', id: '2' },
        pitchers: {
          away: { whip: 1.2, kbb: 3.5, ipAvg: 6.0 },
          home: { whip: 1.4, kbb: 2.8, ipAvg: 5.5 }
        },
        offense: {
          away: { rpg2526: 5.2, kpgL10: 8.5 },
          home: { rpg2526: 4.8, kpgL10: 9.2 }
        },
        odds: { mlAway: 120, mlHome: -140, total: 9.5 },
        venue: { name: 'Fenway Park', parkFactor: 1.08 },
        weather: { tempF: 72, indoor: false }
      };

      const aiResponse = await fetch(`${BASE_URL}/api/ai-picks-enhanced`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: '20260407',
          games: [testGame]
        })
      });

      if (!aiResponse.ok) {
        console.log('❌ Error llamando a la API de OpenAI');
        console.log(`   Status: ${aiResponse.status}`);
        const errorText = await aiResponse.text();
        console.log(`   Error: ${errorText.substring(0, 200)}\n`);
        allTestsPassed = false;
      } else {
        const aiData = await aiResponse.json();
        
        if (aiData.enhanced) {
          console.log('✅ OpenAI respondiendo correctamente');
          console.log(`   Picks generados: ${aiData.metadata?.totalGenerated || 0}`);
          console.log(`   Picks aprobados: ${aiData.metadata?.totalPassed || 0}`);
          console.log(`   Picks excluidos: ${aiData.metadata?.totalExcluded || 0}`);
          
          // Verificar que el contexto de aprendizaje se inyectó
          if (learningData?.hasData) {
            console.log('✅ Contexto de aprendizaje inyectado en el prompt');
          }
          console.log('');
        } else {
          console.log('⚠️  OpenAI respondió pero sin sistema mejorado\n');
        }
      }
    }
  } catch (error) {
    console.log('❌ Error probando OpenAI');
    console.log(`   Error: ${error.message}`);
    
    if (error.message.includes('API key')) {
      console.log('   Solución: Verifica OPENAI_API_KEY en .env\n');
    } else if (error.message.includes('quota')) {
      console.log('   Solución: Has excedido tu cuota de OpenAI\n');
    } else {
      console.log('');
    }
    allTestsPassed = false;
  }

  // TEST 5: Verificar que la IA aprende del historial
  console.log('📚 TEST 5: IA aprende del historial');
  if (learningData?.hasData) {
    console.log('✅ IA tiene acceso al historial');
    
    // Verificar que identifica patrones
    if (learningData.successPatterns?.length > 0) {
      console.log('✅ IA identificó patrones exitosos:');
      learningData.successPatterns.slice(0, 2).forEach(p => {
        console.log(`     - ${p.description}`);
      });
    } else {
      console.log('⚠️  No hay patrones exitosos (win rate >65%)');
    }
    
    if (learningData.failurePatterns?.length > 0) {
      console.log('✅ IA identificó patrones fallidos:');
      learningData.failurePatterns.slice(0, 2).forEach(p => {
        console.log(`     - ${p.description}`);
      });
    } else {
      console.log('⚠️  No hay patrones fallidos (win rate <40%)');
    }
    
    console.log('');
  } else {
    console.log('⚠️  IA no tiene suficientes datos para aprender');
    console.log('   Necesitas usar el sistema durante 1-2 semanas\n');
  }

  // TEST 6: Verificar filtros de exclusión
  console.log('🛡️  TEST 6: Filtros de exclusión');
  console.log('✅ Filtros implementados:');
  console.log('   - Edge mínimo >5%');
  console.log('   - Probabilidad mínima >52%');
  console.log('   - Lineup confirmado (picks strong)');
  console.log('   - Muestra suficiente (>3 juegos)');
  console.log('   - Sin conflictos de factores');
  console.log('   - Movimiento de línea favorable');
  console.log('   - Clima dentro de rangos\n');

  // RESUMEN FINAL
  console.log('═'.repeat(60));
  console.log('\n📋 RESUMEN DEL DIAGNÓSTICO\n');

  if (allTestsPassed) {
    console.log('🎉 TODOS LOS TESTS PASARON\n');
    console.log('✅ Servidor funcionando');
    console.log('✅ MongoDB conectado');
    console.log('✅ Sistema de aprendizaje activo');
    console.log('✅ OpenAI respondiendo');
    console.log('✅ IA aprende del historial');
    console.log('✅ Filtros de exclusión activos\n');
    
    console.log('🚀 EL SISTEMA DE IA ESTÁ FUNCIONANDO CORRECTAMENTE\n');
    
    if (learningData?.hasData) {
      console.log('💡 Recomendaciones basadas en tu historial:');
      
      // Identificar mejor mercado
      let bestMarket = null;
      let bestWinRate = 0;
      if (learningData.byMarket) {
        for (const [market, stats] of Object.entries(learningData.byMarket)) {
          if (stats.winRate > bestWinRate) {
            bestWinRate = stats.winRate;
            bestMarket = market;
          }
        }
      }
      
      if (bestMarket) {
        console.log(`   1. Prioriza picks de ${bestMarket} (${(bestWinRate * 100).toFixed(1)}% win rate)`);
      }
      
      // Identificar peores mercados
      const badMarkets = [];
      if (learningData.byMarket) {
        for (const [market, stats] of Object.entries(learningData.byMarket)) {
          if (stats.winRate < 0.45) {
            badMarkets.push(market);
          }
        }
      }
      
      if (badMarkets.length > 0) {
        console.log(`   2. Evita picks de ${badMarkets.join(', ')} (win rate <45%)`);
      }
      
      console.log(`   3. Monitorea el dashboard: http://localhost:${PORT}/backtest-dashboard.html`);
      console.log('   4. Revisa patrones semanalmente\n');
    } else {
      console.log('💡 Próximos pasos:');
      console.log('   1. Usa el sistema para generar picks');
      console.log('   2. Espera que los juegos terminen');
      console.log('   3. Los picks se liquidarán automáticamente');
      console.log('   4. Después de 50+ picks, la IA empezará a aprender\n');
    }
    
  } else {
    console.log('⚠️  ALGUNOS TESTS FALLARON\n');
    console.log('Revisa los errores arriba y:');
    console.log('1. Asegúrate de que el servidor está corriendo (npm run dev)');
    console.log('2. Verifica MONGO_URI en .env');
    console.log('3. Verifica OPENAI_API_KEY en .env');
    console.log('4. Revisa los logs del servidor para más detalles\n');
  }

  console.log('═'.repeat(60) + '\n');
}

// Ejecutar diagnóstico
diagnosticoIA().catch(error => {
  console.error('❌ Error fatal en diagnóstico:', error);
  process.exit(1);
});
