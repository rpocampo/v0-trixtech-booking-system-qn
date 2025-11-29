# TRIXTECH - Complete Booking and Reservation System

A comprehensive enterprise-grade booking and reservation system built with Next.js 16, React 19, Node.js, Express, MongoDB, and Redis. Features 50+ advanced capabilities including AI-powered recommendations, automated business processes, real-time synchronization, comprehensive analytics, and intelligent inventory management.

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

### 🎯 Core Features (50+ Advanced Capabilities)

#### Customer Portal
- ✅ **Smart Registration** - OTP verification, secure authentication
- ✅ **AI-Powered Service Discovery** - Personalized recommendations, intelligent search
- ✅ **Advanced Booking System** - Package deals, flexible scheduling, real-time availability
- ✅ **Comprehensive Booking Management** - Status tracking, modifications, cancellation policies
- ✅ **Personalized Experience** - User preferences, booking history, favorites
- ✅ **Real-time Notifications** - Live updates, booking confirmations, reminders
- ✅ **Payment Processing** - GCash QR payments, down payments, installment support
- ✅ **Mobile-First Design** - Responsive interface, touch-optimized

#### Admin Dashboard
- ✅ **Business Intelligence** - Advanced analytics, revenue tracking, performance metrics
- ✅ **Comprehensive Service Management** - Dynamic pricing, inventory control, batch management
- ✅ **Intelligent Booking Oversight** - Status management, conflict resolution, automation
- ✅ **Advanced Inventory Control** - Stock tracking, reorder alerts, supplier management
- ✅ **Customer Relationship Management** - User insights, communication tools, support
- ✅ **Delivery & Logistics** - Route optimization, scheduling, real-time tracking
- ✅ **Package Management** - Bundled offerings, dynamic pricing, recommendations
- ✅ **Event Type Specialization** - Custom configurations for different event categories

### Module Roles & Responsibilities

#### 📦 Inventory Management Module
**Primary Controller of Stock Data**
- **Exclusive Authority**: Acts as the single source of truth for all stock quantities
- **Stock Operations**: Responsible for editing, updating, adding, and reducing stock quantities
- **Data Integrity**: Ensures all stock changes are accurately reflected across the system
- **Record Keeping**: Maintains official and authoritative inventory records
- **Real-time Updates**: Provides live inventory synchronization via WebSocket
- **Stock Monitoring**: Tracks inventory levels, low stock alerts, and out-of-stock items
- **Financial Tracking**: Calculates total inventory value and stock worth

#### ⚙️ Services Module
**Viewer of Inventory Availability**
- **Read-Only Access**: Displays real-time stock availability pulled from Inventory module
- **No Stock Editing**: Strictly read-only regarding stock quantities (no modifications allowed)
- **Service Management**: Handles service definitions, descriptions, pricing, and configurations
- **Availability Display**: Shows current stock status with visual indicators (In Stock/Low Stock/Out of Stock)
- **User Guidance**: Directs administrators to Inventory module for stock management
- **Data Separation**: Maintains clear boundary between service configuration and inventory control

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

## 🚀 Quick Start (1 Minute!)

```bash
# Install and start everything automatically
npm run quickstart

# Access your application:
# 🌐 Customer Portal: http://localhost:3000
# 👑 Admin Dashboard: http://localhost:3000/admin
# 🔌 Backend API: http://localhost:5000/api
```

### Manual Alternative
```bash
npm install      # Install all dependencies
npm run dev     # Start both servers
```

## Email Configuration

The system uses SendGrid for reliable email delivery. Configure the following environment variables:

```env
SENDGRID_API_KEY=your-sendgrid-api-key-here
SENDER_EMAIL=noreply@yourdomain.com
ADMIN_EMAIL=admin@yourdomain.com
```

### DNS Records for Email Authentication

To maximize email deliverability and avoid spam filters, configure these DNS records for your domain:

#### SPF Record
```
Type: TXT
Name: @
Value: "v=spf1 include:sendgrid.net ~all"
```

#### DKIM Records
SendGrid will provide DKIM records after domain verification. Add them as CNAME records:

```
Type: CNAME
Name: s1._domainkey.yourdomain.com
Value: s1.domainkey.u123456.wl.sendgrid.net

Type: CNAME
Name: s2._domainkey.yourdomain.com
Value: s2.domainkey.u123456.wl.sendgrid.net
```

#### DMARC Record (Optional but Recommended)
```
Type: TXT
Name: _dmarc.yourdomain.com
Value: "v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com"
```

### SendGrid Setup Steps
1. Create a SendGrid account at https://sendgrid.com
2. Verify your domain in SendGrid dashboard
3. Add the provided DNS records to your domain registrar
4. Generate an API key with "Full Access" permissions
5. Update your `.env` file with the API key and verified sender email

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

- **Frontend**: Next.js 16, React 19, TypeScript, TailwindCSS 4
- **Backend**: Node.js, Express.js, MongoDB, Mongoose, Redis, Socket.IO
- **Database**: MongoDB with 16+ advanced schemas
- **Authentication**: JWT tokens with OTP verification, bcrypt hashing
- **Real-time**: WebSocket connections for live updates
- **AI/ML**: Recommendation engine, user personalization
- **Automation**: 15+ background processes for business logic
- **Payment**: GCash QR integration with advanced processing
- **Email**: SendGrid integration with templates
- **Caching**: Redis for distributed locking and performance

## Project Notes

- Double-booking prevention is implemented to avoid service conflicts
- All passwords are hashed using bcrypt before storage
- JWT tokens expire after 7 days
- Admin role is required for service management and booking approval
- Customer and admin cannot access each other's pages
- All API responses follow a consistent JSON format with success status

## Payment System

The system uses GCash QR code payments for secure and instant transactions:

- **QR Code Generation**: Dynamic QR codes generated for each booking
- **GCash Integration**: Compatible with GCash mobile app scanning
- **Real-time Verification**: Automatic payment confirmation
- **Transaction Security**: Unique reference numbers and validation

## Testing Email Delivery

### Gmail Inbox Testing Checklist

1. **Configure SendGrid**: Set up your SendGrid account and domain verification
2. **Update Environment**: Add `SENDGRID_API_KEY` and verified `SENDER_EMAIL` to `.env`
3. **Test Booking Confirmation**:
   - Create a booking through the customer interface
   - Complete payment to trigger confirmation email
   - Check Gmail inbox (not spam folder)
4. **Test Password Reset**:
   - Use "Forgot Password" on login page
   - Enter a Gmail address
   - Verify reset email arrives in inbox
5. **Verify Email Headers**:
   - Open received email in Gmail
   - Click "Show original" to check headers
   - Confirm `From` shows your verified domain
   - Check for DKIM/SPF pass indicators

### Expected Results
- ✅ Emails arrive in Gmail Primary inbox (not Spam)
- ✅ `From` header shows: `"TRIXTECH" <noreply@yourdomain.com>`
- ✅ DKIM and SPF authentication pass
- ✅ Email renders properly on mobile Gmail app
- ✅ Unsubscribe link present (if applicable)

### Troubleshooting
- If emails go to spam: Check DKIM/SPF setup and domain reputation
- If authentication fails: Verify DNS records are published and correct
- If no emails received: Check SendGrid activity feed and API key permissions

## Future Enhancements

- Additional payment methods (Maya, PayPal)
- Service reviews and ratings
- Advanced reporting and analytics
- Multi-language support
- Mobile app development

## License

MIT

## Support

For issues or questions, please open an issue in the repository or contact support.
