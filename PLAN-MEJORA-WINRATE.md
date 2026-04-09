# 🎯 PLAN DE ACCIÓN PARA MEJORAR WIN RATE

## 📊 DIAGNÓSTICO ACTUAL (Datos Reales)

### Resultados Generales
- **Win Rate Global: 43.0%** ❌ (Objetivo: >52.4% para breakeven)
- **ROI: -16.5%** ❌ (Perdiendo dinero)
- **Total picks evaluados: 230**

### Por Mercado
| Mercado | Win Rate | Récord | Status | Acción |
|---------|----------|--------|--------|--------|
| **ML** | 56.2% | 50W-39L | ✅ ÚNICO RENTABLE | PRIORIZAR |
| **TOTAL** | 42.6% | 23W-28L | ❌ MALO | MEJORAR O ELIMINAR |
| **K** | 30.3% | 20W-46L | ❌ DESASTROSO | ELIMINAR TEMPORALMENTE |
| **IP** | 28.6% | 6W-15L | ❌ DESASTROSO | ELIMINAR TEMPORALMENTE |

### Por Side (Over/Under)
- **Over: 29.2%** ❌ (14W-34L) - TERRIBLE
- **Under: 37.6%** ❌ (35W-55L) - MALO

### Conclusión Crítica
**Solo ML es rentable. K e IP están destruyendo el bankroll.**

---

## 🚨 PROBLEMAS IDENTIFICADOS

### 1. Mercados K e IP son un desastre
- K: 30.3% win rate (perdiendo 7 de cada 10)
- IP: 28.6% win rate (perdiendo 7 de cada 10)
- **Estos mercados están matando el ROI**

### 2. Over/Under muy sesgado
- Over tiene solo 29.2% win rate
- Under tiene 37.6% win rate
- **El modelo no entiende bien los totales**

### 3. TOTAL runs también malo
- 42.6% win rate (bajo del breakeven 52.4%)
- **Necesita mejora urgente**

### 4. Falta de selectividad
- 230 picks en 10 días = 23 picks/día
- **Demasiados picks de baja calidad**

---

## 💡 SOLUCIONES PROPUESTAS (Fase 2)

### ACCIÓN INMEDIATA (Implementar YA)

#### 1. ELIMINAR mercados K e IP temporalmente
```javascript
// En ai-picks-enhanced.js
const DISABLED_MARKETS = ['K', 'IP']; // Desactivar hasta mejorar el modelo

function shouldExcludePick(pick, gameData, analytics) {
  // Nuevo filtro #1: Mercados deshabilitados
  if (DISABLED_MARKETS.includes(pick.market)) {
    exclusions.push(`Mercado ${pick.market} deshabilitado (win rate <35%)`);
  }
  // ... resto de filtros
}
```

**Impacto esperado:** Eliminar 87 picks malos (66 K + 21 IP) = subir win rate a ~51%

#### 2. AUMENTAR umbral mínimo de edge
```javascript
// Cambiar de 5% a 8%
if (analytics.edge < 0.08) {  // Era 0.05
  exclusions.push('Edge insuficiente (<8%)');
}
```

**Impacto esperado:** Filtrar picks marginales, mejorar calidad

#### 3. AUMENTAR umbral mínimo de probabilidad
```javascript
// Cambiar de 52% a 55%
if (analytics.probability < 0.55) {  // Era 0.52
  exclusions.push('Probabilidad muy baja (<55%)');
}
```

**Impacto esperado:** Solo picks con ventaja clara

#### 4. FILTRO ESPECÍFICO para Over/Under
```javascript
// Nuevo filtro para Over (tiene 29% win rate)
if (pick.side === 'Over' && analytics.probability < 0.60) {
  exclusions.push('Over requiere probabilidad >60% (históricamente malo)');
}

// Filtro para Under
if (pick.side === 'Under' && analytics.probability < 0.58) {
  exclusions.push('Under requiere probabilidad >58%');
}
```

**Impacto esperado:** Reducir picks Over/Under de baja calidad

#### 5. PRIORIZAR ML (único mercado rentable)
```javascript
// En el prompt del sistema
IMPORTANTE: Basado en tu historial:
- ML tiene 56.2% win rate → PRIORIZA este mercado
- K tiene 30.3% win rate → DESHABILITADO
- IP tiene 28.6% win rate → DESHABILITADO
- TOTAL tiene 42.6% win rate → Solo con edge >10%
- Over tiene 29.2% win rate → Solo con probabilidad >60%
- Under tiene 37.6% win rate → Solo con probabilidad >58%

GENERA MÁXIMO 1 PICK POR JUEGO. Calidad absoluta > cantidad.
```

