# ✅ Checklist de Deploy - Explicación Detallada

## Antes de Deploy

- [x] ✅ Identificado el problema: endpoint incorrecto
- [x] ✅ Cambiado `/api/ai-picks` → `/api/ai-picks-enhanced` en `index.html`
- [x] ✅ Agregados timeouts para evitar FUNCTION_INVOCATION_TIMEOUT
- [x] ✅ Verificado que no hay errores de sintaxis
- [x] ✅ Backend ya tiene `generateDetailedExplanation()` implementado
- [x] ✅ Frontend ya tiene CSS y función `toggleReason()`

## Deploy

```bash
# 1. Agregar cambios
git add .

# 2. Commit con mensaje descriptivo
git commit -m "fix: use ai-picks-enhanced endpoint + timeout optimization"

# 3. Push a Vercel
git push origin main
```

## Después de Deploy

### Paso 1: Verificar Deploy en Vercel
- [ ] Ve a https://vercel.com/dashboard
- [ ] Busca tu proyecto
- [ ] Verifica que el deploy tenga círculo verde ✅
- [ ] Si hay error rojo ❌, revisa los logs

### Paso 2: Abrir tu App
- [ ] Abre tu dashboard: `https://tu-app.vercel.app`
- [ ] Haz hard reload: `Ctrl + Shift + R` (Windows) o `Cmd + Shift + R` (Mac)

### Paso 3: Generar Picks
- [ ] Haz clic en "Generar Picks con IA"
- [ ] Espera a que cargue (puede tardar 8-10 segundos)
- [ ] Verifica que no haya error de timeout

### Paso 4: Buscar Pick Strong
- [ ] Busca un pick con estrella verde ✳
- [ ] Debe decir `[Fuerte]` y `[IA]`
- [ ] Debe tener badge verde "Fuerte"

### Paso 5: Verificar Explicación
- [ ] Deberías ver texto: "IA: [resumen corto]..."
- [ ] Deberías ver botón azul: "Ver análisis completo"
- [ ] Haz clic en el botón
- [ ] Se expande un panel con fondo gris
- [ ] Panel muestra:
  - [ ] 🌟 PICK FUERTE - Análisis Detallado
  - [ ] 📊 Razón Principal
  - [ ] 📈 Métricas (probabilidad, edge, confianza)
  - [ ] 🔍 Factores Analizados
  - [ ] ✅ Factores con checkmark verde
  - [ ] 📌 Resumen
  - [ ] ⚠️ Consideraciones (si las hay)
  - [ ] Botón "Ocultar" al final

### Paso 6: Probar Funcionalidad
- [ ] Haz clic en "Ocultar"
- [ ] Panel se colapsa
- [ ] Haz clic en "Ver análisis completo" de nuevo
- [ ] Panel se expande de nuevo

## Si Algo No Funciona

### No veo picks strong
- Puede ser que hoy no haya picks con suficiente edge
- El sistema es MUY selectivo (edge >8%, probabilidad >55%)
- Espera a que haya más juegos o prueba otro día

### Veo pick strong pero sin explicación
1. Abre DevTools (F12)
2. Ve a Console tab
3. Busca errores en rojo
4. Ve a Network tab
5. Busca request a `ai-picks-enhanced`
6. Verifica que la respuesta tenga `reason` largo (>500 caracteres)

### Error de timeout
- El sistema tiene timeouts optimizados
- Si persiste, puede ser que Vercel esté lento
- Espera 1 minuto y vuelve a intentar
- Si sigue fallando, considera upgrade a Vercel Pro ($20/mes, 60s timeout)

### No veo el botón "Ver análisis completo"
1. Verifica que el pick sea `strong` (no `medium`)
2. Verifica que el pick tenga `source: 'ai'` (no `model`)
3. Haz hard reload: `Ctrl + Shift + R`
4. Limpia caché del navegador

### El panel no se expande
1. Abre DevTools (F12) → Console
2. Busca errores de JavaScript
3. Verifica que la función `toggleReason()` exista
4. Prueba hacer clic varias veces

## Ejemplo de Respuesta Correcta

En DevTools → Network → `ai-picks-enhanced` → Response:

```json
{
  "picks": [
    {
      "gameId": "401814747",
      "topPicks": [
        {
          "market": "ML",
          "sideTeam": "LAD",
          "confidence": "strong",
          "reason": "🌟 PICK FUERTE - Análisis Detallado:\n\n📊 Razón Principal: Dodgers tienen ventaja clara...\n\n📈 Métricas:\n• Probabilidad: 62.3%\n• Edge sobre línea: 12.1%\n• Confianza del modelo: 85%\n\n🔍 Factores Analizados:\n✅ MOMENTUM: LAD está HOT (8-2 L10)...",
          "analytics": {
            "probability": 0.623,
            "edge": 0.121,
            "confidence": 0.85
          }
        }
      ]
    }
  ],
  "enhanced": true,
  "pipeline": "2-stage"
}
```

## Confirmación Final

Si ves TODO esto, ¡funcionó! ✅
- ✅ Pick strong con estrella verde ✳
- ✅ Texto "IA: [resumen]..."
- ✅ Botón "Ver análisis completo"
- ✅ Panel expandible con análisis detallado
- ✅ Factores Top 5 analizados
- ✅ Métricas de probabilidad y edge
- ✅ Botón "Ocultar" funciona

## Próximos Pasos

Una vez que confirmes que funciona:
1. Monitorea el win rate de los picks strong
2. Ajusta thresholds si es necesario
3. Considera agregar más factores al análisis
4. Documenta los resultados en MongoDB

## Soporte

Si algo no funciona después de seguir este checklist:
1. Toma screenshot de lo que ves
2. Copia el error de DevTools Console
3. Copia la respuesta de Network tab
4. Pregúntame con esa información
