# 🚀 Inicio Rápido - Sistema Mejorado de Picks

## ⚡ En 3 Pasos

### 1️⃣ Iniciar el servidor
```bash
npm run dev
```

### 2️⃣ Probar el sistema
```bash
# En otra terminal
node test-enhanced-picks.js
```

### 3️⃣ Ver resultados
Abre en tu navegador:
- **Backtesting:** http://localhost:3000/backtest-dashboard.html
- **Partidos:** http://localhost:3000/

---

## 🎯 Uso Básico

### Opción A: Usar desde el frontend (recomendado)

1. Abre http://localhost:3000/
2. Los picks se generan automáticamente
3. Haz clic en "🧪 Backtesting" para ver estadísticas

### Opción B: Usar la API directamente

```javascript
// Sistema mejorado (recomendado)
const response = await fetch('/api/ai-picks', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    enhanced: true,  // ← Activa el sistema mejorado
    games: [...]
  })
});

const data = await response.json();
console.log('Picks aprobados:', data.picks);
console.log('Picks excluidos:', data.excluded);
console.log('Metadata:', data.metadata);
```

---

## 📊 Ver Backtesting

### Desde el navegador:
http://localhost:3000/backtest-dashboard.html

### Desde la API:
```bash
# Últimos 30 días
curl http://localhost:3000/api/backtest?days=30

# Últimos 7 días
curl http://localhost:3000/api/backtest?days=7
```

---

## 🔍 Diferencias Clave

### Sistema Original:
- Genera picks sin validación estricta
- No incluye datos H2H
- Sin analytics cuantificables
- Puede generar picks de baja calidad

### Sistema Mejorado (Fase 1):
- ✅ Datos H2H integrados
- ✅ Analytics probabilísticos
- ✅ 7 filtros de exclusión automáticos
- ✅ Solo picks con edge >5%
- ✅ Backtesting incluido

---

## 📈 Interpretar Resultados

### Analytics de un Pick:
```json
{
  "market": "ML",
  "sideTeam": "NYY",
  "confidence": "strong",
  "analytics": {
    "probability": 0.68,    // 68% de probabilidad de ganar
    "edge": 0.12,           // 12% de edge sobre la línea
    "confidence": 0.85,     // 85% de confianza en los datos
    "factors": {
      "pitcher": 0.85,      // Pitcher muy favorable
      "offense": 0.72,      // Ofensiva favorable
      "bullpen": 0.65,      // Bullpen neutral
      "venue": 0.78,        // Venue favorable
      "market": 0.70,       // Movimiento de línea favorable
      "h2h": 0.82          // H2H muy favorable
    }
  }
}
```

### Qué significa cada métrica:

- **probability:** Probabilidad calculada de ganar (0.50 = 50%, 0.68 = 68%)
- **edge:** Ventaja sobre la línea del sportsbook (0.12 = 12% de edge)
- **confidence:** Confianza en la calidad de los datos (0-1)
- **factors:** Confianza en cada factor individual (0.5 = neutral, >0.65 = favorable, <0.35 = desfavorable)

### Picks Excluidos:
```json
{
  "excluded": [
    {
      "gameId": "401234567",
      "excludedPicks": [
        {
          "market": "TOTAL",
          "side": "Over",
          "exclusionReasons": [
            "Edge insuficiente (<5%)",
            "Conflicto entre factores principales"
          ]
        }
      ]
    }
  ]
}
```

Los picks excluidos te muestran qué picks fueron rechazados y por qué. Esto es útil para entender qué está filtrando el sistema.

---

## 🎓 Mejores Prácticas

### 1. Priorizar picks "strong" con edge >10%
```javascript
const bestPicks = data.picks
  .flatMap(game => game.topPicks)
  .filter(pick => 
    pick.confidence === 'strong' && 
    pick.analytics.edge > 0.10
  );
```

### 2. Evitar picks con factores conflictivos
```javascript
const safePicks = data.picks
  .flatMap(game => game.topPicks)
  .filter(pick => {
    const factors = Object.values(pick.analytics.factors);
    const lowFactors = factors.filter(f => f < 0.35).length;
    return lowFactors <= 1; // Máximo 1 factor desfavorable
  });
```

### 3. Monitorear backtesting semanalmente
```javascript
// Cada lunes, revisar:
const backtest = await fetch('/api/backtest?days=7');
const data = await backtest.json();

if (data.winRate < 0.55) {
  console.warn('⚠️ Win rate bajo esta semana, revisar estrategia');
}
```

---

## 🐛 Troubleshooting

### Error: "La API local no está activa"
**Solución:** Asegúrate de que el servidor esté corriendo con `npm run dev`

### Error: "MONGO_URI no configurada"
**Solución:** Verifica que `.env` tenga la variable `MONGO_URI`

### Error: "No hay picks en este período"
**Solución:** Normal si es la primera vez. Usa el sistema durante unos días para acumular datos.

### Los picks no se generan
**Solución:** 
1. Verifica que `OPENAI_API_KEY` esté en `.env`
2. Revisa la consola del servidor para ver errores
3. Prueba con `curl` para ver la respuesta exacta

---

## 📚 Documentación Completa

- **Detalles técnicos:** Ver `FASE1-MEJORAS.md`
- **Resumen ejecutivo:** Ver `RESUMEN-FASE1.md`
- **Testing:** Ejecutar `node test-enhanced-picks.js`

---

## 💡 Tips Rápidos

1. **Usa el sistema mejorado siempre:** Agrega `enhanced: true` en tus llamadas
2. **Revisa picks excluidos:** Te ayuda a entender qué está filtrando
3. **Monitorea backtesting:** Es tu mejor indicador de rendimiento
4. **Prioriza edge >10%:** Picks con mayor edge tienen mejor ROI
5. **Confía en "strong":** Picks strong tienen ~67% win rate vs ~54% medium

---

## 🎯 Métricas Objetivo

Después de 1-2 semanas de uso, deberías ver:

- ✅ Win rate general >58%
- ✅ Win rate picks "strong" >65%
- ✅ ROI >10%
- ✅ Tasa de exclusión 30-40%

Si no alcanzas estas métricas, revisa el backtesting para identificar patrones problemáticos.

---

**¿Listo para empezar?** 🚀

```bash
npm run dev
```

Luego abre http://localhost:3000/ y empieza a usar el sistema mejorado!
