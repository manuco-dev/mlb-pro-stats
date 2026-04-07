# 🔧 Fix: Edge Runtime → Node.js Runtime

## Problema

Vercel mostraba este error al hacer deploy:

```
The Edge Function "api/ai-picks-enhanced" is referencing unsupported modules:
- mongodb: net, crypto, child_process, fs/promises, tls, dns, timers/promises, fs, stream, timers, os, process, zlib, mongodb-connection-string-url, url, http
```

## Causa

Las funciones que usan MongoDB estaban configuradas con `export const config = { runtime: 'edge' }`, pero Edge Runtime no soporta módulos de Node.js como MongoDB.

## Solución Aplicada

### 1. Removí `edge` runtime de funciones que usan MongoDB

Archivos modificados:
- `api/ai-picks-enhanced.js` - ❌ Removido `export const config = { runtime: 'edge' }`

### 2. Configuré Node.js runtime en `vercel.json`

```json
{
  "functions": {
    "api/ai-picks-enhanced.js": {
      "runtime": "nodejs20.x",
      "maxDuration": 30
    },
    "api/ai-learning.js": {
      "runtime": "nodejs20.x",
      "maxDuration": 30
    },
    "api/backtest.js": {
      "runtime": "nodejs20.x",
      "maxDuration": 30
    },
    "api/picks-stats.js": {
      "runtime": "nodejs20.x",
      "maxDuration": 30
    },
    "api/picks-sync.js": {
      "runtime": "nodejs20.x",
      "maxDuration": 30
    }
  }
}
```

### 3. Funciones que SÍ usan Edge Runtime (no usan MongoDB)

Estas funciones mantienen `edge` runtime porque son más rápidas:
- `api/ai-picks.js` - Solo hace fetch HTTP
- `api/analyze.js` - Solo procesa datos
- `api/scoreboard.js` - Solo hace fetch a ESPN

## Diferencias entre Edge y Node.js Runtime

| Característica | Edge Runtime | Node.js Runtime |
|---------------|--------------|-----------------|
| Velocidad | ⚡ Más rápido (cold start ~50ms) | 🐢 Más lento (cold start ~200ms) |
| Módulos | ❌ Solo Web APIs | ✅ Todos los módulos de Node.js |
| MongoDB | ❌ No soportado | ✅ Soportado |
| Timeout (Hobby) | 10s | 10s |
| Timeout (Pro) | 30s | 60s |

## Resultado

✅ El deploy ahora funciona correctamente
✅ MongoDB se conecta sin problemas
✅ Las funciones que no necesitan MongoDB siguen siendo rápidas con Edge
✅ Las funciones con MongoDB funcionan con Node.js runtime

## Verificación

```bash
npm run pre-deploy
```

Debe mostrar: `🎉 TODOS LOS CHECKS PASARON`

---

**Fecha del fix:** 7 de abril de 2026
**Archivos modificados:** `api/ai-picks-enhanced.js`, `vercel.json`, `DEPLOY-VERCEL-PASOS.md`
