const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('../models/User');
const Service = require('../models/Service');

async function seedDatabase() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/trixtech');
    console.log('Connected to MongoDB');

    // Clear existing data
    await User.deleteMany({});
    await Service.deleteMany({});
    console.log('Cleared existing data');

    // Create admin user
    const adminUser = new User({
      name: 'Admin User',
      email: 'admin@trixtech.com',
      password: 'admin123',
      role: 'admin',
      phone: '+1 (555) 000-0001',
      address: '123 Admin Street, Admin City',
    });
    await adminUser.save();
    console.log('Admin user created');

    // Create sample customer
    const customerUser = new User({
      name: 'Sample Customer',
      email: 'customer@trixtech.com',
      password: 'customer123',
      role: 'customer',
      phone: '+1 (555) 000-0002',
      address: '456 Customer Ave, Customer Town',
    });
    await customerUser.save();
    console.log('Sample customer created');

    // Create comprehensive inventory services
    const services = [
      // Supply Items (Equipment/Supplies)
      {
        name: 'Balloon Garland Set',
        description: 'Beautiful balloon garlands for event decoration - perfect for parties and celebrations',
        category: 'party-supplies',
        serviceType: 'supply',
        price: 1200,
        priceType: 'flat-rate',
        image: 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=400&h=300&fit=crop',
        isAvailable: true,
        quantity: 10,
        tags: ['balloons', 'decoration', 'party'],
        features: ['Color coordinated', 'Professional setup', 'Weather resistant'],
      },
      {
        name: 'Backdrop Stand',
        description: 'Professional backdrop stand for photo areas and event staging',
        category: 'photography',
        serviceType: 'equipment',
        price: 800,
        priceType: 'flat-rate',
        image: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=400&h=300&fit=crop',
        isAvailable: true,
        quantity: 8,
        tags: ['backdrop', 'photo', 'staging'],
        features: ['Adjustable height', 'Sturdy construction', 'Easy setup'],
      },
      {
        name: 'Fairy Lights / LED String',
        description: 'Beautiful LED string lights, 5 meters per strand for ambient lighting',
        category: 'lighting',
        serviceType: 'supply',
        price: 500,
        priceType: 'flat-rate',
        image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=400&h=300&fit=crop',
        isAvailable: true,
        quantity: 15,
        tags: ['lighting', 'LED', 'ambient'],
        features: ['Battery operated', 'Multiple colors', 'Weatherproof'],
      },
      {
        name: 'Plastic Monoblock Chairs',
        description: 'Comfortable plastic monoblock chairs for outdoor and indoor events',
        category: 'furniture',
        serviceType: 'equipment',
        price: 50,
        priceType: 'flat-rate',
        image: 'https://images.unsplash.com/photo-1506439773649-6e0eb8cfb237?w=400&h=300&fit=crop',
        isAvailable: true,
        quantity: 100,
        tags: ['chairs', 'seating', 'plastic'],
        features: ['Stackable', 'Weather resistant', 'Comfortable design'],
      },
      {
        name: 'Round Event Tables',
        description: 'Round tables perfect for events, banquets, and gatherings',
        category: 'furniture',
        serviceType: 'equipment',
        price: 300,
        priceType: 'flat-rate',
        image: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400&h=300&fit=crop',
        isAvailable: true,
        quantity: 25,
        tags: ['tables', 'round', 'event'],
        features: ['Foldable', 'Easy to clean', 'Sturdy construction'],
      },
      {
        name: 'Table Linens (Assorted)',
        description: 'Elegant table linens in various colors and sizes for event decoration',
        category: 'linens-tableware',
        serviceType: 'supply',
        price: 250,
        priceType: 'flat-rate',
        image: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=300&fit=crop',
        isAvailable: true,
        quantity: 50,
        tags: ['linens', 'tablecloths', 'decoration'],
        features: ['Multiple colors', 'Easy care', 'Professional quality'],
      },
      {
        name: 'Chafing Dishes',
        description: 'Professional chafing dishes for buffet-style catering and food service',
        category: 'catering',
        serviceType: 'equipment',
        price: 1000,
        priceType: 'flat-rate',
        image: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&h=300&fit=crop',
        isAvailable: true,
        quantity: 12,
        tags: ['catering', 'food service', 'buffet'],
        features: ['Fuel included', 'Professional grade', 'Easy to use'],
      },
      {
        name: 'Disposable Plates & Utensils',
        description: 'Complete disposable dinnerware sets - 50 sets per package',
        category: 'linens-tableware',
        serviceType: 'supply',
        price: 300,
        priceType: 'flat-rate',
        image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=300&fit=crop',
        isAvailable: true,
        quantity: 20,
        tags: ['disposable', 'dinnerware', 'utensils'],
        features: ['Eco-friendly options', 'Complete sets', 'Bulk packaging'],
      },
      {
        name: 'Sound System Set',
        description: 'Complete sound system setup with speakers, mixer, and microphones',
        category: 'sound-system',
        serviceType: 'equipment',
        price: 3000,
        priceType: 'flat-rate',
        image: 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=400&h=300&fit=crop',
        isAvailable: true,
        quantity: 3,
        tags: ['sound', 'audio', 'PA system'],
        features: ['Wireless microphones', 'Bluetooth connectivity', 'Professional setup'],
      },
      {
        name: 'Photo Booth Props',
        description: 'Fun photo booth props and accessories for event entertainment',
        category: 'party-supplies',
        serviceType: 'supply',
        price: 1000,
        priceType: 'flat-rate',
        image: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=400&h=300&fit=crop',
        isAvailable: true,
        quantity: 5,
        tags: ['photo booth', 'props', 'entertainment'],
        features: ['Themed props', 'High quality', 'Reusable'],
      },
      {
        name: 'Tent / Canopy (10x10)',
        description: 'Large 10x10 foot tent/canopy for outdoor event coverage',
        category: 'tents-canopies',
        serviceType: 'equipment',
        price: 2500,
        priceType: 'flat-rate',
        image: 'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=400&h=300&fit=crop',
        isAvailable: true,
        quantity: 6,
        tags: ['tent', 'canopy', 'outdoor'],
        features: ['Weather resistant', 'Easy setup', 'Secure anchoring'],
      },
      {
        name: 'Party Banners',
        description: 'Custom and themed party banners for event decoration',
        category: 'party-supplies',
        serviceType: 'supply',
        price: 400,
        priceType: 'flat-rate',
        image: 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=400&h=300&fit=crop',
        isAvailable: true,
        quantity: 15,
        tags: ['banners', 'decoration', 'party'],
        features: ['Customizable', 'Weatherproof', 'Professional printing'],
      },
      {
        name: 'Inflatable Number Balloons',
        description: 'Large inflatable number balloons for birthday and anniversary celebrations',
        category: 'party-supplies',
        serviceType: 'supply',
        price: 200,
        priceType: 'flat-rate',
        image: 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=400&h=300&fit=crop',
        isAvailable: true,
        quantity: 20,
        tags: ['balloons', 'inflatable', 'birthday'],
        features: ['Self-inflating', 'Reusable', 'Various sizes'],
      },
      {
        name: 'Projector + Screen',
        description: 'Professional projector and screen setup for presentations and events',
        category: 'other',
        serviceType: 'equipment',
        price: 2000,
        priceType: 'flat-rate',
        image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=400&h=300&fit=crop',
        isAvailable: true,
        quantity: 4,
        tags: ['projector', 'screen', 'presentation'],
        features: ['HD quality', 'Wireless connectivity', 'Professional setup'],
      },
      {
        name: 'Centerpiece Decorations',
        description: 'Elegant centerpiece decorations for tables at events and banquets',
        category: 'decoration',
        serviceType: 'supply',
        price: 500,
        priceType: 'flat-rate',
        image: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=400&h=300&fit=crop',
        isAvailable: true,
        quantity: 30,
        tags: ['centerpieces', 'decoration', 'table'],
        features: ['Themed designs', 'High quality', 'Customizable'],
      },

      // Services
      {
        name: 'Full Event Planning',
        description: 'Complete end-to-end event planning and coordination service',
        category: 'event-planning',
        serviceType: 'service',
        price: 15000,
        priceType: 'flat-rate',
        duration: 480, // 8 hours
        image: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=400&h=300&fit=crop',
        isAvailable: true,
        tags: ['planning', 'coordination', 'full-service'],
        features: ['Venue selection', 'Vendor coordination', 'Timeline management', 'On-site supervision'],
      },
      {
        name: 'Kiddie Party Hosting',
        description: 'Fun and engaging hosting service specifically designed for children\'s parties',
        category: 'birthday',
        serviceType: 'service',
        price: 4000,
        priceType: 'flat-rate',
        duration: 180, // 3 hours
        image: 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=400&h=300&fit=crop',
        isAvailable: true,
        tags: ['kids', 'hosting', 'entertainment'],
        features: ['Games and activities', 'Party supervision', 'Photo opportunities', 'Safety management'],
      },
      {
        name: 'Photo Booth Service',
        description: 'Professional photo booth setup with props and instant printing (4 hours)',
        category: 'photography',
        serviceType: 'service',
        price: 5000,
        priceType: 'flat-rate',
        duration: 240, // 4 hours
        image: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=400&h=300&fit=crop',
        isAvailable: true,
        tags: ['photo booth', 'photography', 'entertainment'],
        features: ['Professional camera', 'Instant printing', 'Themed props', 'Online gallery'],
      },
      {
        name: 'Catering (Buffet)',
        description: 'Professional buffet-style catering service with customized menus',
        category: 'catering',
        serviceType: 'service',
        price: 350,
        priceType: 'per-person',
        duration: 180, // 3 hours
        minOrder: 20,
        image: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&h=300&fit=crop',
        isAvailable: true,
        tags: ['catering', 'food', 'buffet'],
        features: ['Customized menus', 'Dietary accommodations', 'Professional service', 'Setup and cleanup'],
      },
      {
        name: 'Dessert Buffet Setup',
        description: 'Elegant dessert buffet arrangement with variety of sweet treats and pastries',
        category: 'catering',
        serviceType: 'service',
        price: 10000,
        priceType: 'flat-rate',
        duration: 120, // 2 hours
        image: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&h=300&fit=crop',
        isAvailable: true,
        tags: ['dessert', 'buffet', 'sweets'],
        features: ['Variety of desserts', 'Elegant presentation', 'Dietary options', 'Professional setup'],
      },
      {
        name: 'Grazing Table Arrangement',
        description: 'Beautiful grazing table setup with cheeses, fruits, and gourmet snacks',
        category: 'catering',
        serviceType: 'service',
        price: 8000,
        priceType: 'flat-rate',
        duration: 120, // 2 hours
        image: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&h=300&fit=crop',
        isAvailable: true,
        tags: ['grazing table', 'snacks', 'gourmet'],
        features: ['Artistic arrangement', 'Fresh ingredients', 'Variety of options', 'Professional styling'],
      },
      {
        name: 'Balloon Decoration Service',
        description: 'Professional balloon decoration and arrangement service for events',
        category: 'decoration',
        serviceType: 'service',
        price: 5000,
        priceType: 'flat-rate',
        duration: 180, // 3 hours
        image: 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=400&h=300&fit=crop',
        isAvailable: true,
        tags: ['balloons', 'decoration', 'setup'],
        features: ['Custom designs', 'Professional setup', 'Color coordination', 'Cleanup included'],
      },
      {
        name: 'On-the-Day Coordination',
        description: 'Professional event coordination service for the day of your event',
        category: 'event-planning',
        serviceType: 'service',
        price: 6000,
        priceType: 'flat-rate',
        duration: 480, // 8 hours
        image: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=400&h=300&fit=crop',
        isAvailable: true,
        tags: ['coordination', 'day-of', 'management'],
        features: ['Timeline management', 'Vendor coordination', 'Guest management', 'Problem solving'],
      },
      {
        name: 'Professional Photography',
        description: 'Professional event photography service with high-quality images (6 hours)',
        category: 'photography',
        serviceType: 'service',
        price: 8000,
        priceType: 'flat-rate',
        duration: 360, // 6 hours
        image: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=400&h=300&fit=crop',
        isAvailable: true,
        tags: ['photography', 'professional', 'event'],
        features: ['High-resolution images', 'Online gallery', 'Print releases', 'Professional editing'],
      },
      {
        name: 'Professional Videography',
        description: 'Professional event videography service with cinematic coverage (6 hours)',
        category: 'photography',
        serviceType: 'service',
        price: 10000,
        priceType: 'flat-rate',
        duration: 360, // 6 hours
        image: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=400&h=300&fit=crop',
        isAvailable: true,
        tags: ['videography', 'cinematic', 'event'],
        features: ['Cinematic coverage', 'Professional editing', 'Highlight reel', 'Raw footage'],
      },
      {
        name: 'Sound System Rental',
        description: 'Professional sound system rental with setup and operation',
        category: 'sound-system',
        serviceType: 'service',
        price: 3000,
        priceType: 'flat-rate',
        duration: 480, // 8 hours
        image: 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=400&h=300&fit=crop',
        isAvailable: true,
        tags: ['sound system', 'audio', 'rental'],
        features: ['Professional equipment', 'Setup and operation', 'Sound engineering', 'Backup systems'],
      },
      {
        name: 'Tent & Table Setup',
        description: 'Professional tent and table setup service for outdoor events',
        category: 'setup-teardown',
        serviceType: 'service',
        price: 4000,
        priceType: 'flat-rate',
        duration: 240, // 4 hours
        image: 'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=400&h=300&fit=crop',
        isAvailable: true,
        tags: ['tent setup', 'table setup', 'outdoor'],
        features: ['Professional setup', 'Secure anchoring', 'Layout planning', 'Cleanup included'],
      },
      {
        name: 'Custom Backdrop & Styling',
        description: 'Custom backdrop creation and styling service for events and photos',
        category: 'decoration',
        serviceType: 'service',
        price: 7000,
        priceType: 'flat-rate',
        duration: 180, // 3 hours
        image: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=400&h=300&fit=crop',
        isAvailable: true,
        tags: ['backdrop', 'custom', 'styling'],
        features: ['Custom design', 'Professional materials', 'Setup included', 'Branded options'],
      },
      {
        name: 'Mascot / Entertainer',
        description: 'Fun mascot or entertainer service for children\'s events (2 hours)',
        category: 'entertainment',
        serviceType: 'service',
        price: 5000,
        priceType: 'flat-rate',
        duration: 120, // 2 hours
        image: 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=400&h=300&fit=crop',
        isAvailable: true,
        tags: ['mascot', 'entertainer', 'kids'],
        features: ['Professional costume', 'Interactive entertainment', 'Photo opportunities', 'Memorable experience'],
      },
      {
        name: 'Cleaning & After-Event',
        description: 'Professional post-event cleaning and site restoration service',
        category: 'cleaning',
        serviceType: 'service',
        price: 3000,
        priceType: 'flat-rate',
        duration: 180, // 3 hours
        image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=300&fit=crop',
        isAvailable: true,
        tags: ['cleaning', 'post-event', 'restoration'],
        features: ['Thorough cleanup', 'Waste removal', 'Site restoration', 'Professional service'],
      },
    ];

    await Service.insertMany(services);
    console.log('Sample services created');

    console.log('\n✓ Database seeded successfully!');

    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
}

seedDatabase();
