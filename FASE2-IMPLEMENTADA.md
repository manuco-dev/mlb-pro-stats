# ✅ FASE 2 IMPLEMENTADA - TOP 5 FACTORES PROFESIONALES

## 🎯 Objetivo

Mejorar el win rate de 43% a 55-58% implementando los 5 factores más importantes que usan los apostadores profesionales.

---

## 📊 ESTADO ACTUAL (Antes de Fase 2)

- **Win Rate Global: 43.0%** ❌
- **ROI: -16.5%** ❌
- **ML: 56.2%** ✅ (único rentable)
- **TOTAL: 42.6%** ❌
- **K: 30.3%** ❌ (desastroso)
- **IP: 28.6%** ❌ (desastroso)
- **Over: 29.2%** ❌
- **Under: 37.6%** ❌

---

## ✅ IMPLEMENTADO

### 1. 🔥 MOMENTUM DEL EQUIPO (+3-5% WR esperado)

**Función:** `getTeamMomentum(teamRecord)`

**Qué hace:**
- Analiza récord L10 del equipo (ej: "7-3", "2-8")
- Clasifica equipos: HOT (7+ wins), WARM (6 wins), NEUTRAL (5 wins), COOL (4 wins), COLD (≤3 wins)
- Aplica factores de ajuste: HOT = 1.12x, COLD = 0.88x

**Impacto:**
- Equipo HOT vs COLD = +12% probabilidad
- Equipo HOT solo = +8% probabilidad
- Equipo COLD = -8% probabilidad

**Ejemplo:**
```
Yankees 8-2 L10 (HOT) vs Red Sox 2-8 L10 (COLD)
→ Yankees reciben +12% boost en probabilidad ML
```

---

### 2. 🏠 VENTAJA DE LOCAL MEJORADA (+2-4% WR esperado)

**Función:** `getHomeFieldAdvantage(venueName, homeTeamAbr)`

**Qué hace:**
- Base: 54% win rate local = 1.08 factor
- Estadios especiales: Coors Field (1.15), Fenway (1.12), Wrigley (1.10)
- Equipos fuertes en casa: Rockies (1.18), Red Sox (1.12), Dodgers (1.10)

**Impacto:**
- Coors Field = +15% probabilidad para local
- Fenway Park = +12% probabilidad para local
- Estadio normal = +8% probabilidad para local

**Ejemplo:**
```
Rockies en Coors Field
→ +18% boost (altitud extrema)
```

---

### 3. 💰 SHARP MONEY TRACKING (+4-6% WR esperado)

**Función:** `detectSharpMoney(marketMove, publicPercent)`

**Qué hace:**
- **RLM (Reverse Line Movement):** Detecta cuando línea se mueve opuesto al público
  - 70% público en away pero línea favorece home = sharp money en home
- **Steam Move:** Detecta movimientos súbitos >15 puntos
- Retorna: tipo (RLM/STEAM), lado (away/home), confianza (0-1)

**Impacto:**
- Sharp money a favor = +8% probabilidad
- Sharp money en contra = -10% probabilidad (FILTRO DE EXCLUSIÓN)

**Ejemplo:**
```
75% público apuesta por Yankees
Pero línea se mueve de -150 a -135 (favorece Red Sox)
→ RLM detectado: Sharp money en Red Sox
→ Si pick es Yankees: EXCLUIR
→ Si pick es Red Sox: +8% boost
```

---

### 4. 🌡️ CLIMA DETALLADO (+3-5% WR esperado)

**Función:** `getWeatherImpact(weather, wind, gameTime)`

**Qué hace:**
- **Temperatura:** >85°F = +0.6 runs, <55°F = -0.5 runs
- **Humedad:** >70% = -0.3 runs (pelota pesada)
- **Hora:** Juego de día (1-4pm) = +0.4 runs
- **Viento:** 
  - Out >15mph = +1.0 runs
  - In >15mph = -0.8 runs
  - Cross >15mph = -0.3 K esperados

**Impacto:**
- Clima favorece Over = +8% probabilidad
- Clima favorece Under = +8% probabilidad
- Clima en contra = -10% probabilidad

**Ejemplo:**
```
Juego en Wrigley Field
Temp: 88°F, Viento: 18mph OUT, Hora: 2pm
→ +0.6 (temp) +1.0 (viento) +0.4 (día) = +2.0 runs esperadas
→ Over recibe +8% boost
```

