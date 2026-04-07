# 🔧 Fix: Edge Runtime → Node.js Runtime

## Problema Original

Vercel mostraba este error al hacer deploy:

```
The Edge Function "api/ai-picks-enhanced" is referencing unsupported modules:
- mongodb: net, crypto, child_process, fs/promises, tls, dns, timers/promises, fs, stream, timers, os, process, zlib, mongodb-connection-string-url, url, http
```

## Problema Secundario

Al intentar especificar `"runtime": "nodejs20.x"` en vercel.json:

```
Function Runtimes must have a valid version, for example `now-php@1.0.0`
```

## Causa

1. Las funciones que usan MongoDB estaban configuradas con `export const config = { runtime: 'edge' }`, pero Edge Runtime no soporta módulos de Node.js como MongoDB.

2. Vercel no acepta la sintaxis `"runtime": "nodejs20.x"` en vercel.json. El runtime de Node.js es el predeterminado y no necesita especificarse.

## Solución Final Aplicada

### 1. Removí TODOS los `export const config = { runtime: 'edge' }` 

Archivos modificados:
- `api/ai-picks-enhanced.js` - ❌ Removido edge runtime
- `api/ai-picks.js` - ❌ Removido edge runtime
- `api/analyze.js` - ❌ Removido edge runtime

### 2. Simplifiqué `vercel.json` (sin especificar runtime)

```json
{
  "functions": {
    "api/**/*.js": {
      "maxDuration": 30
    }
  }
}
```

Vercel usa Node.js runtime por defecto para todas las funciones en `/api`.

## Resultado

✅ Todas las funciones usan Node.js runtime (predeterminado)
✅ MongoDB funciona correctamente
✅ Timeout de 30 segundos para todas las funciones API
✅ No hay errores de runtime

## Diferencias entre Edge y Node.js Runtime

| Característica | Edge Runtime | Node.js Runtime |
|---------------|--------------|-----------------|
| Velocidad | ⚡ Más rápido (cold start ~50ms) | 🐢 Más lento (cold start ~200ms) |
| Módulos | ❌ Solo Web APIs | ✅ Todos los módulos de Node.js |
| MongoDB | ❌ No soportado | ✅ Soportado |
| Timeout (Hobby) | 10s | 10s |
| Timeout (Pro) | 30s | 60s |
| Configuración | `export const config = { runtime: 'edge' }` | Predeterminado (no requiere config) |

## Verificación

```bash
npm run pre-deploy
```

Debe mostrar: `🎉 TODOS LOS CHECKS PASARON`

---

**Fecha del fix:** 7 de abril de 2026  
**Archivos modificados:** `api/ai-picks-enhanced.js`, `api/ai-picks.js`, `api/analyze.js`, `vercel.json`
