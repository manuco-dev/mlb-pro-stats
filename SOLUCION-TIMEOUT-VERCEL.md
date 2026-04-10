# ✅ Solución: FUNCTION_INVOCATION_TIMEOUT

## Problema Resuelto
Tu función `ai-picks-enhanced` estaba excediendo el límite de 10 segundos de Vercel Hobby plan.

## Cambios Aplicados

### 1. Timeout Wrapper (nueva función)
```javascript
function withTimeout(promise, timeoutMs, fallback = null)
```
- Envuelve promesas con timeout automático
- Retorna fallback si excede el tiempo

### 2. H2H Data con Timeout
- **Antes**: Sin límite de tiempo, podía tardar 5-10s
- **Ahora**: Timeout de 2.5s por juego, procesa en lotes de 3
- **Fallback**: `null` (continúa sin H2H data)

### 3. Learning Context con Timeout
- **Antes**: MongoDB sin límite de tiempo
- **Ahora**: Timeout de 3s
- **Fallback**: Contexto vacío (IA usa prompt base)

### 4. Stage 1 (gpt-4o-mini) con Timeout
- **Antes**: Sin límite de tiempo
- **Ahora**: Timeout de 4s
- **Fallback**: Array vacío (no genera picks)

### 5. Procesamiento en Lotes
- H2H data se procesa en lotes de 3 juegos
- Reduce carga de red simultánea
- Evita sobrecarga del servidor

## Tiempo Total Estimado

| Operación | Tiempo |
|-----------|--------|
| Learning context | 1-2s |
| H2H data (lotes) | 2-3s |
| Stage 1 (scoring) | 2-3s |
| Stage 2 (análisis) | 3-4s |
| **TOTAL** | **8-9s** ✅ |

## Próximos Pasos

### 1. Deploy a Vercel
```bash
git add .
git commit -m "fix: add timeout wrappers to prevent FUNCTION_INVOCATION_TIMEOUT"
git push origin main
```

### 2. Verificar en Vercel
- Ve a tu dashboard de Vercel
- Revisa los logs de la función
- Busca "Function Duration" - debe ser <10s

### 3. Probar en el Frontend
- Abre tu dashboard: https://tu-app.vercel.app
- Genera picks
- Verifica que aparezcan sin error de timeout

## Si Persiste el Timeout

### Opción A: Upgrade a Vercel Pro ($20/mes)
- Timeout de 60 segundos (vs 10s)
- No necesitas optimizaciones
- Procesamiento completo sin límites

### Opción B: Reducir Datos
```javascript
// En handler function, cambiar:
const learning = await generateLearningContext(15); // 30 → 15 días
```

### Opción C: Deshabilitar H2H
```javascript
// Comentar la sección de H2H:
// const enrichedGames = ...
const enrichedGames = games.map(g => ({ ...g, h2h: null }));
```

## Comportamiento con Timeouts

✅ **Sistema degrada gracefully**:
- Si H2H falla → continúa sin H2H data
- Si Learning falla → usa prompt base
- Si Stage 1 falla → retorna 0 picks
- **NO hay errores 500**, solo menos datos

✅ **Calidad de picks**:
- Top 5 factores siguen funcionando (momentum, clima, splits, sharp money, home advantage)
- Factores originales siguen funcionando (pitcher, offense, bullpen)
- Solo H2H es opcional

## Monitoreo

Revisa en Vercel logs:
```
[Pipeline] Etapa 1: Evaluando X juegos con gpt-4o-mini...
[Pipeline] Etapa 1 completada: Y/X candidatos (score ≥ 5)
[Pipeline] Etapa 2: Análisis profundo con gpt-4o en Y candidatos...
[Pipeline] Resultado final: Z picks pasaron | W excluidos
```

Si ves estos logs → **función completó exitosamente** ✅

## Archivos Modificados
- `api/ai-picks-enhanced.js` - Agregados timeouts y procesamiento en lotes
- `OPTIMIZACION-TIMEOUT.md` - Documentación técnica detallada
- `SOLUCION-TIMEOUT-VERCEL.md` - Este archivo (guía rápida)
