const mongoose = require('mongoose');
const EventType = require('../models/EventType');

async function seedEventTypes() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/trixtech');

    console.log('🌱 Seeding event types...');

    // Event types as requested
    const eventTypes = [
      {
        name: 'Birthday Party',
        slug: 'birthday-party',
        description: 'Celebrate birthdays with fun decorations, games, and memorable experiences for all ages.',
        shortDescription: 'Fun birthday celebrations',
        category: 'celebration',
        icon: '🎂',
        typicalGuestCount: {
          min: 5,
          max: 100,
          suggested: 25
        },
        typicalDuration: 4,
        displayOrder: 1,
        isActive: true,
        tags: ['birthday', 'celebration', 'party', 'fun'],
        recommendedServices: [
          {
            category: 'furniture',
            priority: 5,
            isRequired: true,
            notes: 'Tables and chairs for seating and food service'
          },
          {
            category: 'catering',
            priority: 4,
            isRequired: false,
            notes: 'Food and beverages for the celebration'
          },
          {
            category: 'sound-system',
            priority: 3,
            isRequired: false,
            notes: 'Music and announcements'
          },
          {
            category: 'party-supplies',
            priority: 4,
            isRequired: false,
            notes: 'Decorations, balloons, and party favors'
          }
        ],
        seasonalNotes: 'Popular year-round, especially during school breaks and holidays'
      },
      {
        name: 'Wedding Event',
        slug: 'wedding-event',
        description: 'Elegant wedding ceremonies and receptions with professional services and beautiful decorations.',
        shortDescription: 'Elegant wedding celebrations',
        category: 'celebration',
        icon: '💒',
        typicalGuestCount: {
          min: 20,
          max: 300,
          suggested: 100
        },
        typicalDuration: 8,
        displayOrder: 2,
        isActive: true,
        tags: ['wedding', 'ceremony', 'reception', 'elegant'],
        recommendedServices: [
          {
            category: 'furniture',
            priority: 5,
            isRequired: true,
            notes: 'Tables, chairs, and ceremony setup'
          },
          {
            category: 'catering',
            priority: 5,
            isRequired: true,
            notes: 'Wedding cake, food service, and beverages'
          },
          {
            category: 'photography',
            priority: 4,
            isRequired: false,
            notes: 'Professional wedding photography'
          },
          {
            category: 'decoration',
            priority: 4,
            isRequired: false,
            notes: 'Floral arrangements and venue decoration'
          },
          {
            category: 'sound-system',
            priority: 3,
            isRequired: false,
            notes: 'Ceremony music and reception entertainment'
          }
        ],
        seasonalNotes: 'Popular during dry season (November-April) and weekends'
      },
      {
        name: 'Corporate Event',
        slug: 'corporate-event',
        description: 'Professional corporate gatherings, conferences, seminars, and business meetings.',
        shortDescription: 'Professional business events',
        category: 'corporate',
        icon: '🏢',
        typicalGuestCount: {
          min: 10,
          max: 500,
          suggested: 50
        },
        typicalDuration: 6,
        displayOrder: 3,
        isActive: true,
        tags: ['corporate', 'business', 'conference', 'professional'],
        recommendedServices: [
          {
            category: 'furniture',
            priority: 5,
            isRequired: true,
            notes: 'Conference tables, chairs, and presentation setup'
          },
          {
            category: 'catering',
            priority: 3,
            isRequired: false,
            notes: 'Coffee breaks, lunch, and refreshments'
          },
          {
            category: 'sound-system',
            priority: 4,
            isRequired: false,
            notes: 'Presentation equipment and microphones'
          },
          {
            category: 'photography',
            priority: 2,
            isRequired: false,
            notes: 'Event documentation'
          }
        ],
        seasonalNotes: 'Popular during business quarters and company milestones'
      },
      {
        name: 'Community Gathering',
        slug: 'community-gathering',
        description: 'Barangay events, town fiestas, community celebrations, and local gatherings.',
        shortDescription: 'Community and barangay events',
        category: 'community',
        icon: '🏘️',
        typicalGuestCount: {
          min: 50,
          max: 1000,
          suggested: 200
        },
        typicalDuration: 12,
        displayOrder: 4,
        isActive: true,
        tags: ['community', 'barangay', 'fiesta', 'local', 'gathering'],
        recommendedServices: [
          {
            category: 'tents-canopies',
            priority: 5,
            isRequired: true,
            notes: 'Weather protection for outdoor gatherings'
          },
          {
            category: 'furniture',
            priority: 5,
            isRequired: true,
            notes: 'Tables and chairs for large groups'
          },
          {
            category: 'catering',
            priority: 4,
            isRequired: false,
            notes: 'Food service for community meals'
          },
          {
            category: 'sound-system',
            priority: 4,
            isRequired: false,
            notes: 'Announcements and entertainment'
          },
          {
            category: 'linens-tableware',
            priority: 3,
            isRequired: false,
            notes: 'Table settings for formal gatherings'
          }
        ],
        seasonalNotes: 'Often tied to local festivals, holidays, and barangay schedules'
      }
    ];

    // Insert event types
    for (const eventTypeData of eventTypes) {
      const existingEventType = await EventType.findOne({ slug: eventTypeData.slug });
      if (!existingEventType) {
        const eventType = new EventType(eventTypeData);
        await eventType.save();
        console.log(`✅ Created event type: ${eventTypeData.name}`);
      } else {
        console.log(`⏭️ Event type already exists: ${eventTypeData.name}`);
      }
    }

    console.log('🎉 Event type seeding completed!');

  } catch (error) {
    console.error('❌ Error seeding event types:', error);
  } finally {
    await mongoose.disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  seedEventTypes();
}

module.exports = seedEventTypes;