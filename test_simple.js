require('dotenv').config({ path: './backend/.env' });
const mongoose = require('mongoose');
const User = require('./backend/models/User');

async function simpleTest() {
  try {
    console.log('Connecting to MongoDB...');
    console.log('URI:', process.env.MONGODB_URI);
    await mongoose.connect(process.env.MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      bufferCommands: false,
      maxIdleTimeMS: 30000,
      family: 4
    });
    console.log('Connected successfully');

    console.log('Querying users...');
    const users = await User.find({});
    console.log(`Found ${users.length} users`);

    const customers = await User.find({ role: 'customer' });
    console.log(`Found ${customers.length} customers`);

    const admins = await User.find({ role: 'admin' });
    console.log(`Found ${admins.length} admins`);

    console.log('Test passed!');
  } catch (error) {
    console.error('Test failed:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

simpleTest();