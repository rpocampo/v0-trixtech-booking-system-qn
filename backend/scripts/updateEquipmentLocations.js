const mongoose = require('mongoose');
const Service = require('../models/Service');

async function updateEquipmentLocations() {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/trixtech');

    console.log('Finding equipment and supply services...');

    // Find all equipment and supply services
    const equipmentServices = await Service.find({
      serviceType: { $in: ['equipment', 'supply'] }
    });

    console.log(`Found ${equipmentServices.length} equipment/supply services to update`);

    let updatedCount = 0;

    for (const service of equipmentServices) {
      const name = service.name ? service.name.toLowerCase() : '';
      const category = service.category ? service.category.toLowerCase() : '';

      // Equipment that is typically outdoor-only
      const outdoorKeywords = [
        'tent', 'canopy', 'awning', 'outdoor', 'garden', 'patio', 'lawn',
        'barbecue', 'bbq', 'grill', 'fire pit', 'fireplace', 'outdoor furniture',
        'deck', 'porch', 'terrace', 'balcony', 'pool', 'spa', 'jacuzzi',
        'hot tub', 'outdoor lighting', 'string lights', 'lantern', 'torch'
      ];

      // Equipment that is typically indoor-only
      const indoorKeywords = [
        'indoor', 'interior', 'house', 'home', 'room', 'hall', 'theater',
        'auditorium', 'conference room', 'meeting room', 'classroom',
        'kitchen', 'dining room', 'living room', 'bedroom', 'bathroom',
        'office', 'workspace', 'desk', 'chair', 'table', 'sofa', 'couch'
      ];

      // Specific equipment types that are outdoor-only
      const outdoorEquipmentTypes = [
        'tents-canopies', 'outdoor-furniture', 'barbecue-grills',
        'outdoor-lighting', 'pools-spas', 'gardening-tools'
      ];

      // Specific equipment types that are indoor-only
      const indoorEquipmentTypes = [
        'indoor-furniture', 'kitchen-equipment', 'office-equipment',
        'audio-visual', 'stage-lighting', 'sound-systems'
      ];

      let newLocation = 'both'; // Default

      if (outdoorEquipmentTypes.includes(category) || outdoorKeywords.some(keyword =>
        name.includes(keyword) || category.includes(keyword))) {
        newLocation = 'outdoor';
      } else if (indoorEquipmentTypes.includes(category) || indoorKeywords.some(keyword =>
        name.includes(keyword) || category.includes(keyword))) {
        newLocation = 'indoor';
      }

      // Only update if the location would change
      if (service.location !== newLocation) {
        service.location = newLocation;
        await service.save();
        updatedCount++;
        console.log(`Updated "${service.name}" (${service.category}) from "${service.location}" to "${newLocation}"`);
      }
    }

    console.log(`\nUpdate complete! Updated ${updatedCount} out of ${equipmentServices.length} services.`);

    // Show summary of locations
    const locationSummary = await Service.aggregate([
      { $match: { serviceType: { $in: ['equipment', 'supply'] } } },
      { $group: { _id: '$location', count: { $sum: 1 } } }
    ]);

    console.log('\nLocation Summary:');
    locationSummary.forEach(item => {
      console.log(`${item._id}: ${item.count} services`);
    });

  } catch (error) {
    console.error('Error updating equipment locations:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Database connection closed.');
  }
}

// Run the update if this script is executed directly
if (require.main === module) {
  updateEquipmentLocations();
}

module.exports = { updateEquipmentLocations };