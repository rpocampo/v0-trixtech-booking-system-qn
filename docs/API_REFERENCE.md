# TRIXTECH API Reference

## Base URL
```
http://localhost:5000/api
```

## Authentication

All endpoints (except registration & login) require:
```
Headers:
Authorization: Bearer {jwt_token}
Content-Type: application/json
```

## Endpoints

### Authentication

#### Register User
```
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
```

#### Login User
```
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
```

#### Get Current User
```
GET /auth/me
Response: {
  "success": true,
  "user": { /* user object */ }
}
```

#### Forgot Password
```
POST /auth/forgot-password
Body: {
  "email": "john@example.com"
}
Response: {
  "success": true,
  "message": "Password reset email sent"
}
```

#### Reset Password
```
POST /auth/reset-password/:token
Body: {
  "password": "newpassword123"
}
Response: {
  "success": true,
  "message": "Password reset successfully"
}
```

### Services

#### Get All Services
```
GET /services
Query Params: ?sortBy=name&sortOrder=asc&category=equipment
Response: {
  "success": true,
  "services": [ /* services array */ ]
}
```

#### Get Service by ID
```
GET /services/:id
Response: {
  "success": true,
  "service": { /* service object */ }
}
```

#### Create Service (Admin Only)
```
POST /services
Body: {
  "name": "Service Name",
  "description": "Service Description",
  "duration": 60,
  "price": 99.99,
  "category": "equipment",
  "serviceType": "equipment",
  "quantity": 10
}
Response: {
  "success": true,
  "service": { /* created service */ }
}
```

#### Update Service (Admin Only)
```
PUT /services/:id
Body: { /* updated fields */ }
Response: {
  "success": true,
  "service": { /* updated service */ }
}
```

#### Delete Service (Admin Only)
```
DELETE /services/:id
Response: {
  "success": true,
  "message": "Service deleted"
}
```

### Bookings

#### Create Booking
```
POST /bookings
Body: {
  "serviceId": "service_id",
  "date": "2024-12-25",
  "time": "14:00",
  "quantity": 1,
  "totalPrice": 99.99
}
Response: {
  "success": true,
  "booking": { /* created booking */ }
}
```

#### Get My Bookings
```
GET /bookings/my-bookings
Response: {
  "success": true,
  "bookings": [ /* user's bookings */ ]
}
```

#### Get All Bookings (Admin Only)
```
GET /bookings/admin/all
Query Params: ?limit=10&page=1&status=confirmed
Response: {
  "success": true,
  "bookings": [ /* all bookings */ ],
  "pagination": { /* pagination info */ }
}
```

#### Update Booking (Admin Only)
```
PUT /bookings/:id
Body: {
  "status": "completed", // or "confirmed", "pending", "cancelled"
  "paymentStatus": "paid" // or "pending", "failed"
}
Response: {
  "success": true,
  "booking": { /* updated booking */ }
}
```

#### Cancel Booking
```
DELETE /bookings/:id
Response: {
  "success": true,
  "message": "Booking cancelled"
}
```

### Payments

#### Create QR Payment
```
POST /payments/create-qr
Body: {
  "bookingId": "booking_id",
  "amount": 99.99,
  "paymentType": "full" // or "down_payment"
}
Response: {
  "success": true,
  "paymentId": "payment_id",
  "transactionId": "txn_id",
  "referenceNumber": "QR_123456789",
  "qrCode": "data:image/png;base64,...",
  "instructions": "Scan with GCash app"
}
```

#### Verify QR Payment
```
POST /payments/verify-qr/:referenceNumber
Body: {
  "transactionId": "txn_id",
  "amount": 99.99
}
Response: {
  "success": true,
  "message": "Payment verified",
  "payment": { /* payment object */ },
  "booking": { /* booking object */ }
}
```

#### Verify Receipt (Upload)
```
POST /payments/verify-receipt/:referenceNumber
Content-Type: multipart/form-data
Body: {
  "receipt": <image_file>,
  "expectedAmount": 99.99
}
Response: {
  "success": true,
  "message": "Payment verified successfully",
  "verification": {
    "autoConfirmed": true,
    "amountVerified": true,
    "referenceVerified": true
  }
}
```

#### Get Payment Status
```
GET /payments/status/:paymentId
Response: {
  "success": true,
  "payment": { /* payment object */ }
}
```

#### Get All Payments (Admin Only)
```
GET /payments/all
Response: {
  "success": true,
  "payments": [ /* all payments */ ]
}
```

