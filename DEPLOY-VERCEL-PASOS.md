# 🚀 Guía de Deploy a Vercel - Paso a Paso

## ✅ Pre-requisitos Verificados

Acabas de ejecutar `npm run pre-deploy` y todo pasó ✅

### ⚙️ Configuración de Runtime

Las funciones que usan MongoDB están configuradas con Node.js runtime (no Edge):
- `api/ai-picks-enhanced.js` - Sistema mejorado con IA
- `api/ai-learning.js` - Aprendizaje automático
- `api/backtest.js` - Backtesting
- `api/picks-stats.js` - Estadísticas
- `api/picks-sync.js` - Sincronización

Las funciones que NO usan MongoDB usan Edge runtime (más rápido):
- `api/ai-picks.js` - Sistema original (hace fetch a enhanced)
- `api/analyze.js` - Análisis de juegos
- `api/scoreboard.js` - Scoreboard de ESPN

---

## 📋 Pasos para Deploy

### Paso 1: Commit y Push a Git

```bash
# Agregar todos los archivos
git add .

# Commit con mensaje descriptivo
git commit -m "Sistema mejorado con IA y aprendizaje automático - Fase 1"

# Push a tu repositorio
git push origin main
```

---

### Paso 2: Configurar Variables de Entorno en Vercel

**CRÍTICO:** Debes configurar estas variables ANTES de que funcione:

1. Ve a tu proyecto en Vercel: https://vercel.com/dashboard
2. Selecciona tu proyecto
3. Ve a **Settings** → **Environment Variables**
4. Agrega estas 2 variables:

#### Variable 1: OPENAI_API_KEY
```
Name: OPENAI_API_KEY
Value: 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
Environments: ✅ Production ✅ Preview ✅ Development
```

#### Variable 2: MONGO_URI
```
Name: MONGO_URI
Value: mongodb+srv://comanuel7:Cali198812@calendario.wgpurmj.mongodb.net/sportsline
Environments: ✅ Production ✅ Preview ✅ Development
```

5. Click **Save**

---

### Paso 3: Configurar MongoDB Atlas

**IMPORTANTE:** Permite conexiones desde Vercel

1. Ve a MongoDB Atlas: https://cloud.mongodb.com/
2. Selecciona tu cluster
3. Ve a **Network Access**
4. Click **Add IP Address**
5. Selecciona **Allow Access from Anywhere** (0.0.0.0/0)
   - O agrega las IPs específicas de Vercel
6. Click **Confirm**

---

### Paso 4: Deploy Automático

Vercel detectará el push y hará deploy automáticamente.

Puedes ver el progreso en:
https://vercel.com/dashboard → [tu proyecto] → Deployments

---

### Paso 5: Verificar Deploy

Una vez que el deploy termine (1-2 minutos):

#### 5.1 Página Principal
```
https://tu-proyecto.vercel.app/
```
Debe cargar la página de partidos.

#### 5.2 API de Aprendizaje
```
https://tu-proyecto.vercel.app/api/ai-learning?days=30
```
Debe devolver JSON con tus datos históricos.

#### 5.3 Backtesting
```
https://tu-proyecto.vercel.app/api/backtest?days=30
```
Debe devolver estadísticas.

#### 5.4 Dashboard
```
https://tu-proyecto.vercel.app/backtest-dashboard.html
```
Debe mostrar el dashboard visual.

---

## 🧪 Testing en Producción

### Test 1: Generar Picks

1. Ve a tu URL de producción
2. Espera a que carguen los juegos
3. Haz click en "Comparar pitchers"
4. Verifica que se generan picks

### Test 2: Ver Aprendizaje

```bash
curl https://tu-proyecto.vercel.app/api/ai-learning?days=30
```

Debe devolver:
```json
{
  "ok": true,
  "hasData": true,
  "totalPicks": 208,
  ...
}
```

### Test 3: Dashboard

Abre el dashboard y verifica:
- Win rate se muestra
- ROI se muestra
- Gráficos cargan
- Patrones se identifican

