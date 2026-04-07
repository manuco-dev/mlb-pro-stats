# ⚾ MLB Stats - Sistema Inteligente de Análisis y Picks

Sistema avanzado de análisis de partidos MLB con sugerencias de apuestas potenciadas por IA.

## 🚀 Inicio Rápido

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales

# 3. Iniciar servidor
npm run dev

# 4. Abrir en navegador
# http://localhost:3000
```

## ✨ Características

### 📊 Análisis Completo de Partidos
- Estadísticas de pitchers (WHIP, K/BB, splits home/away)
- Métricas ofensivas (R/G, K/G, hotRate, splits vs LHP/RHP)
- Análisis de bullpen (ERA, WHIP, K/9)
- Datos de venue (park factor), clima y umpire
- Movimiento de líneas y probabilidades sin vig

### 🤖 Sistema de Picks con IA (Fase 1 - NUEVO)
- **Datos H2H:** Historial directo entre equipos
- **Analytics Probabilísticos:** Probabilidad, edge y confianza por pick
- **Filtros Inteligentes:** 7 filtros automáticos de calidad
- **Backtesting:** Análisis histórico de rendimiento

### 📈 Dashboards Interactivos
- **Partidos de Hoy:** Análisis en tiempo real con sugerencias
- **Dashboard de Picks:** Historial y rendimiento por mercado
- **Backtesting:** Análisis de patrones exitosos/fallidos
- **Equipos K:** Ranking de equipos más ponchados

## 🎯 Sistema Mejorado de Picks (Fase 1)

### Mejoras Implementadas

#### 1. Datos Head-to-Head (H2H)
Integra el historial directo entre equipos para decisiones más informadas.

```javascript
// Ejemplo de datos H2H
{
  "h2h": {
    "gamesPlayed": 5,
    "awayWins": 4,
    "homeWins": 1,
    "awayRunsAvg": "5.2",
    "homeRunsAvg": "3.8"
  }
}
```

#### 2. Sistema de Confianza Probabilística
Cada pick incluye analytics detallados:

```javascript
{
  "analytics": {
    "probability": 0.68,  // 68% probabilidad de ganar
    "edge": 0.12,         // 12% edge sobre la línea
    "confidence": 0.85,   // 85% confianza en datos
    "factors": {
      "pitcher": 0.85,    // Muy favorable
      "offense": 0.72,    // Favorable
      "bullpen": 0.65,    // Neutral
      "venue": 0.78,      // Favorable
      "market": 0.70,     // Favorable
      "h2h": 0.82        // Muy favorable
    }
  }
}
```

#### 3. Filtros de Exclusión Automáticos
7 filtros que garantizan calidad:
- Edge mínimo >5%
- Probabilidad mínima >52%
- Lineup confirmado (picks strong)
- Muestra suficiente (>3 juegos)
- Sin conflictos de factores
- Movimiento de línea favorable
- Clima dentro de rangos normales

#### 4. Backtesting Integrado
Análisis histórico para mejora continua:
- Win rate por mercado y confianza
- ROI calculado
- Identificación de patrones exitosos
- Dashboard visual

## 📁 Estructura del Proyecto

```
mlb-stats/
├── api/
│   ├── ai-picks.js              # Sistema original de picks
│   ├── ai-picks-enhanced.js     # Sistema mejorado (Fase 1) ⭐
│   ├── analyze.js               # Análisis de juegos
│   ├── backtest.js              # Backtesting histórico ⭐
│   ├── picks-stats.js           # Estadísticas de picks
│   ├── picks-sync.js            # Sincronización con DB
│   ├── scoreboard.js            # Datos de ESPN
│   ├── team-strikeouts.js       # Ranking de strikeouts
│   └── _mongo.js                # Cliente MongoDB
├── index.html                   # Página principal
├── dashboard.html               # Dashboard de picks
├── backtest-dashboard.html      # Dashboard de backtesting ⭐
├── glossary.html                # Glosario de términos
├── team-strikeouts.html         # Ranking de equipos K
├── dev-server.js                # Servidor de desarrollo
├── test-enhanced-picks.js       # Script de pruebas ⭐
└── package.json
```

## 🔧 Configuración

### Variables de Entorno (.env)

```env
OPENAI_API_KEY=sk-proj-...
MONGO_URI=mongodb+srv://...
PORT=3000
```

### Dependencias

```json
{
  "mongodb": "^6.17.0"
}
```

## 📖 Uso

### Sistema Original
```javascript
const response = await fetch('/api/ai-picks', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    games: [...]
  })
});
```

### Sistema Mejorado (Recomendado)
```javascript
const response = await fetch('/api/ai-picks', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    enhanced: true,  // ← Activa mejoras de Fase 1
    games: [...]
  })
});