---

### MEJORAS A MEDIANO PLAZO (Próximas 2 semanas)

#### 6. Modelo de K mejorado
**Problema:** K tiene 30% win rate porque el modelo no considera:
- Umpire strike zone (ya lo tienes pero no lo usa bien)
- Clima (viento, temperatura afecta K)
- Lineup rival confirmado (bateadores específicos)
- Splits del pitcher vs bateadores zurdos/derechos

**Solución:**
```javascript
function calculateKProbability(pick, gameData) {
  let baseK = pitcher.kAvg; // K promedio del pitcher
  
  // Ajuste por umpire (CRÍTICO)
  if (gameData.umpire?.kZone) {
    baseK *= gameData.umpire.kZone; // >1.0 = más K, <1.0 = menos K
  }
  
  // Ajuste por clima
  if (gameData.weather?.windMph > 15) {
    baseK -= 0.5; // Viento fuerte = menos K
  }
  
  // Ajuste por lineup rival
  const oppKRate = gameData.offense?.kpgL10 || 8.0;
  if (oppKRate > 9.5) baseK += 1.0; // Rival poncha mucho
  if (oppKRate < 7.0) baseK -= 1.0; // Rival no poncha
  
  return baseK;
}
```

#### 7. Modelo de IP mejorado
**Problema:** IP tiene 28% win rate porque no considera:
- Bullpen disponibilidad (si bullpen está cansado, pitcher lanza más)
- Importancia del juego (playoffs, racha)
- Historial del manager (algunos sacan pitchers temprano)

**Solución:**
```javascript
function calculateIPProbability(pick, gameData) {
  let baseIP = pitcher.ipAvg;
  
  // Ajuste por bullpen
  if (gameData.bullpen?.era > 4.50) {
    baseIP += 0.5; // Bullpen malo = pitcher lanza más
  }
  
  // Ajuste por descanso
  if (gameData.restDays?.pitcher <= 3) {
    baseIP -= 1.0; // Descanso corto = menos IP
  }
  
  // Ajuste por rival
  const oppRpg = gameData.offense?.rpg2526 || 4.5;
  if (oppRpg > 5.5) baseIP -= 0.5; // Rival ofensivo = menos IP
  
  return baseIP;
}
```

#### 8. Modelo de TOTAL mejorado
**Problema:** TOTAL tiene 42% win rate, Over especialmente malo (29%)

**Solución:**
```javascript
function calculateTotalProbability(pick, gameData) {
  // Base: runs esperadas
  const awayRuns = gameData.offense.away.rpg2526Away; // Como visitante
  const homeRuns = gameData.offense.home.rpg2526Home; // Como local
  let projectedTotal = (awayRuns + homeRuns) * gameData.venue.parkFactor;
  
  // Ajuste por pitchers
  const awayPitcherRuns = gameData.pitchers.away.runsAllowedAvg || 4.0;
  const homePitcherRuns = gameData.pitchers.home.runsAllowedAvg || 4.0;
  projectedTotal = (projectedTotal + awayPitcherRuns + homePitcherRuns) / 2;
  
  // Ajuste por clima (CRÍTICO para totales)
  if (gameData.weather?.tempF > 85) projectedTotal += 0.5;
  if (gameData.weather?.tempF < 55) projectedTotal -= 0.5;
  if (gameData.weather?.windMph > 12 && gameData.wind?.direction === 'out') {
    projectedTotal += 1.0; // Viento a favor = más runs
  }
  
  // Ajuste por bullpen
  const avgBullpenERA = (gameData.bullpen.away.era + gameData.bullpen.home.era) / 2;
  if (avgBullpenERA > 4.50) projectedTotal += 0.5;
  if (avgBullpenERA < 3.50) projectedTotal -= 0.5;
  
  // Calcular edge
  const line = pick.line;
  const edge = Math.abs(projectedTotal - line);
  
  // Solo sugerir si edge > 1.0 runs
  if (edge < 1.0) return null;
  
  return {
    projected: projectedTotal,
    line: line,
    edge: edge,
    side: projectedTotal > line ? 'Over' : 'Under'
  };
}
```

