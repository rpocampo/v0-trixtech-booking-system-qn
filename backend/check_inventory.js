const mongoose = require('mongoose');
const Service = require('./models/Service');

async function checkInventory() {
  try {
    await mongoose.connect('mongodb://localhost:27017/trixtech');
    console.log('Connected to MongoDB');

    const allServices = await Service.find({}).select('_id name serviceType quantity includedItems');
    console.log('\nAll Services:');
    allServices.forEach(s => {
      console.log(`${s._id}: ${s.name} (${s.serviceType}) - qty: ${s.quantity || 'N/A'}`);
      if (s.includedItems && s.includedItems.length > 0) {
        console.log(`  Includes: ${s.includedItems.join(', ')}`);
      }
    });

    const equipmentServices = await Service.find({serviceType: 'equipment'}).select('name quantity');
    console.log('\nEquipment Inventory:');
    equipmentServices.forEach(s => console.log(`${s.name}: ${s.quantity}`));

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkInventory();