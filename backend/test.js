// test-db.js
const { MongoClient } = require('mongodb');

const connectionString = 'mongodb+srv://pymich999:Juicewrld999@cluster0.iyruo.mongodb.net/cluster0';

async function testDatabase() {
  let client;
  
  try {
    // Connect
    client = await MongoClient.connect(connectionString);
    console.log('Connected to MongoDB');
    
    // Test write
    const db = client.db();
    const collection = db.collection('test-collection');
    
    const result = await collection.insertOne({
      test: true,
      timestamp: new Date(),
      message: 'Hello from test!'
    });
    
    console.log('✅ Write successful! ID:', result.insertedId);
    
    // Test read
    const found = await collection.findOne({ _id: result.insertedId });
    console.log('✅ Read successful:', found);
    
    // Cleanup
    await collection.deleteOne({ _id: result.insertedId });
    console.log('✅ Cleanup successful');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

testDatabase();