import { MongoClient } from 'mongodb';

let clientPromise;

function getClient() {
  if (!clientPromise) {
    const uri = process.env.MONGO_URI;
    if (!uri) throw new Error('MONGO_URI no configurada');
    const client = new MongoClient(uri);
    clientPromise = client.connect();
  }
  return clientPromise;
}

export async function getDb() {
  const client = await getClient();
  return client.db();
}
