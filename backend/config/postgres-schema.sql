-- PostgreSQL Schema for TrixTech Booking System
-- Migrated from MongoDB

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
    phone VARCHAR(50),
    address TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    email_verified BOOLEAN DEFAULT FALSE,
    payment_qr_code TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Event types table
CREATE TABLE event_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    category VARCHAR(100),
    typical_guest_count JSONB, -- {min, max, suggested}
    typical_duration INTEGER, -- in minutes
    recommended_services JSONB, -- array of {category, priority, isRequired}
    recommended_packages JSONB, -- array of package references
    icon VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Services table
CREATE TABLE services (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    short_description TEXT,
    category VARCHAR(100) NOT NULL CHECK (category IN ('equipment', 'party', 'corporate', 'wedding', 'birthday', 'funeral')),
    service_type VARCHAR(50) DEFAULT 'service' CHECK (service_type IN ('service', 'equipment', 'supply')),
    event_types TEXT[], -- array of event types
    base_price DECIMAL(10,2) NOT NULL CHECK (base_price >= 0),
    price_type VARCHAR(50) DEFAULT 'flat-rate' CHECK (price_type IN ('per-hour', 'per-day', 'per-event', 'per-person', 'per-item', 'flat-rate')),
    pricing_tiers JSONB, -- array of {daysBefore, multiplier, label}
    duration INTEGER, -- in minutes, required for service type
    image TEXT,
    gallery TEXT[], -- array of image URLs
    is_available BOOLEAN DEFAULT TRUE,
    quantity INTEGER DEFAULT 1 CHECK (quantity >= 0),
    location VARCHAR(50) DEFAULT 'both' CHECK (location IN ('indoor', 'outdoor', 'both')),
    tags TEXT[], -- array of tags
    features TEXT[], -- array of features
    included_items TEXT[], -- array of included items
    requirements TEXT[], -- array of requirements
    min_order INTEGER DEFAULT 1 CHECK (min_order >= 1),
    max_order INTEGER CHECK (max_order >= min_order),
    lead_time INTEGER DEFAULT 24, -- hours
    delivery_required BOOLEAN DEFAULT FALSE,
    delivery_fee DECIMAL(10,2) DEFAULT 0 CHECK (delivery_fee >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Service batches table (for inventory tracking)
CREATE TABLE service_batches (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    batch_id VARCHAR(255) NOT NULL,
    supplier VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity >= 0),
    unit_cost DECIMAL(10,2) CHECK (unit_cost >= 0),
    purchase_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expiry_date TIMESTAMP WITH TIME ZONE,
    location VARCHAR(255), -- warehouse location
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(service_id, batch_id)
);

-- Packages table
CREATE TABLE packages (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    event_types TEXT[], -- array of event types
    base_price DECIMAL(10,2) NOT NULL CHECK (base_price >= 0),
    inclusions JSONB, -- array of {serviceId, quantity, isRequired, price}
    add_ons JSONB, -- array of {serviceId, quantity, price, isPopular}
    delivery_included BOOLEAN DEFAULT FALSE,
    delivery_fee DECIMAL(10,2) DEFAULT 0 CHECK (delivery_fee >= 0),
    setup_fee DECIMAL(10,2) DEFAULT 0 CHECK (setup_fee >= 0),
    discount_percentage DECIMAL(5,2) DEFAULT 0 CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
    total_price DECIMAL(10,2) NOT NULL CHECK (total_price >= 0),
    min_guests INTEGER,
    max_guests INTEGER,
    duration INTEGER, -- in minutes
    image TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    is_popular BOOLEAN DEFAULT FALSE,
    priority INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Bookings table
CREATE TABLE bookings (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 1),
    booking_date TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
    base_price DECIMAL(10,2) NOT NULL CHECK (base_price >= 0),
    applied_multiplier DECIMAL(5,2) DEFAULT 1.0 CHECK (applied_multiplier >= 0),
    days_before_checkout INTEGER DEFAULT 0,
    total_price DECIMAL(10,2) NOT NULL CHECK (total_price >= 0),
    payment_status VARCHAR(50) DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partial', 'paid')),
    payment_type VARCHAR(50) DEFAULT 'full' CHECK (payment_type IN ('full', 'down_payment', 'remaining_balance')),
    amount_paid DECIMAL(10,2) DEFAULT 0 CHECK (amount_paid >= 0),
    remaining_balance DECIMAL(10,2) DEFAULT 0 CHECK (remaining_balance >= 0),
    down_payment_percentage DECIMAL(5,2) DEFAULT 30 CHECK (down_payment_percentage >= 0 AND down_payment_percentage <= 100),
    notes TEXT,
    duration INTEGER DEFAULT 1 CHECK (duration >= 1), -- in days
    daily_rate DECIMAL(10,2) DEFAULT 0 CHECK (daily_rate >= 0),
    requires_delivery BOOLEAN DEFAULT FALSE,
    delivery_start_time TIMESTAMP WITH TIME ZONE,
    delivery_end_time TIMESTAMP WITH TIME ZONE,
    delivery_duration INTEGER DEFAULT 60 CHECK (delivery_duration > 0), -- in minutes
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Cart table
CREATE TABLE carts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    total_items INTEGER DEFAULT 0 CHECK (total_items >= 0),
    total_price DECIMAL(10,2) DEFAULT 0 CHECK (total_price >= 0),
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- Cart items table
CREATE TABLE cart_items (
    id SERIAL PRIMARY KEY,
    cart_id INTEGER NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL CHECK (quantity >= 1),
    added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(cart_id, service_id)
);

-- Payments table
CREATE TABLE payments (
    id SERIAL PRIMARY KEY,
    booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(10) DEFAULT 'PHP',
    payment_method VARCHAR(100),
    payment_provider VARCHAR(100),
    payment_type VARCHAR(50) CHECK (payment_type IN ('full', 'down_payment', 'remaining_balance')),
    is_down_payment BOOLEAN DEFAULT FALSE,
    is_final_payment BOOLEAN DEFAULT FALSE,
    transaction_id VARCHAR(255),
    reference_number VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    payment_data JSONB, -- additional payment provider data
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Delivery table
CREATE TABLE deliveries (
    id SERIAL PRIMARY KEY,
    booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    customer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scheduled_date TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_transit', 'delivered', 'cancelled')),
    estimated_duration INTEGER CHECK (estimated_duration > 0), -- in minutes
    actual_start_time TIMESTAMP WITH TIME ZONE,
    actual_end_time TIMESTAMP WITH TIME ZONE,
    delivery_address TEXT NOT NULL,
    contact_person VARCHAR(255),
    contact_phone VARCHAR(50),
    items JSONB, -- array of {serviceId, quantity, notes}
    total_weight DECIMAL(10,2), -- in kg
    priority VARCHAR(50) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Notifications table
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(100) NOT NULL,
    priority VARCHAR(50) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    channels TEXT[], -- array of channels (email, sms, push, etc.)
    metadata JSONB, -- additional data
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- OTP table
CREATE TABLE otps (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    otp VARCHAR(10) NOT NULL,
    purpose VARCHAR(100) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    attempts INTEGER DEFAULT 0,
    is_used BOOLEAN DEFAULT FALSE,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Password reset tokens table
CREATE TABLE password_reset_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Reservation queue table
CREATE TABLE reservation_queues (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    requested_quantity INTEGER NOT NULL CHECK (requested_quantity >= 1),
    booking_date TIMESTAMP WITH TIME ZONE NOT NULL,
    priority INTEGER DEFAULT 0,
    priority_reason TEXT,
    vip_level INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'confirmed', 'cancelled')),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    alternative_suggestions JSONB, -- array of alternative service suggestions
    notification_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Booking analytics table
CREATE TABLE booking_analytics (
    id SERIAL PRIMARY KEY,
    main_service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    additional_service_id INTEGER REFERENCES services(id) ON DELETE CASCADE,
    frequency INTEGER DEFAULT 1 CHECK (frequency >= 1),
    confidence DECIMAL(5,4) CHECK (confidence >= 0 AND confidence <= 1),
    last_observed TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    main_category VARCHAR(100),
    additional_category VARCHAR(100),
    average_quantity DECIMAL(10,2) DEFAULT 1,
    total_bookings INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(main_service_id, additional_service_id)
);

-- User preferences table
CREATE TABLE user_preferences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_preferences JSONB, -- array of {category, score, interactionCount, lastInteraction}
    event_type_preferences JSONB, -- array of {eventType, score, bookingCount}
    price_preferences JSONB, -- {preferredMinPrice, preferredMaxPrice, averageSpent}
    booking_patterns JSONB, -- {preferredDays[], preferredTimes[], averageGroupSize, deliveryPreference}
    recently_viewed JSONB, -- array of {serviceId, viewedAt}
    favorites JSONB, -- array of {serviceId, addedAt}
    recommendation_settings JSONB, -- {enablePersonalized, enableCollaborative, maxRecommendations}
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- Indexes for performance
CREATE INDEX idx_bookings_customer_id ON bookings(customer_id);
CREATE INDEX idx_bookings_service_id ON bookings(service_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_payment_status ON bookings(payment_status);
CREATE INDEX idx_bookings_booking_date ON bookings(booking_date);
CREATE INDEX idx_bookings_created_at ON bookings(created_at);

CREATE INDEX idx_services_category ON services(category);
CREATE INDEX idx_services_service_type ON services(service_type);
CREATE INDEX idx_services_is_available ON services(is_available);

CREATE INDEX idx_payments_booking_id ON payments(booking_id);
CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_status ON payments(status);

CREATE INDEX idx_deliveries_booking_id ON deliveries(booking_id);
CREATE INDEX idx_deliveries_customer_id ON deliveries(customer_id);
CREATE INDEX idx_deliveries_scheduled_date ON deliveries(scheduled_date);
CREATE INDEX idx_deliveries_status ON deliveries(status);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_type ON notifications(type);

CREATE INDEX idx_otps_email ON otps(email);
CREATE INDEX idx_otps_expires_at ON otps(expires_at);

CREATE INDEX idx_reservation_queues_customer_id ON reservation_queues(customer_id);
CREATE INDEX idx_reservation_queues_service_id ON reservation_queues(service_id);
CREATE INDEX idx_reservation_queues_status ON reservation_queues(status);
CREATE INDEX idx_reservation_queues_expires_at ON reservation_queues(expires_at);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_event_types_updated_at BEFORE UPDATE ON event_types FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON services FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_packages_updated_at BEFORE UPDATE ON packages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_carts_updated_at BEFORE UPDATE ON carts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_cart_items_updated_at BEFORE UPDATE ON cart_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_deliveries_updated_at BEFORE UPDATE ON deliveries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_notifications_updated_at BEFORE UPDATE ON notifications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_otps_updated_at BEFORE UPDATE ON otps FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_reservation_queues_updated_at BEFORE UPDATE ON reservation_queues FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_booking_analytics_updated_at BEFORE UPDATE ON booking_analytics FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON user_preferences FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();