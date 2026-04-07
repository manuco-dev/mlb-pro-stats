#!/usr/bin/env node

/**
 * Script para verificar qué datos históricos hay en MongoDB
 */

import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { getDb } from './api/_mongo.js';

// Cargar variables de entorno
async function loadEnv() {
  const envPath = '.env';
  if (!existsSync(envPath)) return;
  const raw = await readFile(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (key && !(key in process.env)) process.env[key] = value;
  }
}

async function checkDatabase() {
  await loadEnv();
  console.log('🔍 Verificando datos en MongoDB...\n');

  try {
    const db = await getDb();
    const collection = db.collection('picks');

    // Contar total de documentos
    const totalGames = await collection.countDocuments();
    console.log(`📊 Total de juegos en la base de datos: ${totalGames}`);

    if (totalGames === 0) {
      console.log('\n⚠️  No hay datos en la colección "picks"');
      console.log('   Verifica que:');
      console.log('   1. La colección se llama "picks"');
      console.log('   2. Tienes datos guardados en MongoDB');
      console.log('   3. La conexión MONGO_URI es correcta\n');
      
      // Listar todas las colecciones
      const collections = await db.listCollections().toArray();
      console.log('📁 Colecciones disponibles en la base de datos:');
      collections.forEach(col => {
        console.log(`   - ${col.name}`);
      });
      
      process.exit(0);
    }

    // Obtener un documento de ejemplo
    const sampleGame = await collection.findOne();
    console.log('\n📄 Estructura de un documento de ejemplo:');
    console.log(JSON.stringify(sampleGame, null, 2));

    // Contar picks por resultado
    const pipeline = [
      { $unwind: '$results' },
      { $group: {
        _id: '$results.result',
        count: { $sum: 1 }
      }}
    ];
    
    const resultStats = await collection.aggregate(pipeline).toArray();
    console.log('\n📈 Estadísticas de picks por resultado:');
    let totalPicks = 0;
    resultStats.forEach(stat => {
      console.log(`   ${stat._id || 'sin resultado'}: ${stat.count} picks`);
      totalPicks += stat.count;
    });
    console.log(`   TOTAL: ${totalPicks} picks`);

    // Contar picks por mercado
    const marketPipeline = [
      { $unwind: '$results' },
      { $group: {
        _id: '$results.market',
        count: { $sum: 1 }
      }}
    ];
    
    const marketStats = await collection.aggregate(marketPipeline).toArray();
    console.log('\n🎯 Picks por mercado:');
    marketStats.forEach(stat => {
      console.log(`   ${stat._id || 'sin mercado'}: ${stat.count} picks`);
    });

    // Rango de fechas
    const oldestGame = await collection.findOne({}, { sort: { dateKey: 1 } });
    const newestGame = await collection.findOne({}, { sort: { dateKey: -1 } });
    
    console.log('\n📅 Rango de fechas:');
    console.log(`   Más antiguo: ${oldestGame?.dateKey || 'N/A'}`);
    console.log(`   Más reciente: ${newestGame?.dateKey || 'N/A'}`);

    // Verificar si hay picks evaluados (graded)
    const gradedPipeline = [
      { $unwind: '$results' },
      { $match: { 'results.result': { $ne: 'ungraded' } } },
      { $count: 'total' }
    ];
    
    const gradedResult = await collection.aggregate(gradedPipeline).toArray();
    const gradedCount = gradedResult[0]?.total || 0;
    
    console.log('\n✅ Picks evaluados (con resultado):');
    console.log(`   ${gradedCount} picks evaluados`);
    console.log(`   ${totalPicks - gradedCount} picks pendientes`);

    if (gradedCount >= 50) {
      console.log('\n🎉 ¡Tienes suficientes datos para el sistema de aprendizaje!');
      console.log('   El sistema puede empezar a aprender de estos picks.');
    } else if (gradedCount > 0) {
      console.log('\n⚠️  Tienes algunos datos, pero se recomienda al menos 50 picks evaluados');
      console.log(`   Actualmente: ${gradedCount} picks evaluados`);
      console.log(`   Faltan: ${50 - gradedCount} picks más`);
    } else {
      console.log('\n⚠️  No hay picks evaluados todavía');
      console.log('   Los picks necesitan tener resultado (win/loss/push) para aprender');
    }

    console.log('\n✨ Verificación completada\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('\nVerifica que:');
    console.error('1. MongoDB está corriendo');
    console.error('2. MONGO_URI en .env es correcta');
    console.error('3. Tienes permisos de lectura en la base de datos\n');
    process.exit(1);
  }
}

checkDatabase();
