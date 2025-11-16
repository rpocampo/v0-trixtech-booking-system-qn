# TRIXTECH API Reference

## Base URL
\`\`\`
http://localhost:5000/api
\`\`\`

## Authentication

All endpoints (except registration & login) require:
\`\`\`
Headers:
Authorization: Bearer {jwt_token}
Content-Type: application/json
\`\`\`

## Endpoints

### Authentication

#### Register User
\`\`\`
POST /auth/register
Body: {
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123",
  "role": "customer" // or "admin"
}
Response: {
  "success": true,
  "message": "User registered successfully",
  "token": "jwt_token"
}
\`\`\`

#### Login User
\`\`\`
POST /auth/login
Body: {
  "email": "john@example.com",
  "password": "password123"
}
Response: {
  "success": true,
  "token": "jwt_token",
  "user": {
    "id": "user_id",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "customer"
  }
}
\`\`\`

#### Get Current User
\`\`\`
GET /auth/me
Response: {
  "success": true,
  "user": { /* user object */ }
}
\`\`\`

### Services

#### Get All Services
\`\`\`
GET /services
Response: {
  "success": true,
  "services": [ /* services array */ ]
}
\`\`\`

#### Create Service (Admin Only)
\`\`\`
POST /services
Body: {
  "name": "Service Name",
  "description": "Service Description",
  "duration": 60,
  "price": 99.99
}
Response: {
  "success": true,
  "service": { /* created service */ }
}
\`\`\`

#### Update Service (Admin Only)
\`\`\`
PUT /services/:id
Body: { /* updated fields */ }
Response: {
  "success": true,
  "service": { /* updated service */ }
}
\`\`\`

#### Delete Service (Admin Only)
\`\`\`
DELETE /services/:id
Response: {
  "success": true,
  "message": "Service deleted"
}
\`\`\`

### Bookings

#### Create Booking
\`\`\`
POST /bookings
Body: {
  "serviceId": "service_id",
  "date": "2024-12-25",
  "time": "14:00",
  "totalPrice": 99.99
}
Response: {
  "success": true,
  "booking": { /* created booking */ }
}
\`\`\`

#### Get My Bookings
\`\`\`
GET /bookings/my-bookings
Response: {
  "success": true,
  "bookings": [ /* user's bookings */ ]
}
\`\`\`

#### Get All Bookings (Admin Only)
\`\`\`
GET /bookings/admin/all
Response: {
  "success": true,
  "bookings": [ /* all bookings */ ]
}
\`\`\`

#### Update Booking (Admin Only)
\`\`\`
PUT /bookings/:id
Body: {
  "status": "completed", // or "confirmed", "pending", "cancelled"
  "paymentStatus": "paid" // or "pending", "failed"
}
Response: {
  "success": true,
  "booking": { /* updated booking */ }
}
\`\`\`

#### Cancel Booking
\`\`\`
DELETE /bookings/:id
Response: {
  "success": true,
  "message": "Booking cancelled"
}
\`\`\`

### Analytics (Admin Only)

#### Get Analytics
\`\`\`
GET /analytics?startDate=2024-01-01&endDate=2024-12-31
Response: {
  "success": true,
  "data": {
    "totalBookings": 150,
    "totalCancellations": 10,
    "totalRevenue": 14850.50,
    "newUsers": 45
  }
}
\`\`\`

## Error Responses

All errors follow this format:
\`\`\`
{
  "success": false,
  "message": "Error description"
}
\`\`\`

Common status codes:
- 200: Success
- 400: Bad request
- 401: Unauthorized
- 403: Forbidden (insufficient permissions)
- 404: Not found
- 500: Server error
\`\`\`
