# How TRIXTECH Booking System Works

## Overview

TRIXTECH is a comprehensive full-stack booking and reservation system designed for event management, equipment rental, and service bookings. The platform allows customers to browse and book various services while providing administrators with powerful tools to manage inventory, bookings, and operations.

### What the System Does
- **Customer Portal**: Browse services, make bookings, track payments, receive notifications
- **Admin Dashboard**: Manage services, monitor bookings, handle inventory, view analytics
- **Real-time Updates**: Live notifications and status updates via WebSocket
- **Payment Processing**: Secure GCash QR code payments
- **Inventory Management**: Track stock levels, prevent overbooking, low-stock alerts
- **Smart Recommendations**: AI-powered service suggestions based on booking patterns

## System Architecture

The system follows a modern full-stack architecture with clear separation of concerns:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API   │    │   Database      │
│   (Next.js)     │◄──►│   (Express.js)  │◄──►│   (MongoDB)     │
│                 │    │                 │    │                 │
│ - Customer UI   │    │ - RESTful APIs  │    │ - User data     │
│ - Admin UI      │    │ - Authentication │    │ - Bookings      │
│ - Real-time UI  │    │ - Business Logic │    │ - Services      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │   External      │
                       │   Services      │
                       │                 │
                       │ - SendGrid      │
                       │ - Redis Cache   │
                       │ - Socket.IO     │
                       └─────────────────┘
```

### Key Technologies
- **Frontend**: Next.js 14, React 18, TypeScript, TailwindCSS
- **Backend**: Node.js, Express.js, MongoDB, Mongoose
- **Authentication**: JWT tokens with role-based access
- **Real-time**: Socket.IO for live updates
- **Payments**: GCash QR code integration
- **Email**: SendGrid for notifications
- **Caching**: Redis for distributed locking and performance

## Key Features Breakdown

### 1. User Authentication & Authorization
- **JWT-based authentication** with 7-day token expiry
- **Role-based access control**: Customer vs Admin roles
- **Password hashing** using bcrypt
- **Protected routes** with middleware validation

### 2. Service Management
- **Dynamic pricing** based on booking timeline (early booking discounts)
- **Inventory tracking** with batch management (FIFO)
- **Service categories**: Events, equipment, supplies
- **Availability checking** with real-time stock validation

### 3. Booking System
- **Double-booking prevention** using distributed locking
- **Reservation queues** for unavailable items
- **Flexible booking flow**: Pay-first or book-first options
- **Status tracking**: Pending → Confirmed → Completed

### 4. Payment Processing
- **GCash QR integration** for secure payments
- **Dynamic QR generation** with unique reference numbers
- **Payment verification** and status tracking
- **Partial payments** support (down payments)

### 5. Real-time Features
- **WebSocket connections** for live updates
- **Push notifications** for booking status changes
- **Admin dashboard** live monitoring
- **Customer notifications** for important updates

### 6. Inventory Management
- **Stock level monitoring** with low-stock alerts
- **Batch tracking** for equipment/supply items
- **Automatic inventory reduction** on confirmed bookings
- **Real-time availability** updates

## User Flows

### Customer Booking Flow
1. **Registration/Login** → User creates account or signs in
2. **Browse Services** → View available services with pricing and availability
3. **Select Service** → Choose service, date, quantity, and options
4. **Check Availability** → System validates stock and scheduling
5. **Create Booking** → Booking created with pending status
6. **Payment** → Generate GCash QR code and complete payment
7. **Confirmation** → Booking confirmed, notifications sent
8. **Tracking** → Monitor booking status and receive updates

### Admin Management Flow
1. **Dashboard Overview** → View key metrics and recent activity
2. **Service Management** → Add/edit/delete services and pricing
3. **Booking Oversight** → Review pending bookings and update status
4. **Inventory Control** → Monitor stock levels and manage inventory
5. **Customer Support** → Handle customer inquiries and issues
6. **Analytics Review** → Analyze booking patterns and performance

## Code Breakdown

### Backend Structure

The backend is organized into clear modules:

#### Core Files
- **`server.js`**: Main application entry point
  - Sets up Express server and middleware
  - Configures Socket.IO for real-time communication
  - Defines API routes and error handling
  - Initializes background processes (queue processing, cleanup)

#### Models (Database Schemas)
- **`models/User.js`**: User accounts with roles and preferences
- **`models/Service.js`**: Service definitions with pricing and inventory
- **`models/Booking.js`**: Booking records with status and payment tracking
- **`models/Payment.js`**: Payment transactions and verification
- **`models/Notification.js`**: User notifications and messaging

#### Routes (API Endpoints)
- **`routes/authRoutes.js`**: Authentication (login, register, profile)
- **`routes/bookingRoutes.js`**: Booking management and availability
- **`routes/serviceRoutes.js**: Service CRUD operations
- **`routes/paymentRoutes.js`**: Payment processing and verification
- **`routes/notificationRoutes.js`**: Notification management