#### Review Flagged Payment (Admin Only)
```
POST /payments/:paymentId/review
Body: {
  "action": "approve", // or "reject"
  "notes": "Admin review notes"
}
Response: {
  "success": true,
  "message": "Payment approved/rejected"
}
```

### Notifications

#### Get User Notifications
```
GET /notifications
Query Params: ?limit=20&offset=0&unreadOnly=true
Response: {
  "success": true,
  "notifications": [ /* notifications array */ ],
  "total": 25,
  "hasMore": true
}
```

#### Get Unread Count
```
GET /notifications/unread-count
Response: {
  "success": true,
  "count": 5
}
```

#### Mark Notification as Read
```
PUT /notifications/:id/read
Response: {
  "success": true,
  "notification": { /* notification object */ }
}
```

#### Mark All as Read
```
PUT /notifications/mark-all-read
Response: {
  "success": true,
  "message": "All notifications marked as read"
}
```

#### Get Admin Notifications
```
GET /notifications/admin
Query Params: ?limit=50&unreadOnly=true
Response: {
  "success": true,
  "notifications": [ /* admin notifications */ ]
}
```

### Inventory Management

#### Get Inventory Summary
```
GET /inventory/summary
Response: {
  "success": true,
  "summary": {
    "totalServices": 15,
    "totalStock": 250,
    "lowStockCount": 3,
    "outOfStockCount": 1
  }
}
```

#### Get Inventory Transactions
```
GET /inventory/transactions
Query Params: ?serviceId=service_id&transactionType=booking&limit=100
Response: {
  "success": true,
  "transactions": [ /* transaction history */ ]
}
```

#### Manual Inventory Adjustment (Admin Only)
```
POST /inventory/adjust/:serviceId
Body: {
  "quantity": 5,
  "reason": "Restock from supplier"
}
Response: {
  "success": true,
  "message": "Inventory adjusted by 5 units"
}
```

#### Get Inventory Health Report
```
GET /inventory/health-report
Response: {
  "success": true,
  "report": {
    "overallHealth": "good",
    "recommendations": [ /* suggestions */ ]
  }
}
```

### Delivery Management

#### Get Delivery Schedules
```
GET /admin/delivery-schedules
Query Params: ?date=2024-12-25
Response: {
  "success": true,
  "schedules": [ /* delivery schedules */ ]
}
```

#### Update Delivery Status
```
PUT /deliveries/:id
Body: {
  "status": "in_transit",
  "notes": "Package picked up"
}
Response: {
  "success": true,
  "delivery": { /* updated delivery */ }
}
```

### Recommendations

#### Get Personalized Recommendations
```
GET /personalized
Query Params: ?limit=6
Response: {
  "success": true,
  "recommendations": [ /* recommended services */ ]
}
```

#### Get Equipment Recommendations
```
GET /equipment-recommendations
Query Params: ?serviceIds=service1,service2
Response: {
  "success": true,
  "recommendations": [ /* equipment suggestions */ ]
}
```

#### Get Predictive Suggestions
```
GET /suggestions/predictive
Response: {
  "success": true,
  "suggestions": [ /* AI-powered suggestions */ ]
}
```

### Analytics (Admin Only)

#### Get Analytics
```
GET /analytics?startDate=2024-01-01&endDate=2024-12-31
Response: {
  "success": true,
  "data": {
    "totalBookings": 150,
    "totalRevenue": 14850.50,
    "popularServices": [ /* top services */ ]
  }
}
```

### Users (Admin Only)

#### Get All Users
```
GET /users
Query Params: ?role=customer&limit=50
Response: {
  "success": true,
  "users": [ /* users array */ ]
}
```

#### Update User Profile
```
PUT /users/:id
Body: {
  "name": "Updated Name",
  "email": "newemail@example.com"
}
Response: {
  "success": true,
  "user": { /* updated user */ }
}
```

### Health Check

#### System Health
```
GET /health
Response: {
  "success": true,
  "status": "healthy",
  "uptime": "2h 30m",
  "database": "connected",
  "services": [ /* service statuses */ ]
}
```

## Error Responses

All errors follow this format:
```
{
  "success": false,
  "message": "Error description"
}
```

Common status codes:
- 200: Success
- 400: Bad request
- 401: Unauthorized
- 403: Forbidden (insufficient permissions)
- 404: Not found
- 500: Server error
