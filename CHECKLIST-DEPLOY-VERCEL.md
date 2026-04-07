# ✅ Checklist Pre-Deploy a Vercel

## 🔍 Verificación Rápida

### 1. Archivos Críticos

- [x] `vercel.json` - Configuración de Vercel
- [x] `package.json` - Dependencias
- [x] `.gitignore` - Archivos a ignorar
- [x] `.env.example` - Template de variables de entorno
- [x] Todos los archivos API en `/api`

### 2. Variables de Entorno

**IMPORTANTE:** Debes configurar estas variables en Vercel:

```
OPENAI_API_KEY=sk-proj-...
MONGO_URI=mongodb+srv://...
```

**⚠️ NO subas el archivo `.env` a Git** (ya está en .gitignore)

### 3. Archivos que NO deben subirse

Verifica que `.gitignore` incluye:
- [x] `.env`
- [x] `node_modules/`
- [x] `.DS_Store`

---

## 🚀 Pasos para Deploy en Vercel

### Paso 1: Verificar que todo funciona localmente

```bash
npm run diagnostico
```

Debe mostrar: `🎉 TODOS LOS TESTS PASARON`

### Paso 2: Commit y Push a Git

```bash
git add .
git commit -m "Sistema mejorado con IA y aprendizaje automático"
git push origin main
```

### Paso 3: Configurar Variables de Entorno en Vercel

1. Ve a tu proyecto en Vercel
2. Settings → Environment Variables
3. Agrega:
   - `OPENAI_API_KEY` = tu key de OpenAI
   - `MONGO_URI` = tu URI de MongoDB

### Paso 4: Deploy

Vercel hará deploy automáticamente cuando hagas push.

O manualmente:
```bash
vercel --prod
```

---

## ⚠️ Consideraciones Importantes

### 1. Runtime de Edge vs Node.js

Algunos archivos usan `export const config = { runtime: 'edge' };`

**Archivos con Edge Runtime:**
- `api/ai-picks.js`
- `api/ai-picks-enhanced.js`
- `api/analyze.js`

**Archivos con Node.js Runtime (por MongoDB):**
- `api/backtest.js`
- `api/ai-learning.js`
- `api/picks-stats.js`
- `api/picks-sync.js`
- `api/team-strikeouts.js`

✅ Esto está bien configurado.

### 2. Límites de Vercel

**Hobby Plan:**
- Timeout: 10 segundos por request
- Memoria: 1024 MB
- Bandwidth: 100 GB/mes

**Pro Plan:**
- Timeout: 60 segundos
- Memoria: 3008 MB
- Bandwidth: 1 TB/mes

⚠️ Si tienes Hobby plan y las llamadas a OpenAI tardan >10s, considera:
- Reducir el número de juegos procesados
- Usar Pro plan

### 3. Costos de OpenAI

Cada llamada a `/api/ai-picks-enhanced`:
- Usa GPT-4o-mini
- Costo aproximado: $0.001-0.003 por llamada
- Con 100 llamadas/día: ~$0.10-0.30/día

✅ Muy económico

---

## 🔧 Ajustes Recomendados para Producción

### 1. Agregar Rate Limiting (Opcional)

Para evitar abuso, considera agregar rate limiting en Vercel:

```javascript
// En vercel.json
{
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "X-RateLimit-Limit",
          "value": "100"
        }
      ]
    }
  ]
}
```

### 2. Habilitar CORS si es necesario

Si vas a llamar la API desde otro dominio:

```javascript
// En cada archivo API, agregar headers CORS
headers: {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
}
```

### 3. Logging y Monitoreo

Vercel tiene logs integrados. Para ver errores:
1. Ve a tu proyecto en Vercel
2. Deployments → [tu deploy] → Functions
3. Revisa logs de cada función

---

## 🧪 Testing Post-Deploy

Una vez deployado, prueba:

### 1. Página principal
```
https://tu-proyecto.vercel.app/
```

### 2. API de aprendizaje
```
https://tu-proyecto.vercel.app/api/ai-learning?days=30
```

### 3. Backtesting
```
https://tu-proyecto.vercel.app/api/backtest?days=30
```

### 4. Dashboard
```
https://tu-proyecto.vercel.app/backtest-dashboard.html
```

---

## 🚨 Problemas Comunes en Vercel

### Problema 1: "Module not found"
**Causa:** Dependencia faltante en package.json

**Solución:**
```bash
npm install
# Verifica que package.json tiene todas las dependencias
```

### Problema 2: "Function timeout"
**Causa:** Función tarda >10s (Hobby plan)

**Solución:**
- Reduce el número de juegos procesados
- Upgrade a Pro plan
- Optimiza el código

### Problema 3: "Environment variable not found"
**Causa:** Variables no configuradas en Vercel

**Solución:**
1. Settings → Environment Variables
2. Agrega OPENAI_API_KEY y MONGO_URI
3. Redeploy

### Problema 4: "MongoDB connection failed"
**Causa:** IP de Vercel no está en whitelist de MongoDB

**Solución:**
1. Ve a MongoDB Atlas
2. Network Access
3. Agrega `0.0.0.0/0` (permite todas las IPs)
   O específicamente las IPs de Vercel

---

## 📊 Monitoreo Post-Deploy

### Métricas a vigilar:

1. **Errores en Functions**
   - Ve a Vercel → Functions → Errors
   - Debe ser 0 o muy bajo

2. **Tiempo de respuesta**
   - Ve a Vercel → Analytics
   - Debe ser <3s para la mayoría

3. **Uso de OpenAI**
   - Ve a OpenAI → Usage
   - Monitorea costos diarios

4. **Uso de MongoDB**
   - Ve a MongoDB Atlas → Metrics
   - Monitorea conexiones y queries

---

## ✅ Checklist Final Pre-Deploy

Antes de hacer push:

- [ ] `npm run diagnostico` pasa todos los tests
- [ ] `.env` está en `.gitignore`
- [ ] `vercel.json` está configurado
- [ ] `package.json` tiene todas las dependencias
- [ ] Variables de entorno listas para Vercel
- [ ] MongoDB permite conexiones desde cualquier IP
- [ ] OpenAI API key tiene créditos suficientes
- [ ] Código commiteado a Git
- [ ] README actualizado

---

## 🎯 Después del Deploy

### Inmediatamente:
1. Prueba la URL de producción
2. Verifica que la página principal carga
3. Prueba generar picks
4. Revisa logs en Vercel

### Primer día:
1. Monitorea errores en Vercel
2. Verifica que OpenAI responde
3. Confirma que MongoDB conecta
4. Prueba todas las páginas

### Primera semana:
1. Revisa costos de OpenAI
2. Monitorea performance
3. Verifica que el aprendizaje funciona
4. Ajusta según sea necesario

---

## 🆘 Soporte

Si algo falla en producción:

1. **Revisa logs de Vercel:**
   Deployments → [tu deploy] → Functions → [función con error]

2. **Verifica variables de entorno:**
   Settings → Environment Variables

3. **Prueba endpoints individualmente:**
   ```bash
   curl https://tu-proyecto.vercel.app/api/ai-learning?days=7
   ```

4. **Rollback si es necesario:**
   Deployments → [deploy anterior] → Promote to Production

---

**Última actualización:** 7 de abril de 2026  
**Versión:** 1.0.0 - Listo para Producción
