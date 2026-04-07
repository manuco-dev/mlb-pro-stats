# ✅ Checklist de Validación - Fase 1

## Pre-Deploy

### Configuración
- [ ] Variables de entorno configuradas en `.env`
  - [ ] `OPENAI_API_KEY` presente y válida
  - [ ] `MONGO_URI` presente y válida
- [ ] Dependencias instaladas (`npm install`)
- [ ] Servidor de desarrollo funciona (`npm run dev`)

### Testing Básico
- [ ] Ejecutar `npm test` sin errores
- [ ] Endpoint `/api/backtest` responde correctamente
- [ ] Endpoint `/api/ai-picks-enhanced` responde correctamente
- [ ] Endpoint `/api/ai-picks` con `enhanced: true` funciona
- [ ] Dashboard de backtesting carga correctamente

### Validación de Funcionalidades

#### 1. Datos H2H
- [ ] Sistema obtiene datos H2H de ESPN
- [ ] H2H se muestra en el prompt de IA
- [ ] H2H influye en las decisiones de picks
- [ ] Maneja correctamente cuando no hay datos H2H

#### 2. Sistema de Confianza Probabilística
- [ ] Cada pick incluye campo `analytics`
- [ ] `probability` está entre 0 y 1
- [ ] `edge` se calcula correctamente
- [ ] `factors` incluye los 6 factores esperados
- [ ] Valores de factores están entre 0 y 1

#### 3. Filtros de Exclusión
- [ ] Picks con edge <5% son excluidos
- [ ] Picks con probabilidad <52% son excluidos
- [ ] Picks "strong" sin lineup confirmado son excluidos
- [ ] Picks con muestra <3 juegos son excluidos
- [ ] Picks con conflicto de factores son excluidos
- [ ] Picks con movimiento de línea contrario son excluidos
- [ ] Picks con clima extremo son excluidos
- [ ] Campo `excluded` incluye razones de exclusión

#### 4. Backtesting
- [ ] Calcula win rate correctamente
- [ ] Calcula ROI correctamente
- [ ] Agrupa por mercado correctamente
- [ ] Agrupa por confianza correctamente
- [ ] Identifica mejores patrones (>60% win rate)
- [ ] Identifica peores patrones (<45% win rate)
- [ ] Maneja correctamente período sin datos

---

## Post-Deploy

### Monitoreo Día 1
- [ ] Sistema genera picks sin errores
- [ ] Picks incluyen analytics
- [ ] Tasa de exclusión está entre 20-50%
- [ ] No hay errores en logs del servidor
- [ ] Frontend muestra picks correctamente

### Monitoreo Semana 1
- [ ] Win rate >50% (mínimo aceptable)
- [ ] Picks "strong" tienen mejor win rate que "medium"
- [ ] Backtesting muestra datos acumulados
- [ ] No hay degradación de performance
- [ ] Usuarios reportan satisfacción

### Monitoreo Semana 2-4
- [ ] Win rate >55% (objetivo intermedio)
- [ ] ROI >5% (objetivo intermedio)
- [ ] Patrones exitosos identificados en backtesting
- [ ] Ajustes de umbrales si es necesario
- [ ] Documentación de aprendizajes

---

## Validación de Calidad de Picks

### Picks "Strong"
- [ ] Edge promedio >8%
- [ ] Probabilidad promedio >60%
- [ ] Confianza promedio >75%
- [ ] Mínimo 3 factores favorables (>0.65)
- [ ] Máximo 1 factor desfavorable (<0.35)

### Picks "Medium"
- [ ] Edge promedio >5%
- [ ] Probabilidad promedio >52%
- [ ] Confianza promedio >60%
- [ ] Mínimo 2 factores favorables
- [ ] Máximo 2 factores desfavorables

---

## Validación de Performance

### Tiempos de Respuesta
- [ ] `/api/ai-picks-enhanced` responde en <3 segundos
- [ ] `/api/backtest` responde en <2 segundos
- [ ] Frontend carga en <5 segundos
- [ ] No hay timeouts en producción

### Uso de Recursos
- [ ] Memoria del servidor estable
- [ ] CPU no excede 80% sostenido
- [ ] MongoDB responde rápidamente
- [ ] OpenAI API no excede rate limits

---

## Validación de Compatibilidad

### Backward Compatibility
- [ ] Sistema original sigue funcionando
- [ ] Frontend existente no tiene breaking changes
- [ ] Endpoints antiguos responden igual
- [ ] Base de datos compatible con ambos sistemas

### Cross-Browser
- [ ] Dashboard funciona en Chrome
- [ ] Dashboard funciona en Firefox
- [ ] Dashboard funciona en Safari
- [ ] Dashboard funciona en Edge
- [ ] Responsive en móvil

---

## Validación de Datos

### Integridad
- [ ] Picks guardados en MongoDB correctamente
- [ ] Resultados se liquidan correctamente
- [ ] Backtesting usa datos correctos
- [ ] No hay duplicados en base de datos

### Consistencia
- [ ] Mismos datos generan mismos picks (temperatura baja)
- [ ] Analytics son consistentes entre llamadas
- [ ] Filtros se aplican consistentemente
- [ ] Backtesting es reproducible

---

## Criterios de Éxito

### Mínimo Aceptable (Semana 1)
- [ ] Win rate >50%
- [ ] ROI >0%
- [ ] Sistema estable sin errores
- [ ] Tasa de exclusión 20-50%

### Objetivo Intermedio (Semana 2-3)
- [ ] Win rate >55%
- [ ] ROI >5%
- [ ] Win rate "strong" >60%
- [ ] Patrones identificados

### Objetivo Final (Semana 4+)
- [ ] Win rate >58%
- [ ] ROI >10%
- [ ] Win rate "strong" >65%
- [ ] Mejora continua visible

---

## Rollback Plan

Si los resultados no son satisfactorios:

### Opción 1: Ajustar Umbrales
- [ ] Aumentar edge mínimo a 7%
- [ ] Aumentar probabilidad mínima a 55%
- [ ] Reducir temperatura de IA a 0.10
- [ ] Agregar más filtros de exclusión

### Opción 2: Rollback Parcial
- [ ] Mantener backtesting
- [ ] Mantener analytics
- [ ] Desactivar algunos filtros
- [ ] Volver a sistema original para picks

### Opción 3: Rollback Completo
- [ ] Desactivar flag `enhanced`
- [ ] Volver a sistema original
- [ ] Mantener código para futuras mejoras
- [ ] Documentar lecciones aprendidas

---

## Notas de Validación

### Fecha de inicio: _____________

### Responsable: _____________

### Observaciones:
```
Día 1:


Semana 1:


Semana 2:


Semana 3:


Semana 4:


```

### Decisión Final:
- [ ] ✅ Fase 1 exitosa, continuar a Fase 2
- [ ] ⚠️ Fase 1 parcialmente exitosa, ajustar y continuar
- [ ] ❌ Fase 1 no exitosa, rollback y replantear

### Próximos Pasos:
```




```

---

**Última actualización:** 7 de abril de 2026