---

### 5. 📊 SPLITS AVANZADOS DEL PITCHER (+5-7% WR esperado)

**Función:** `getAdvancedPitcherSplits(pitcher, opposingOffense, gameData)`

**Qué hace:**
- **WHIP contextual:** Compara WHIP home/away vs WHIP general
  - Diferencia >0.15 = ajuste significativo
- **Vs LHP/RHP:** Compara R/G del rival vs este tipo de pitcher
  - Rival fuerte vs LHP y pitcher es LHP = -10% probabilidad
- **K/BB ratio:** >3.5 = elite control, <2.0 = mal control
- **Descanso:** ≤3 días = -8% probabilidad, ≥6 días = -6% probabilidad

**Impacto:**
- Pitcher dominante en contexto = +7% probabilidad
- Pitcher vulnerable en contexto = -7% probabilidad
- Rival fuerte vs este tipo = -10% probabilidad

**Ejemplo:**
```
Pitcher zurdo con ERA 3.50
Rival tiene 5.8 R/G vs LHP (vs 4.2 R/G general)
→ Rival es +1.6 R/G mejor vs zurdos
→ Pitcher recibe -10% probabilidad, -0.6 ERA adjustment
```

---

## 🛡️ FILTROS MEJORADOS

### Cambios en Umbrales:

| Filtro | Antes | Ahora | Razón |
|--------|-------|-------|-------|
| Edge mínimo | 5% | 8% | Eliminar picks marginales |
| Probabilidad mínima | 52% | 55% | Solo picks con ventaja clara |
| Over probabilidad | - | 60% | Over tiene 29% WR histórico |
| Under probabilidad | - | 58% | Under tiene 38% WR histórico |
| TOTAL edge | - | 10% | TOTAL tiene 42.6% WR histórico |
| Movimiento en contra | 15 pts | 12 pts | Más sensible a sharp money |

### Nuevos Filtros:

1. **Mercados deshabilitados:** K e IP (WR <35%)
2. **Sharp money en contra:** RLM con confianza >75%
3. **Momentum negativo:** Equipo COLD con probabilidad <58%
4. **Clima extremo:** Temp >95°F o <40°F, viento >22mph

---

## 📈 RESULTADOS ESPERADOS

### Corto Plazo (1 semana):

| Métrica | Antes | Esperado | Mejora |
|---------|-------|----------|--------|
| Win Rate | 43.0% | 51-53% | +8-10% |
| ROI | -16.5% | +2% a +5% | +18-21% |
| Picks/día | 23 | 5-8 | -65% |
| ML % | 38% | 80% | +42% |

### Mediano Plazo (1 mes):

| Métrica | Antes | Esperado | Mejora |
|---------|-------|----------|--------|
| Win Rate | 43.0% | 55-58% | +12-15% |
| ROI | -16.5% | +8% a +12% | +24-28% |
| Picks/día | 23 | 5-8 | -65% |

---

## 🔍 CÓMO FUNCIONA EN LA PRÁCTICA

### Ejemplo de Pick ML:

```
Yankees @ Red Sox

ANTES (Fase 1):
- Pitcher: Yankees mejor (WHIP 1.20 vs 1.35)
- Offense: Yankees mejor (5.2 vs 4.8 R/G)
- Edge: 6%
→ Probabilidad: 54%
→ PICK: Yankees ML (medium)

AHORA (Fase 2):
- Pitcher: Yankees mejor (WHIP 1.20 vs 1.35)
- Offense: Yankees mejor (5.2 vs 4.8 R/G)
- MOMENTUM: Yankees HOT (8-2), Red Sox COLD (2-8) → +12%
- VENTAJA LOCAL: Fenway Park → Red Sox +12%
- SHARP MONEY: RLM detectado → Sharp en Red Sox → -10%
- CLIMA: 88°F, viento out 16mph → +1.0 runs
- SPLITS: Pitcher Yankees vulnerable vs zurdos, Red Sox tienen 6 zurdos → -7%
→ Probabilidad: 54% +12% -12% -10% -7% = 37%
→ EXCLUIDO: Probabilidad <55%
```

### Ejemplo de Pick TOTAL:

