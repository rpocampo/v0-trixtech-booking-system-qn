# TRIXTECH - Complete Booking and Reservation System

A full-stack booking and reservation system built with Next.js, Node.js, Express, MongoDB Community Edition, and TailwindCSS. Features customer bookings, admin management, JWT authentication, and role-based access control.

## Project Structure

\`\`\`
trixtech/
├── frontend/          # Next.js React frontend
│   ├── app/          # App router pages
│   ├── public/       # Static assets
│   └── package.json
└── backend/          # Node.js Express backend
    ├── models/       # MongoDB schemas
    ├── routes/       # API endpoints
    ├── middleware/   # Auth and error handling
    ├── config/       # Database configuration
    ├── server.js     # Main server file
    └── package.json
\`\`\`

## Features

### Customer Features
- User registration and authentication
- Browse available services
- Book services with date/time selection
- View booking history
- Cancel bookings
- Update profile information
- Payment status tracking

### Admin Features
- Dashboard with key metrics (revenue, bookings, customers)
- Create, edit, and delete services
- Manage all bookings with status updates
- Track payment status
- View all customer information
- Service availability management

### Technical Features
- JWT-based authentication with token expiry
- Bcrypt password hashing
- Role-based access control (customer/admin)
- Double-booking prevention
- Protected routes
- Global error handling
- MongoDB integration with Mongoose
- Responsive Tailwind CSS design

## Prerequisites

- **Node.js** (v14 or higher)
- **MongoDB Community Edition** (running locally)
- **npm** or **yarn**

### Installing MongoDB Community Edition

#### Windows
Download and install from: https://www.mongodb.com/try/download/community

#### macOS (using Homebrew)
\`\`\`bash
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community
\`\`\`

#### Linux (Ubuntu/Debian)
\`\`\`bash
sudo apt-get install -y mongodb
sudo systemctl start mongodb
\`\`\`

**Verify MongoDB is running:**
\`\`\`bash
mongo --eval "db.adminCommand('ping')"
\`\`\`

## Installation and Setup

### 1. Clone the Repository
\`\`\`bash
git clone <repository-url>
cd trixtech
\`\`\`

### 2. Backend Setup

Navigate to the backend directory:
\`\`\`bash
cd backend
\`\`\`

Install dependencies:
\`\`\`bash
npm install
\`\`\`

Create `.env` file from example:
\`\`\`bash
cp .env.example .env
\`\`\`

The `.env` file should contain:
\`\`\`
MONGODB_URI=mongodb://localhost:27017/trixtech
JWT_SECRET=trixtech_secret_key
PORT=5000
NODE_ENV=development
\`\`\`

Seed the database with admin user and sample services:
\`\`\`bash
node scripts/seed.js
\`\`\`

Start the backend server:
\`\`\`bash
npm start
\`\`\`

Or for development with auto-reload:
\`\`\`bash
npm run dev
\`\`\`

The backend will run on `http://localhost:5000`

### 3. Frontend Setup

In a new terminal, navigate to the frontend directory:
\`\`\`bash
cd frontend
\`\`\`

Install dependencies:
\`\`\`bash
npm install
\`\`\`

Start the development server:
\`\`\`bash
npm run dev
\`\`\`

The frontend will run on `http://localhost:3000`

## Quick Start

1. **Start MongoDB** (if not running)
2. **Start Backend**: In `/backend` directory, run `npm start`
3. **Start Frontend**: In `/frontend` directory, run `npm run dev`
4. **Open Browser**: Visit `http://localhost:3000`

## Demo Credentials

### Admin Account
- Email: `admin@trixtech.com`
- Password: `admin123`

### Sample Customer Account
- Email: `customer@trixtech.com`
- Password: `customer123`

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user (requires auth)

### Services
- `GET /api/services` - Get all services
- `GET /api/services/:id` - Get service by ID
- `POST /api/services` - Create service (admin only)
- `PUT /api/services/:id` - Update service (admin only)
- `DELETE /api/services/:id` - Delete service (admin only)

### Bookings
- `POST /api/bookings` - Create booking (customer)
- `GET /api/bookings` - Get user bookings (customer)
- `GET /api/bookings/admin/all` - Get all bookings (admin)
- `PUT /api/bookings/:id` - Update booking (admin)
- `PUT /api/bookings/:id/cancel` - Cancel booking

### Users
- `GET /api/users` - Get all users (admin)
- `PUT /api/users/:id` - Update user profile

## Workflow Example

### Customer Booking Flow
1. Register/Login at `http://localhost:3000`
2. Browse services on Services page
3. Click "Book Now" on desired service
4. Select date/time and add notes
5. Confirm booking
6. View booking status in Bookings page
7. Admin confirms booking and payment

### Admin Management Flow
1. Login with admin credentials
2. Go to Admin Dashboard
3. Create services in "Manage Services"
4. View pending bookings in "Manage Bookings"
5. Update booking status and payment status
6. View customer list in "Manage Customers"

## Troubleshooting

### MongoDB Connection Error
- Ensure MongoDB is running: `sudo systemctl status mongodb` (Linux) or check MongoDB services (Windows)
- Verify connection string in `.env` matches your MongoDB setup

### CORS Error on Frontend
- Ensure backend is running on port 5000
- Check that frontend API calls point to `http://localhost:5000`

### Module Not Found
- Run `npm install` in both `/frontend` and `/backend`
- Delete `node_modules` and `package-lock.json`, then reinstall if issues persist

### Port Already in Use
- Backend: Change PORT in `.env` file
- Frontend: Run `npm run dev -- -p 3001` to use port 3001

## Technologies Used

- **Frontend**: Next.js 14, React 18, TailwindCSS 4, TypeScript
- **Backend**: Node.js, Express.js, MongoDB, Mongoose, JWT, Bcryptjs
- **Database**: MongoDB Community Edition
- **Styling**: TailwindCSS with custom design tokens
- **Authentication**: JWT tokens with 7-day expiry

## Project Notes

- Double-booking prevention is implemented to avoid service conflicts
- All passwords are hashed using bcrypt before storage
- JWT tokens expire after 7 days
- Admin role is required for service management and booking approval
- Customer and admin cannot access each other's pages
- All API responses follow a consistent JSON format with success status

## Future Enhancements

- Email notifications for booking confirmations
- Payment gateway integration (Stripe)
- Real-time booking updates with WebSockets
- Service reviews and ratings
- Advanced reporting and analytics
- Multi-language support
- Mobile app development

## License

MIT

## Support

For issues or questions, please open an issue in the repository or contact support.
