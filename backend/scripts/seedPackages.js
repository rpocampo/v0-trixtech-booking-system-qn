const mongoose = require('mongoose');
const Package = require('../models/Package');
const Service = require('../models/Service');

async function seedPackages() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/trixtech');

    console.log('🌱 Seeding packages...');

    // Get some existing services for inclusions
    const services = await Service.find({ isAvailable: true }).limit(10);

    if (services.length === 0) {
      console.log('No services found. Please seed services first.');
      return;
    }

    // Sample packages
    const packages = [
      {
        name: 'Basic Event Package',
        description: 'Perfect for small gatherings and intimate events. Includes essential furniture and basic setup.',
        shortDescription: 'Essential setup for small events',
        category: 'basic',
        eventTypes: ['birthday', 'graduation', 'party'],
        basePrice: 2500,
        inclusions: [
          {
            serviceId: services.find(s => s.category === 'furniture')?._id || services[0]._id,
            name: 'Event Chairs',
            quantity: 10,
            category: 'furniture',
            description: 'Comfortable seating for guests',
            isRequired: true,
            price: 200
          },
          {
            serviceId: services.find(s => s.category === 'furniture')?._id || services[0]._id,
            name: 'Event Table',
            quantity: 2,
            category: 'furniture',
            description: 'Tables for food and decorations',
            isRequired: true,
            price: 400
          }
        ],
        deliveryIncluded: true,
        deliveryFee: 500,
        minGuests: 10,
        maxGuests: 50,
        duration: 4,
        isActive: true,
        isPopular: true,
        priority: 10,
        tags: ['small', 'intimate', 'essential'],
        requirements: ['Venue must be accessible for delivery truck']
      },
      {
        name: 'Premium Wedding Package',
        description: 'Complete wedding setup with premium furniture, linens, and decorations for your special day.',
        shortDescription: 'Complete premium wedding setup',
        category: 'premium',
        eventTypes: ['wedding'],
        basePrice: 15000,
        inclusions: [
          {
            serviceId: services.find(s => s.category === 'furniture')?._id || services[0]._id,
            name: 'Premium Chairs',
            quantity: 100,
            category: 'furniture',
            description: 'Elegant upholstered chairs',
            isRequired: true,
            price: 2000
          },
          {
            serviceId: services.find(s => s.category === 'furniture')?._id || services[0]._id,
            name: 'Banquet Tables',
            quantity: 20,
            category: 'furniture',
            description: 'Round banquet tables with linens',
            isRequired: true,
            price: 4000
          }
        ],
        addOns: [
          {
            serviceId: services.find(s => s.category === 'decoration')?._id || services[0]._id,
            name: 'Floral Centerpieces',
            quantity: 20,
            category: 'decoration',
            description: 'Beautiful floral arrangements',
            price: 1500,
            isPopular: true
          }
        ],
        deliveryIncluded: true,
        deliveryFee: 1000,
        setupFee: 2000,
        discountPercentage: 5,
        minGuests: 50,
        maxGuests: 200,
        duration: 8,
        isActive: true,
        isPopular: true,
        priority: 20,
        tags: ['wedding', 'premium', 'complete'],
        requirements: ['Full day access required', 'Power supply for lighting']
      },
      {
        name: 'Corporate Conference Package',
        description: 'Professional setup for corporate events, conferences, and business meetings.',
        shortDescription: 'Professional corporate event setup',
        category: 'premium',
        eventTypes: ['corporate', 'conference'],
        basePrice: 8000,
        inclusions: [
          {
            serviceId: services.find(s => s.category === 'furniture')?._id || services[0]._id,
            name: 'Conference Chairs',
            quantity: 50,
            category: 'furniture',
            description: 'Ergonomic conference seating',
            isRequired: true,
            price: 1500
          },
          {
            serviceId: services.find(s => s.category === 'furniture')?._id || services[0]._id,
            name: 'Conference Tables',
            quantity: 10,
            category: 'furniture',
            description: 'Modular conference tables',
            isRequired: true,
            price: 2000
          }
        ],
        deliveryIncluded: true,
        deliveryFee: 800,
        minGuests: 20,
        maxGuests: 100,
        duration: 6,
        isActive: true,
        priority: 15,
        tags: ['corporate', 'professional', 'conference'],
        requirements: ['AV equipment access', 'High-speed internet']
      },
      {
        name: 'Deluxe Birthday Package',
        description: 'Make your birthday celebration unforgettable with our deluxe party package.',
        shortDescription: 'Unforgettable birthday celebration',
        category: 'deluxe',
        eventTypes: ['birthday', 'party'],
        basePrice: 5000,
        inclusions: [
          {
            serviceId: services.find(s => s.category === 'furniture')?._id || services[0]._id,
            name: 'Party Chairs',
            quantity: 30,
            category: 'furniture',
            description: 'Colorful party seating',
            isRequired: true,
            price: 600
          },
          {
            serviceId: services.find(s => s.category === 'party-supplies')?._id || services[0]._id,
            name: 'Party Decorations',
            quantity: 1,
            category: 'party-supplies',
            description: 'Complete party decoration set',
            isRequired: true,
            price: 800
          }
        ],
        addOns: [
          {
            serviceId: services.find(s => s.category === 'entertainment')?._id || services[0]._id,
            name: 'Sound System',
            quantity: 1,
            category: 'entertainment',
            description: 'Professional sound system',
            price: 1000,
            isPopular: true
          }
        ],
        deliveryIncluded: true,
        deliveryFee: 600,
        minGuests: 15,
        maxGuests: 80,
        duration: 5,
        isActive: true,
        isPopular: true,
        priority: 12,
        tags: ['birthday', 'party', 'fun'],
        requirements: ['Outdoor space preferred', 'Power access for entertainment']
      }
    ];

    // Insert packages
    for (const packageData of packages) {
      const existingPackage = await Package.findOne({ name: packageData.name });
      if (!existingPackage) {
        const pkg = new Package(packageData);
        await pkg.save();
        console.log(`✅ Created package: ${packageData.name}`);
      } else {
        console.log(`⏭️ Package already exists: ${packageData.name}`);
      }
    }

    console.log('🎉 Package seeding completed!');

  } catch (error) {
    console.error('❌ Error seeding packages:', error);
  } finally {
    await mongoose.disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  seedPackages();
}

module.exports = seedPackages;