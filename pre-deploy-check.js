#!/usr/bin/env node

/**
 * Verificación pre-deploy para Vercel
 */

import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

console.log('🔍 VERIFICACIÓN PRE-DEPLOY A VERCEL\n');
console.log('═'.repeat(60) + '\n');

let allChecksPass = true;

// CHECK 1: Archivos críticos
console.log('📁 CHECK 1: Archivos críticos');
const criticalFiles = [
  'vercel.json',
  'package.json',
  '.gitignore',
  '.env.example',
  'api/ai-picks-enhanced.js',
  'api/ai-learning.js',
  'api/backtest.js',
  'index.html'
];

for (const file of criticalFiles) {
  if (existsSync(file)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - FALTA`);
    allChecksPass = false;
  }
}
console.log('');

// CHECK 2: .env NO debe estar en Git
console.log('🔒 CHECK 2: Seguridad');
const gitignore = readFileSync('.gitignore', 'utf8');
if (gitignore.includes('.env')) {
  console.log('✅ .env está en .gitignore');
} else {
  console.log('❌ .env NO está en .gitignore - PELIGRO');
  allChecksPass = false;
}

if (existsSync('.env')) {
  console.log('⚠️  .env existe localmente (normal)');
  console.log('   IMPORTANTE: Configura variables en Vercel');
} else {
  console.log('⚠️  .env no existe (usa .env.example como referencia)');
}
console.log('');

// CHECK 3: package.json tiene dependencias
console.log('📦 CHECK 3: Dependencias');
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
if (pkg.dependencies && Object.keys(pkg.dependencies).length > 0) {
  console.log('✅ Dependencias encontradas:');
  for (const [dep, version] of Object.entries(pkg.dependencies)) {
    console.log(`   - ${dep}: ${version}`);
  }
} else {
  console.log('❌ No hay dependencias en package.json');
  allChecksPass = false;
}
console.log('');

// CHECK 4: vercel.json configurado
console.log('⚙️  CHECK 4: Configuración de Vercel');
const vercelConfig = JSON.parse(readFileSync('vercel.json', 'utf8'));
if (vercelConfig.rewrites && vercelConfig.rewrites.length > 0) {
  console.log('✅ Rewrites configurados');
} else {
  console.log('⚠️  No hay rewrites configurados');
}

if (vercelConfig.functions) {
  console.log('✅ Timeouts configurados para funciones');
} else {
  console.log('⚠️  No hay timeouts configurados (usará defaults)');
}
console.log('');

// CHECK 5: Variables de entorno necesarias
console.log('🔑 CHECK 5: Variables de entorno');
console.log('Debes configurar en Vercel:');
console.log('   1. OPENAI_API_KEY');
console.log('   2. MONGO_URI');
console.log('');
console.log('Pasos:');
console.log('   1. Ve a tu proyecto en Vercel');
console.log('   2. Settings → Environment Variables');
console.log('   3. Agrega ambas variables');
console.log('   4. Aplica a Production, Preview y Development');
console.log('');

// CHECK 6: Archivos API tienen export default
console.log('🔌 CHECK 6: Exports de API');
const apiFiles = [
  'api/ai-picks-enhanced.js',
  'api/ai-learning.js',
  'api/backtest.js',
  'api/scoreboard.js'
];

for (const file of apiFiles) {
  if (existsSync(file)) {
    const content = readFileSync(file, 'utf8');
    if (content.includes('export default')) {
      console.log(`✅ ${file}`);
    } else {
      console.log(`❌ ${file} - No tiene export default`);
      allChecksPass = false;
    }
  }
}
console.log('');

// CHECK 7: MongoDB whitelist
console.log('🌐 CHECK 7: MongoDB Network Access');
console.log('⚠️  IMPORTANTE: Configura MongoDB Atlas');
console.log('   1. Ve a MongoDB Atlas');
console.log('   2. Network Access');
console.log('   3. Agrega 0.0.0.0/0 (permite todas las IPs)');
console.log('   O específicamente las IPs de Vercel');
console.log('');

// RESUMEN
console.log('═'.repeat(60));
console.log('\n📋 RESUMEN\n');

if (allChecksPass) {
  console.log('🎉 TODOS LOS CHECKS PASARON\n');
  console.log('✅ Archivos críticos presentes');
  console.log('✅ .env en .gitignore');
  console.log('✅ Dependencias configuradas');
  console.log('✅ Exports correctos\n');
  
  console.log('🚀 LISTO PARA DEPLOY\n');
  console.log('Próximos pasos:');
  console.log('   1. git add .');
  console.log('   2. git commit -m "Sistema mejorado con IA"');
  console.log('   3. git push origin main');
  console.log('   4. Configura variables en Vercel');
  console.log('   5. Vercel hará deploy automáticamente\n');
  
  console.log('⚠️  NO OLVIDES:');
  console.log('   - Configurar OPENAI_API_KEY en Vercel');
  console.log('   - Configurar MONGO_URI en Vercel');
  console.log('   - Permitir IPs de Vercel en MongoDB Atlas\n');
  
} else {
  console.log('⚠️  ALGUNOS CHECKS FALLARON\n');
  console.log('Revisa los errores arriba antes de hacer deploy.\n');
  process.exit(1);
}

console.log('═'.repeat(60) + '\n');