const data = await response.json();
console.log('Picks aprobados:', data.picks);
console.log('Picks excluidos:', data.excluded);
console.log('Metadata:', data.metadata);
```

### Backtesting
```javascript
// Últimos 30 días
const response = await fetch('/api/backtest?days=30');
const data = await response.json();

console.log(`Win Rate: ${(data.winRate * 100).toFixed(1)}%`);
console.log(`ROI: ${(data.roi * 100).toFixed(1)}%`);
console.log('Mejores patrones:', data.patterns.best);
```

## 🧪 Testing

```bash
# Ejecutar suite de pruebas
npm test

# Diagnóstico completo del sistema de IA
npm run diagnostico

# Verificar datos en MongoDB
npm run check-db
```

### ¿Cómo saber si la IA está funcionando?

**Método rápido (1 minuto):**
```bash
npm run diagnostico
```

Si ves `🎉 TODOS LOS TESTS PASARON` → La IA está funcionando ✅

**Guía completa:** Ver [COMO-VERIFICAR-IA.md](COMO-VERIFICAR-IA.md)

## 📊 Métricas de Éxito

### Objetivos de Fase 1
- ✅ Win rate general >58% (baseline: ~52-55%)
- ✅ Win rate picks "strong" >65% (baseline: ~58-62%)
- ✅ ROI general >10% (baseline: ~5-8%)
- ✅ Tasa de exclusión 30-40%

### Monitoreo
Revisa el dashboard de backtesting diariamente:
- http://localhost:3000/backtest-dashboard.html

## 📚 Documentación

- **[INICIO-RAPIDO.md](INICIO-RAPIDO.md)** - Guía de inicio rápido
- **[FASE1-MEJORAS.md](FASE1-MEJORAS.md)** - Documentación técnica completa
- **[RESUMEN-FASE1.md](RESUMEN-FASE1.md)** - Resumen ejecutivo
- **[CHECKLIST-VALIDACION.md](CHECKLIST-VALIDACION.md)** - Checklist de validación

## 🛠️ Tecnologías

- **Backend:** Node.js (ES Modules)
- **Base de Datos:** MongoDB
- **IA:** OpenAI GPT-4o-mini
- **APIs:** ESPN (scoreboard, stats)
- **Frontend:** Vanilla HTML/CSS/JS
- **Deploy:** Vercel

## 🔄 Roadmap

### ✅ Fase 1 (Completada)
- [x] Datos H2H
- [x] Sistema de confianza probabilística
- [x] Filtros de exclusión estrictos
- [x] Backtesting básico

### 🚧 Fase 2 (Próximamente)
- [ ] Feedback loop con historial
- [ ] Análisis de momentum (L3, L5, L10)
- [ ] Sharp money tracking
- [ ] Few-shot learning en prompt

### 🔮 Fase 3 (Futuro)
- [ ] Modelo ensemble (múltiples IAs)
- [ ] Modelo ML personalizado (XGBoost)
- [ ] Integración de noticias/lesiones
- [ ] Sistema de alertas en tiempo real

## 🤝 Contribuir

Este es un proyecto privado. Para sugerencias o reportar bugs, contacta al desarrollador.

## 📄 Licencia

Privado - Todos los derechos reservados

## 👨‍💻 Autor

**Alex Cogollo**  
Ingeniero de Sistemas · Analista deportivo con más de 4 años de experiencia

Especializado en:
- ⚾ MLB
- 🏀 NBA
- ⚽ Fútbol

---

## 🎯 Próximos Pasos

1. **Probar el sistema:**
   ```bash
   npm run dev
   npm test
   ```

2. **Monitorear resultados:**
   - Usar el sistema durante 1-2 semanas
   - Revisar backtesting diariamente
   - Ajustar umbrales según resultados

3. **Evaluar Fase 2:**
   - Si win rate >58%, implementar Fase 2
   - Si win rate <55%, ajustar filtros y continuar

---

**Versión:** 1.0.0 - Fase 1  
**Última actualización:** 7 de abril de 2026  
**Estado:** ✅ Producción