---

## 🚨 Solución de Problemas

### Error: "OPENAI_API_KEY is not defined"

**Solución:**
1. Ve a Vercel → Settings → Environment Variables
2. Verifica que OPENAI_API_KEY está configurada
3. Redeploy: Deployments → [último deploy] → Redeploy

---

### Error: "MONGO_URI is not defined"

**Solución:**
1. Ve a Vercel → Settings → Environment Variables
2. Verifica que MONGO_URI está configurada
3. Redeploy

---

### Error: "MongoServerError: bad auth"

**Solución:**
1. Verifica que el usuario/password en MONGO_URI son correctos
2. Ve a MongoDB Atlas → Database Access
3. Verifica que el usuario existe y tiene permisos

---

### Error: "MongoServerError: IP not whitelisted"

**Solución:**
1. Ve a MongoDB Atlas → Network Access
2. Agrega 0.0.0.0/0 para permitir todas las IPs
3. Espera 1-2 minutos para que se aplique

---

### Error: "Function timeout"

**Solución:**
Si tienes Hobby plan (timeout 10s):
1. Reduce el número de juegos procesados
2. O upgrade a Pro plan (timeout 60s)

---

### Error: "OpenAI API quota exceeded"

**Solución:**
1. Ve a https://platform.openai.com/usage
2. Verifica tu cuota
3. Agrega créditos si es necesario

---

## 📊 Monitoreo Post-Deploy

### Día 1: Verificación Inicial

- [ ] Página principal carga
- [ ] API responde
- [ ] Picks se generan
- [ ] Dashboard funciona
- [ ] No hay errores en Vercel logs

### Semana 1: Monitoreo Activo

- [ ] Revisa logs diariamente
- [ ] Verifica costos de OpenAI
- [ ] Monitorea performance
- [ ] Verifica que el aprendizaje funciona

### Mensual: Optimización

- [ ] Analiza métricas de uso
- [ ] Optimiza funciones lentas
- [ ] Ajusta timeouts si es necesario
- [ ] Revisa costos y optimiza

---

## 💰 Costos Estimados

### Vercel (Hobby Plan - Gratis)
- ✅ Gratis hasta 100 GB bandwidth/mes
- ✅ Gratis hasta 100 GB-hours serverless

### OpenAI (GPT-4o-mini)
- ~$0.001-0.003 por llamada
- Con 100 llamadas/día: ~$3-9/mes
- ✅ Muy económico

### MongoDB Atlas (Free Tier)
- ✅ Gratis hasta 512 MB
- ✅ Suficiente para miles de picks

**Total estimado: $3-9/mes** (solo OpenAI)

---

## 🎯 Próximos Pasos Post-Deploy

### Inmediato:
1. Prueba todas las funcionalidades
2. Verifica que no hay errores
3. Comparte la URL con usuarios

### Primera Semana:
1. Monitorea logs en Vercel
2. Revisa costos de OpenAI
3. Verifica que el aprendizaje funciona
4. Recopila feedback

### Primer Mes:
1. Analiza métricas de uso
2. Optimiza según sea necesario
3. Considera implementar Fase 2
4. Documenta aprendizajes

---

## ✅ Checklist Final

Antes de considerar el deploy completo:

- [ ] Deploy exitoso en Vercel
- [ ] Variables de entorno configuradas
- [ ] MongoDB permite conexiones
- [ ] Página principal carga
- [ ] API de aprendizaje responde
- [ ] Backtesting funciona
- [ ] Dashboard carga
- [ ] Picks se generan correctamente
- [ ] No hay errores en logs
- [ ] Costos monitoreados

---

## 🎉 ¡Felicidades!

Si todos los checks pasaron, tu sistema está:
- ✅ Deployado en producción
- ✅ Funcionando correctamente
- ✅ Aprendiendo de tu historial
- ✅ Listo para mejorar tu win rate

---

**Última actualización:** 7 de abril de 2026  
**Versión:** 1.0.0 - Producción