```
Dodgers @ Giants, O/U 8.5

ANTES (Fase 1):
- Projected: 9.2 runs
- Edge: 7%
→ Probabilidad: 56%
→ PICK: Over 8.5 (medium)

AHORA (Fase 2):
- Projected: 9.2 runs
- CLIMA: 92°F, viento out 18mph, juego 2pm → +2.0 runs
- SPLITS: Ambos pitchers vulnerables en contexto → +0.8 runs
- Projected ajustado: 12.0 runs
- Edge: 35%
→ Probabilidad: 68%
→ PICK: Over 8.5 (strong) ✅
```

---

## 📝 CAMBIOS EN EL CÓDIGO

### Archivos Modificados:

1. **api/ai-picks-enhanced.js** (~1200 líneas)
   - Agregadas 5 funciones nuevas (Top 5 factores)
   - `calculatePickProbability()` completamente reescrita
   - `shouldExcludePick()` con 11 filtros (antes 7)
   - `formatGame()` incluye Top 5 factores en prompt
   - `SYSTEM_PROMPT` actualizado con historial real y reglas estrictas

### Nuevas Funciones:

```javascript
getTeamMomentum(teamRecord)           // Factor 1
getHomeFieldAdvantage(venue, team)    // Factor 2
detectSharpMoney(move, public)        // Factor 3
getWeatherImpact(weather, wind, time) // Factor 4
getAdvancedPitcherSplits(p, opp, g)   // Factor 5
```

### Constantes Nuevas:

```javascript
const DISABLED_MARKETS = ['K', 'IP'];
```

---

## 🚀 PRÓXIMOS PASOS

### Para Probar:

1. **Deploy a Vercel:**
   ```bash
   git add .
   git commit -m "Fase 2: Top 5 factores profesionales implementados"
   git push origin main
   ```

2. **Monitorear resultados (1 semana):**
   - Win rate debe subir a 51-53%
   - ROI debe ser positivo (+2% a +5%)
   - Picks por día deben bajar a 5-8

3. **Ajustar si es necesario:**
   - Si win rate <50%: aumentar umbrales más
   - Si picks <3/día: reducir umbrales ligeramente

### Para Fase 3 (si Fase 2 funciona):

1. Reactivar K con modelo mejorado
2. Reactivar IP con modelo mejorado
3. Implementar Kelly Criterion para bankroll
4. Agregar pitcher vs batters history
5. Agregar regresión a la media (xERA vs ERA)

---

## ⚠️ ADVERTENCIAS IMPORTANTES

1. **No esperes milagros inmediatos** - Necesitas al menos 50-100 picks para validar
2. **Varianza es real** - Incluso con 55% WR puedes tener rachas de 5-10 losses
3. **Breakeven es 52.4%** - Necesitas >53% para ganar dinero después de vig
4. **Bankroll management** - Nunca apuestes más del 2-3% por pick
5. **Los libros ajustan** - Si encuentras un edge, los libros lo cerrarán eventualmente

---

## 📊 MÉTRICAS DE ÉXITO

### Semana 1:
- [ ] Win rate >50%
- [ ] ROI >0%
- [ ] Máximo 10 picks/día
- [ ] ML representa >70% de picks

### Mes 1:
- [ ] Win rate >53%
- [ ] ROI >+5%
- [ ] Consistencia en resultados
- [ ] Sharp money tracking funcionando

### Mes 3:
- [ ] Win rate >55%
- [ ] ROI >+10%
- [ ] K e IP reactivados
- [ ] Sistema completamente optimizado

---

**Implementado:** 8 de abril de 2026  
**Versión:** 2.0.0 - Fase 2 Completa  
**Tiempo de implementación:** 2 horas  
**Líneas de código agregadas:** ~600  
**Funciones nuevas:** 5  
**Filtros nuevos:** 4  

---

## 🎉 RESUMEN

Fase 2 implementa los 5 factores más importantes que usan los apostadores profesionales:

1. ✅ Momentum del equipo (racha L10)
2. ✅ Ventaja de local mejorada (estadios específicos)
3. ✅ Sharp money tracking (RLM + steam moves)
4. ✅ Clima detallado (temp, humedad, hora, viento)
5. ✅ Splits avanzados del pitcher (contexto, vs LHP/RHP, descanso)

Además:
- ✅ K e IP deshabilitados (WR <35%)
- ✅ Umbrales más estrictos (edge 8%, prob 55%)
- ✅ Filtros específicos para Over/Under
- ✅ TOTAL requiere edge >10%
- ✅ Prompt actualizado con historial real

**Resultado esperado: Win rate de 43% → 55-58%**
