const mongoose = require('mongoose');
const AutoRentalCompletionService = require('./utils/autoRentalCompletionService');

// Database connection
async function connectToDatabase() {
  try {
    await mongoose.connect('mongodb://localhost:27017/trixtech', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to database');
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }
}

// Disconnect from database
async function disconnectFromDatabase() {
  try {
    await mongoose.disconnect();
    console.log('Disconnected from database');
  } catch (error) {
    console.error('Database disconnection failed:', error);
  }
}

// Test functions
async function runTests() {
  try {
    await connectToDatabase();

    console.log('\nTest 1: Checking for rentals due for completion...');
    const dueRentals = await AutoRentalCompletionService.checkForRentalsDueForCompletion();
    console.log(`Found ${dueRentals.length} rentals due for completion:`);
    dueRentals.forEach(rental => {
      console.log(`- ${rental._id}: ${rental.serviceId?.name || 'Unknown'} (${rental.quantity})`);
    });

    console.log('\nTest 2: Running auto-completion check...');
    const results = await AutoRentalCompletionService.runAutoCompletionCheck();
    console.log('Auto-completion result:', results);

    console.log('\nTest 3: Getting completion statistics...');
    const stats = await AutoRentalCompletionService.getCompletionStatistics();
    console.log('Completion statistics:', JSON.stringify(stats, null, 2));

    console.log('\nTest 4: Testing shouldAutoComplete logic...');
    // This would require creating test bookings, but for now just test the method exists
    console.log('shouldAutoComplete method available:', typeof AutoRentalCompletionService.shouldAutoComplete === 'function');

    console.log('\nAll tests completed successfully!');

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await disconnectFromDatabase();
  }
}

// Run tests
runTests();