#### Utilities (Business Logic)
- **`utils/paymentService.js`**: Payment processing and QR generation
- **`utils/qrCodeService.js`**: QR code creation and validation
- **`utils/emailService.js`**: Email notifications via SendGrid
- **`utils/notificationService.js`**: In-app notification system
- **`utils/lockService.js`**: Distributed locking for concurrency control
- **`utils/deliveryService.js`**: Delivery truck scheduling and availability

### Frontend Structure

The frontend uses Next.js App Router with clear separation:

#### App Directory Structure
```
frontend/app/
├── layout.tsx              # Root layout with providers
├── page.tsx               # Landing page
├── globals.css            # Global styles
├── customer/              # Customer-facing pages
│   ├── layout.tsx        # Customer layout
│   ├── dashboard/        # Customer dashboard
│   ├── services/         # Service browsing
│   ├── booking/          # Booking process
│   ├── checkout/         # Payment flow
│   └── notifications/    # Customer notifications
└── admin/                 # Admin pages
    ├── layout.tsx        # Admin layout
    ├── dashboard/        # Admin dashboard
    ├── services/         # Service management
    ├── bookings/         # Booking oversight
    └── inventory/        # Inventory management
```

#### Key Components
- **`components/BookingWizard.tsx`**: Step-by-step booking process
- **`components/CartContext.tsx`**: Shopping cart state management
- **`components/NotificationProvider.tsx`**: Real-time notification handling
- **`components/SocketProvider.tsx`**: WebSocket connection management

### How Key Processes Work

#### Booking Creation Process
```javascript
// 1. Customer selects service and date
// 2. Frontend calls availability check API
router.get('/check-availability/:serviceId', async (req, res) => {
  // Check inventory and scheduling conflicts
  // Return available slots and quantities
});

// 3. If available, create booking
router.post('/', async (req, res) => {
  // Use distributed locking to prevent race conditions
  const booking = await lockService.withLock(lockKey, async () => {
    // Validate availability
    // Create booking record
    // Update inventory
    // Send notifications
  });
});
```

#### Payment Processing Flow
```javascript
// 1. Create payment intent
router.post('/create-intent', async (req, res) => {
  // Generate unique transaction ID
  // Create payment record in database
  // Generate GCash QR code
  // Return QR data to frontend
});

// 2. Customer scans QR and pays
// 3. GCash processes payment
// 4. System verifies payment (webhook/callback)
// 5. Confirm booking and update status
```

#### Real-time Updates
```javascript
// Backend: Socket.IO setup
io.on('connection', (socket) => {
  socket.on('join', (userId) => {
    socket.join(`user_${userId}`);
  });

  socket.on('join-admin', () => {
    socket.join('admin');
  });
});

// Frontend: React component
useEffect(() => {
  socket.on('booking-updated', (data) => {
    // Update UI with new booking status
    setBookings(prev => updateBooking(prev, data));
  });
}, []);
```

## Data Flow Example

### Complete Booking Transaction

1. **User Action**: Customer clicks "Book Now" on a service
2. **Frontend**: Calls `/api/bookings/check-availability` to verify slots
3. **Backend**: Checks database for conflicts, returns availability status
4. **Frontend**: Shows available options, user confirms booking
5. **Frontend**: Calls `/api/bookings` to create booking
6. **Backend**:
   - Uses Redis lock to prevent concurrent bookings
   - Creates booking record with "pending" status
   - Updates inventory quantities
   - Sends notifications to customer and admin
   - Emits Socket.IO events for real-time updates
7. **Frontend**: Shows payment QR code
8. **Customer**: Scans QR with GCash app and completes payment
9. **GCash**: Processes payment and sends callback
10. **Backend**: Verifies payment, updates booking to "confirmed"
11. **Real-time**: All connected clients receive status updates

## Security & Performance Features

### Security Measures
- **Input validation** on all API endpoints
- **SQL injection prevention** via Mongoose ODM
- **XSS protection** with input sanitization
- **Rate limiting** on sensitive endpoints
- **CORS configuration** for cross-origin requests

### Performance Optimizations
- **Database indexing** on frequently queried fields
- **Redis caching** for session management
- **Distributed locking** to prevent race conditions
- **Background job processing** for heavy operations
- **Lazy loading** in frontend components

## Monitoring & Maintenance

### System Health Checks
- **Health endpoint** (`/api/health`) for monitoring
- **Error logging** with detailed stack traces
- **Performance metrics** collection
- **Database connection monitoring**

### Automated Tasks
- **Reservation queue processing** (every 5 minutes)
- **Expired OTP cleanup** (hourly)
- **Expired reservation cleanup** (daily)
- **Low stock alerts** (real-time)

## Future Enhancements

The system is designed to be extensible with features like:
- **Mobile app** development
- **Multi-language support**
- **Advanced analytics dashboard**
- **Integration with external calendars**
- **Loyalty program implementation**
- **Third-party payment gateways**

This architecture provides a solid foundation for a scalable, secure, and user-friendly booking platform that can grow with business needs.