#### 9. Sistema de Kelly Criterion para bankroll
**Problema:** Todas las apuestas son iguales (1 unidad)

**Solución:**
```javascript
function calculateKellyStake(probability, odds) {
  // Kelly = (bp - q) / b
  // b = decimal odds - 1
  // p = probabilidad de ganar
  // q = 1 - p
  
  const decimalOdds = odds > 0 ? (odds / 100) + 1 : (100 / Math.abs(odds)) + 1;
  const b = decimalOdds - 1;
  const p = probability;
  const q = 1 - p;
  
  const kelly = (b * p - q) / b;
  
  // Usar 1/4 Kelly (más conservador)
  const fractionalKelly = kelly * 0.25;
  
  // Limitar entre 0.5 y 2 unidades
  return Math.max(0.5, Math.min(2.0, fractionalKelly));
}
```

#### 10. Tracking de sharp money
**Problema:** No sabemos si el dinero profesional está de nuestro lado

**Solución:**
```javascript
function detectSharpMoney(gameData) {
  const mlMove = gameData.market?.move?.mlAway || 0;
  const totalMove = gameData.market?.move?.total || 0;
  
  // Movimiento >15 puntos = sharp money
  if (Math.abs(mlMove) > 15) {
    return {
      isSharp: true,
      direction: mlMove > 0 ? 'away' : 'home',
      confidence: Math.abs(mlMove) / 20 // 0-1 scale
    };
  }
  
  return { isSharp: false };
}

// En filtros de exclusión
const sharp = detectSharpMoney(gameData);
if (sharp.isSharp && sharp.direction !== pick.sideTeam) {
  exclusions.push('Sharp money en dirección opuesta');
}
```

---

## 📈 RESULTADOS ESPERADOS

### Implementando solo acciones inmediatas (1-5):
- **Win Rate esperado: 51-53%** (vs 43% actual)
- **ROI esperado: +2% a +5%** (vs -16.5% actual)
- **Picks por día: 5-8** (vs 23 actual)
- **Enfoque: 80% ML, 20% TOTAL selectivo**

### Implementando mejoras a mediano plazo (6-10):
- **Win Rate esperado: 55-58%**
- **ROI esperado: +8% a +12%**
- **Reactivar K e IP con modelos mejorados**
- **Sistema completo de bankroll management**

---

## 🛠️ IMPLEMENTACIÓN

### Prioridad 1 (HOY - 1 hora)
1. Deshabilitar K e IP
2. Aumentar umbrales de edge y probabilidad
3. Filtros específicos para Over/Under
4. Actualizar prompt con historial

### Prioridad 2 (Esta semana - 3 horas)
5. Modelo mejorado de TOTAL
6. Sistema de Kelly Criterion
7. Tracking de sharp money

### Prioridad 3 (Próximas 2 semanas - 5 horas)
8. Modelo mejorado de K
9. Modelo mejorado de IP
10. Reactivar K e IP con nuevos modelos

---

## 📊 MÉTRICAS DE ÉXITO

### Corto plazo (1 semana)
- [ ] Win rate >50%
- [ ] ROI >0%
- [ ] Máximo 10 picks/día
- [ ] ML representa >70% de picks

### Mediano plazo (1 mes)
- [ ] Win rate >53%
- [ ] ROI >+5%
- [ ] K e IP reactivados con win rate >45%
- [ ] Sistema de bankroll funcionando

### Largo plazo (3 meses)
- [ ] Win rate >55%
- [ ] ROI >+10%
- [ ] Todos los mercados rentables
- [ ] Tracking automático de sharp money

---

## ⚠️ ADVERTENCIAS

1. **No esperes milagros inmediatos** - Las apuestas deportivas son difíciles
2. **52.4% win rate es breakeven** - Necesitas >53% para ganar dinero
3. **Varianza es real** - Incluso con 55% win rate puedes tener rachas malas
4. **Bankroll management es crítico** - Nunca apuestes más del 2-3% por pick
5. **Los libros son inteligentes** - Si algo parece demasiado fácil, probablemente no lo es

---

**Siguiente paso:** ¿Quieres que implemente las acciones inmediatas (1-5) ahora?

Esto tomará ~30 minutos y debería mejorar el win rate de 43% a ~51-53%.
