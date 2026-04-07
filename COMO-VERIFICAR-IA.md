# 🔍 Cómo Verificar que la IA Está Funcionando

## ⚡ Método Rápido (1 minuto)

```bash
npm run diagnostico
```

Si ves esto al final:
```
🎉 TODOS LOS TESTS PASARON
🚀 EL SISTEMA DE IA ESTÁ FUNCIONANDO CORRECTAMENTE
```

**¡La IA está funcionando!** ✅

---

## 📊 Método Detallado (5 minutos)

### 1. Verificar que el servidor está corriendo

```bash
# Terminal 1
npm run dev
```

Deberías ver:
```
MLB Stats local server running on http://localhost:3000
```

✅ **Servidor OK**

---

### 2. Verificar datos en MongoDB

```bash
# Terminal 2
npm run check-db
```

Deberías ver:
```
📊 Total de juegos en la base de datos: 107
✅ Picks evaluados (con resultado): 204 picks evaluados
🎉 ¡Tienes suficientes datos para el sistema de aprendizaje!
```

✅ **MongoDB OK**

---

### 3. Verificar sistema de aprendizaje

Abre en tu navegador:
```
http://localhost:3000/api/ai-learning?days=30
```

Deberías ver JSON con:
```json
{
  "ok": true,
  "hasData": true,
  "totalPicks": 208,
  "gradedPicks": 204,
  "byMarket": {
    "ML": { "winRate": 0.57 },
    "TOTAL": { "winRate": 0.415 },
    ...
  }
}
```

✅ **Aprendizaje OK**

---

### 4. Verificar que OpenAI responde

```bash
npm test
```

Busca esta sección:
```
🤖 TEST 4: Conexión a OpenAI
✅ OpenAI respondiendo correctamente
   Picks generados: 2
   Picks aprobados: 0
   Picks excluidos: 2
✅ Contexto de aprendizaje inyectado en el prompt
```

✅ **OpenAI OK**

---

### 5. Verificar dashboard de backtesting

Abre en tu navegador:
```
http://localhost:3000/backtest-dashboard.html
```

Deberías ver:
- Total de picks
- Win rate
- ROI
- Gráficos por mercado

✅ **Dashboard OK**

---

## 🎯 Señales de que la IA Está Aprendiendo

### Señal 1: Identifica patrones
```bash
npm run diagnostico
```

Busca:
```
📚 TEST 5: IA aprende del historial
✅ IA identificó patrones fallidos:
     - K Over tiene solo 28% win rate en 25 picks - EVITAR
     - K Under tiene solo 37% win rate en 30 picks - EVITAR
```

✅ **La IA sabe qué evitar**

---

### Señal 2: Filtra picks de baja calidad

Cuando generas picks, deberías ver:
```json
{
  "metadata": {
    "totalGenerated": 15,
    "totalExcluded": 8,
    "totalPassed": 7
  }
}
```

Si `totalExcluded > 0` → ✅ **Los filtros están funcionando**

---

### Señal 3: Prioriza mercados exitosos

En el contexto de aprendizaje, deberías ver:
```
RENDIMIENTO POR MERCADO:
• ML: 57.0% win rate ✓ BUENO
• TOTAL: 41.5% win rate ⚠️ MALO
• K: 32.7% win rate ⚠️ MALO
```

La IA priorizará ML y evitará K.

✅ **La IA ajusta sus decisiones**

---

## 🚨 Problemas Comunes

### Problema 1: "fetch failed"
**Causa:** Servidor no está corriendo

**Solución:**
```bash
npm run dev
```

---

### Problema 2: "MONGO_URI no configurada"
**Causa:** Variables de entorno no cargadas

**Solución:**
Verifica que `.env` existe y tiene:
```
MONGO_URI=mongodb+srv://...
OPENAI_API_KEY=sk-proj-...
```

---

### Problema 3: "No hay datos históricos"
**Causa:** Base de datos vacía o sin picks evaluados

**Solución:**
1. Usa el sistema para generar picks
2. Espera que los juegos terminen
3. Los picks se liquidarán automáticamente
4. Después de 50+ picks evaluados, la IA aprenderá

---

### Problema 4: "OpenAI API error"
**Causa:** API key inválida o cuota excedida

**Solución:**
1. Verifica OPENAI_API_KEY en `.env`
2. Revisa tu cuota en https://platform.openai.com/usage
3. Si excediste la cuota, espera o agrega créditos

---

## 📈 Cómo Saber si la IA Está Mejorando

### Semana 1 (Baseline)
```bash
npm run diagnostico
```

Anota:
- Win rate actual: 43.6%
- ROI actual: -15.2%
- Mejor mercado: ML (57%)

---

### Semana 2 (Verificar mejora)
```bash
npm run diagnostico
```

Compara:
- Win rate debería subir (>45%)
- ROI debería mejorar (>-10%)
- Picks de mercados malos deberían reducirse

---

### Semana 3-4 (Objetivo)
```bash
npm run diagnostico
```

Objetivo:
- Win rate >55%
- ROI >5%
- Picks concentrados en mercados exitosos

---

## 🎓 Interpretación de Resultados

### Win Rate por Mercado

| Win Rate | Interpretación | Acción de la IA |
|----------|----------------|-----------------|
| >65% | Excelente | Prioriza estos picks |
| 55-65% | Bueno | Genera picks normalmente |
| 45-55% | Regular | Más selectivo, edge >7% |
| <45% | Malo | Evita o edge >10% |

### Tasa de Exclusión

| Tasa | Interpretación |
|------|----------------|
| 0-20% | Filtros muy permisivos |
| 20-40% | ✅ Óptimo |
| 40-60% | Filtros muy estrictos |
| >60% | Demasiado estricto |

---

## 🔄 Ciclo de Verificación Recomendado

### Diario:
```bash
npm run diagnostico
```
Verifica que todo funciona.

### Semanal:
```bash
npm run check-db
```
Revisa cuántos picks nuevos tienes.

Abre: http://localhost:3000/backtest-dashboard.html
Analiza tendencias de win rate.

### Mensual:
Compara métricas:
- Win rate mes anterior vs actual
- ROI mes anterior vs actual
- Patrones identificados

---

## ✅ Checklist de Verificación

Usa esto para verificar que todo funciona:

- [ ] Servidor corriendo (`npm run dev`)
- [ ] MongoDB conectado (check-db muestra datos)
- [ ] Sistema de aprendizaje activo (ai-learning responde)
- [ ] OpenAI respondiendo (diagnostico pasa test 4)
- [ ] Filtros funcionando (picks excluidos > 0)
- [ ] Dashboard carga correctamente
- [ ] Picks se generan sin errores
- [ ] Contexto de aprendizaje se inyecta

Si todos están ✅ → **Sistema funcionando al 100%**

---

## 🆘 Soporte

Si algo no funciona:

1. **Ejecuta diagnóstico:**
   ```bash
   npm run diagnostico
   ```

2. **Revisa logs del servidor:**
   Busca errores en la terminal donde corre `npm run dev`

3. **Verifica variables de entorno:**
   ```bash
   cat .env
   ```

4. **Prueba conexión a MongoDB:**
   ```bash
   npm run check-db
   ```

5. **Reinicia el servidor:**
   ```bash
   # Ctrl+C en la terminal del servidor
   npm run dev
   ```

---

**Última actualización:** 7 de abril de 2026  
**Versión:** 1.0.0
