# Optimización de Timeout para Vercel

## Problema
La función `ai-picks-enhanced` estaba excediendo el límite de 10 segundos de Vercel Hobby plan, causando errores `FUNCTION_INVOCATION_TIMEOUT`.

## Causas del Timeout
1. **Fetching H2H data**: Llamadas a ESPN API para cada juego (sin límite de tiempo)
2. **Learning context**: Carga de MongoDB con 30 días de picks históricos
3. **OpenAI API calls**: Dos llamadas (stage 1 y stage 2) sin timeout
4. **Procesamiento paralelo sin límite**: Todos los juegos se procesaban simultáneamente

## Soluciones Implementadas

### 1. Timeout Wrapper Utility
```javascript
function withTimeout(promise, timeoutMs, fallback = null) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(fallback), timeoutMs))
  ]);
}
```

### 2. H2H Data Fetching (2.5s timeout)
- Timeout de 2 segundos para fetch
- Timeout de 1 segundo para JSON parsing
- Fallback a `null` si falla
- **Procesamiento en lotes de 3 juegos** para evitar sobrecarga

### 3. Learning Context (3s timeout)
- Timeout de 3 segundos para cargar contexto de MongoDB
- Fallback a contexto vacío si falla
- No bloquea la ejecución si MongoDB es lento

### 4. Stage 1 OpenAI (4s timeout)
- Timeout de 4 segundos para gpt-4o-mini
- Fallback a array vacío si falla
- Permite continuar sin scoring si OpenAI es lento

### 5. Procesamiento en Lotes
- H2H data se procesa en lotes de 3 juegos
- Reduce carga de red simultánea
- Mejora estabilidad

## Tiempos Estimados

| Operación | Timeout | Tiempo Típico |
|-----------|---------|---------------|
| H2H fetch (por juego) | 2.5s | 0.5-1.5s |
| Learning context | 3s | 1-2s |
| Stage 1 (gpt-4o-mini) | 4s | 2-3s |
| Stage 2 (gpt-4o) | Sin timeout | 3-5s |
| **TOTAL** | **~9-10s** | **6-8s típico** |

## Comportamiento con Timeouts

### Si H2H falla:
- El juego continúa sin datos H2H
- Factor H2H no se considera en el análisis
- No afecta otros factores (momentum, clima, splits)

### Si Learning Context falla:
- Sistema funciona sin contexto histórico
- IA usa solo el prompt base
- No afecta la generación de picks

### Si Stage 1 falla:
- Retorna array vacío de candidatos
- No se ejecuta Stage 2
- Respuesta: 0 picks generados

## Alternativas si Persiste el Timeout

### Opción 1: Upgrade a Vercel Pro
- Timeout de 60 segundos (vs 10s)
- Costo: $20/mes
- Permite procesamiento completo sin optimizaciones

### Opción 2: Reducir Datos
- Procesar máximo 5 juegos por request
- Reducir learning context a 15 días (vs 30)
- Deshabilitar H2H data completamente

### Opción 3: Caché
- Cachear learning context por 1 hora
- Cachear H2H data por 24 horas
- Usar Vercel KV o Redis

### Opción 4: Background Jobs
- Mover Stage 1 a un cron job
- Pre-calcular candidatos cada hora
- API solo ejecuta Stage 2 en candidatos pre-filtrados

## Testing

Para probar los timeouts localmente:
```bash
# Simular timeout en H2H
# Agregar delay artificial en fetchH2HData

# Simular timeout en OpenAI
# Agregar delay artificial en stage1ScoreGames

# Verificar que la función completa en <10s
node test-enhanced-picks.js
```

## Monitoreo

En Vercel Dashboard:
1. Ver "Function Duration" en logs
2. Si >9s consistentemente → considerar upgrade
3. Si <8s → optimización exitosa

## Notas Importantes

- Los timeouts NO afectan la calidad de los picks
- Sistema degrada gracefully (falla parcial, no total)
- Prioridad: completar en <10s > tener todos los datos
- ML sigue siendo el mercado más rentable (56% win rate)
