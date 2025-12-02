// MongoDB initialization script for TRIXTECH
// This script runs when the MongoDB container starts for the first time

// Switch to the trixtech_prod database
db = db.getSiblingDB('trixtech_prod');

// Create application user with read/write access
db.createUser({
  user: 'trixtech_user',
  pwd: 'trixtech2024!',
  roles: [
    {
      role: 'readWrite',
      db: 'trixtech_prod'
    }
  ]
});

// Create collections with indexes for better performance
db.createCollection('users');
db.createCollection('bookings');
db.createCollection('services');
db.createCollection('payments');
db.createCollection('notifications');
db.createCollection('otps');
db.createCollection('invoices');
db.createCollection('analytics');
db.createCollection('delivery');
db.createCollection('inventorytransactions');
db.createCollection('packagereservations');
db.createCollection('eventtypes');
db.createCollection('userpreferences');
db.createCollection('bookinganalytics');

// Create indexes for better query performance
db.users.createIndex({ "email": 1 }, { unique: true });
db.users.createIndex({ "role": 1 });
db.users.createIndex({ "createdAt": 1 });

db.bookings.createIndex({ "customerId": 1 });
db.bookings.createIndex({ "serviceId": 1 });
db.bookings.createIndex({ "status": 1 });
db.bookings.createIndex({ "bookingDate": 1 });
db.bookings.createIndex({ "createdAt": 1 });

db.services.createIndex({ "category": 1 });
db.services.createIndex({ "serviceType": 1 });
db.services.createIndex({ "name": 1 });

db.payments.createIndex({ "bookingId": 1 });
db.payments.createIndex({ "status": 1 });
db.payments.createIndex({ "createdAt": 1 });

db.notifications.createIndex({ "userId": 1 });
db.notifications.createIndex({ "read": 1 });
db.notifications.createIndex({ "createdAt": 1 });

db.otps.createIndex({ "email": 1 });
db.otps.createIndex({ "expiresAt": 1 });

print("TRIXTECH MongoDB initialization completed successfully!");
print("Database: trixtech_prod");
print("User: trixtech_user");
print("Collections and indexes created.");