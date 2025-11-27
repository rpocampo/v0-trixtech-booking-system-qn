const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const readline = require('readline');
require('dotenv').config();

const User = require('../models/User');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function createAdmin() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/trixtech');
    console.log('Connected to MongoDB');

    // Parse command line arguments
    const args = process.argv.slice(2);
    let name, email, password;

    if (args.length >= 3) {
      // Command line mode: node create-admin.js "Admin Name" "admin@example.com" "password123"
      [name, email, password] = args;
    } else {
      // Interactive mode
      // Check if admin already exists
      const existingAdmin = await User.findOne({ role: 'admin' });
      if (existingAdmin) {
        console.log('Admin user already exists!');
        console.log(`Email: ${existingAdmin.email}`);
        console.log(`Name: ${existingAdmin.name}`);
        console.log(`Created: ${existingAdmin.createdAt}`);

        const updateChoice = await askQuestion('Do you want to update the existing admin? (y/n): ');
        if (updateChoice.toLowerCase() !== 'y') {
          rl.close();
          process.exit(0);
        }
      }

      // Get admin details
      name = name || await askQuestion('Enter admin name: ');
      email = email || await askQuestion('Enter admin email: ');
      password = password || await askQuestion('Enter admin password: ');
    }

    if (!name || !email || !password) {
      console.error('All fields are required!');
      if (args.length < 3) rl.close();
      process.exit(1);
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.error('Invalid email format!');
      if (args.length < 3) rl.close();
      process.exit(1);
    }

    // Validate password strength
    if (password.length < 8) {
      console.error('Password must be at least 8 characters long!');
      if (args.length < 3) rl.close();
      process.exit(1);
    }

    // Check if admin already exists (for command line mode)
    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin && args.length >= 3) {
      console.log('Admin user already exists. Use interactive mode to update.');
      process.exit(0);
    }

    // Create or update admin user
    if (existingAdmin && args.length < 3) {
      existingAdmin.name = name;
      existingAdmin.email = email;
      existingAdmin.password = password; // Will be hashed by pre-save middleware
      await existingAdmin.save();
      console.log('Admin user updated successfully!');
    } else {
      const adminUser = new User({
        name,
        email,
        password,
        role: 'admin'
      });
      await adminUser.save();
      console.log('Admin user created successfully!');
    }

    console.log('\nAdmin Details:');
    console.log(`Name: ${name}`);
    console.log(`Email: ${email}`);
    console.log(`Role: admin`);
    console.log('\nYou can now login with these credentials.');

    if (args.length < 3) rl.close();
    process.exit(0);
  } catch (error) {
    console.error('Error creating admin:', error.message);
    if (process.argv.slice(2).length < 3) rl.close();
    process.exit(1);
  }
}

createAdmin();