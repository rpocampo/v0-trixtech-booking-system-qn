const mongoose = require('mongoose');
const logger = require('./logger');

class DataConsistencyService {
  constructor() {
    this.issues = [];
    this.fixes = [];
  }

  // Run comprehensive data consistency checks
  async runConsistencyChecks() {
    this.issues = [];
    this.fixes = [];

    logger.info('Starting data consistency checks');

    try {
      // Check 1: Orphaned bookings (bookings with non-existent users)
      await this.checkOrphanedBookings();

      // Check 2: Orphaned bookings (bookings with non-existent services)
      await this.checkOrphanedServiceBookings();

      // Check 3: Inventory inconsistencies
      await this.checkInventoryConsistency();

      // Check 4: Payment-booking mismatches
      await this.checkPaymentBookingConsistency();

      // Check 5: Cart consistency
      await this.checkCartConsistency();

      // Check 6: Notification consistency
      await this.checkNotificationConsistency();

      logger.info(`Data consistency check completed. Found ${this.issues.length} issues, applied ${this.fixes.length} fixes`);

      return {
        issues: this.issues,
        fixes: this.fixes,
        summary: {
          totalIssues: this.issues.length,
          totalFixes: this.fixes.length,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      logger.error('Error during data consistency checks', error);
      throw error;
    }
  }

  // Check for bookings with non-existent users
  async checkOrphanedBookings() {
    const Booking = mongoose.model('Booking');
    const User = mongoose.model('User');

    const orphanedBookings = await Booking.find({
      customerId: { $exists: true, $ne: null }
    }).populate('customerId', '_id');

    for (const booking of orphanedBookings) {
      if (!booking.customerId) {
        this.issues.push({
          type: 'orphaned_booking',
          severity: 'high',
          description: `Booking ${booking._id} references non-existent user`,
          bookingId: booking._id,
          affectedData: booking.toObject()
        });

        // Fix: Mark booking as belonging to deleted user
        booking.customerId = null;
        await booking.save();
        this.fixes.push(`Marked booking ${booking._id} as belonging to deleted user`);
      }
    }
  }

  // Check for bookings with non-existent services
  async checkOrphanedServiceBookings() {
    const Booking = mongoose.model('Booking');
    const Service = mongoose.model('Service');

    const orphanedServiceBookings = await Booking.find({})
      .populate('serviceId', '_id');

    for (const booking of orphanedServiceBookings) {
      if (!booking.serviceId) {
        this.issues.push({
          type: 'orphaned_service_booking',
          severity: 'critical',
          description: `Booking ${booking._id} references non-existent service`,
          bookingId: booking._id,
          affectedData: booking.toObject()
        });

        // Fix: Cancel the booking
        booking.status = 'cancelled';
        booking.notes = 'Automatically cancelled - service no longer exists';
        await booking.save();
        this.fixes.push(`Cancelled booking ${booking._id} for non-existent service`);
      }
    }
  }

  // Check inventory consistency
  async checkInventoryConsistency() {
    const Service = mongoose.model('Service');
    const Booking = mongoose.model('Booking');

    const equipmentServices = await Service.find({
      serviceType: { $in: ['equipment', 'supply'] },
      isAvailable: true
    });

    for (const service of equipmentServices) {
      // Get confirmed bookings for this service
      const confirmedBookings = await Booking.find({
        serviceId: service._id,
        status: 'confirmed',
        paymentStatus: { $in: ['partial', 'paid'] }
      });

      const totalBooked = confirmedBookings.reduce((sum, booking) => sum + booking.quantity, 0);

      if (totalBooked > service.quantity) {
        this.issues.push({
          type: 'inventory_overbooking',
          severity: 'critical',
          description: `Service ${service.name} is overbooked: ${totalBooked} booked vs ${service.quantity} available`,
          serviceId: service._id,
          serviceName: service.name,
          bookedQuantity: totalBooked,
          availableQuantity: service.quantity
        });

        // Fix: Cancel excess bookings (oldest first)
        const excessBookings = confirmedBookings
          .sort((a, b) => a.createdAt - b.createdAt)
          .slice(service.quantity);

        for (const booking of excessBookings) {
          booking.status = 'cancelled';
          booking.notes = 'Automatically cancelled due to inventory inconsistency';
          await booking.save();
          this.fixes.push(`Cancelled overbooked booking ${booking._id} for service ${service.name}`);
        }
      }
    }
  }

  // Check payment-booking consistency
  async checkPaymentBookingConsistency() {
    const Payment = mongoose.model('Payment');
    const Booking = mongoose.model('Booking');

    // Check payments with non-existent bookings
    const paymentsWithBookings = await Payment.find({
      bookingId: { $exists: true, $ne: null }
    }).populate('bookingId', '_id');

    for (const payment of paymentsWithBookings) {
      if (!payment.bookingId) {
        this.issues.push({
          type: 'orphaned_payment',
          severity: 'medium',
          description: `Payment ${payment._id} references non-existent booking`,
          paymentId: payment._id,
          affectedData: payment.toObject()
        });

        // Fix: Mark payment as orphaned
        payment.bookingId = null;
        payment.status = 'failed';
        payment.failureReason = 'Booking no longer exists';
        await payment.save();
        this.fixes.push(`Marked orphaned payment ${payment._id} as failed`);
      }
    }

    // Check bookings with missing payments
    const paidBookings = await Booking.find({
      paymentStatus: { $in: ['partial', 'paid'] }
    });

    for (const booking of paidBookings) {
      const payment = await Payment.findOne({
        bookingId: booking._id,
        status: 'completed'
      });

      if (!payment) {
        this.issues.push({
          type: 'missing_payment',
          severity: 'high',
          description: `Booking ${booking._id} is marked as paid but has no completed payment`,
          bookingId: booking._id,
          affectedData: booking.toObject()
        });

        // Fix: Mark booking as unpaid
        booking.paymentStatus = 'unpaid';
        booking.status = 'pending';
        await booking.save();
        this.fixes.push(`Reset payment status for booking ${booking._id} with missing payment`);
      }
    }
  }

  // Check cart consistency
  async checkCartConsistency() {
    const Cart = mongoose.model('Cart');
    const Service = mongoose.model('Service');

    const carts = await Cart.find({}).populate('items.serviceId', '_id isAvailable quantity');

    for (const cart of carts) {
      const itemsToRemove = [];

      for (const item of cart.items) {
        if (!item.serviceId) {
          // Service no longer exists
          itemsToRemove.push(item._id);
          this.issues.push({
            type: 'cart_orphaned_item',
            severity: 'low',
            description: `Cart item references non-existent service`,
            cartId: cart._id,
            userId: cart.userId,
            itemId: item._id
          });
        } else if (!item.serviceId.isAvailable) {
          // Service no longer available
          itemsToRemove.push(item._id);
          this.issues.push({
            type: 'cart_unavailable_item',
            severity: 'low',
            description: `Cart contains unavailable service ${item.serviceId._id}`,
            cartId: cart._id,
            userId: cart.userId,
            serviceId: item.serviceId._id
          });
        } else if (item.serviceId.quantity !== undefined &&
                   item.serviceId.quantity < item.quantity) {
          // Insufficient stock
          this.issues.push({
            type: 'cart_insufficient_stock',
            severity: 'medium',
            description: `Cart has ${item.quantity} of service but only ${item.serviceId.quantity} available`,
            cartId: cart._id,
            userId: cart.userId,
            serviceId: item.serviceId._id,
            requestedQuantity: item.quantity,
            availableQuantity: item.serviceId.quantity
          });

          // Fix: Reduce quantity to available amount
          item.quantity = item.serviceId.quantity;
          this.fixes.push(`Reduced cart item quantity for service ${item.serviceId._id} to ${item.serviceId.quantity}`);
        }
      }

      // Remove invalid items
      if (itemsToRemove.length > 0) {
        cart.items = cart.items.filter(item => !itemsToRemove.includes(item._id));
        await cart.save();
        this.fixes.push(`Removed ${itemsToRemove.length} invalid items from cart ${cart._id}`);
      } else if (cart.items.some(item => item.isModified())) {
        await cart.save();
      }
    }
  }

  // Check notification consistency
  async checkNotificationConsistency() {
    const Notification = mongoose.model('Notification');
    const User = mongoose.model('User');

    // Check notifications for non-existent users
    const notifications = await Notification.find({
      userId: { $exists: true, $ne: null }
    }).populate('userId', '_id');

    for (const notification of notifications) {
      if (!notification.userId) {
        this.issues.push({
          type: 'orphaned_notification',
          severity: 'low',
          description: `Notification ${notification._id} references non-existent user`,
          notificationId: notification._id,
          affectedData: notification.toObject()
        });

        // Fix: Delete orphaned notification
        await Notification.findByIdAndDelete(notification._id);
        this.fixes.push(`Deleted orphaned notification ${notification._id}`);
      }
    }
  }

  // Get consistency report
  getConsistencyReport() {
    const report = {
      timestamp: new Date().toISOString(),
      issues: this.issues,
      fixes: this.fixes,
      summary: {
        totalIssues: this.issues.length,
        totalFixes: this.fixes.length,
        issuesBySeverity: {
          critical: this.issues.filter(i => i.severity === 'critical').length,
          high: this.issues.filter(i => i.severity === 'high').length,
          medium: this.issues.filter(i => i.severity === 'medium').length,
          low: this.issues.filter(i => i.severity === 'low').length
        },
        issuesByType: {}
      }
    };

    // Group issues by type
    this.issues.forEach(issue => {
      report.summary.issuesByType[issue.type] = (report.summary.issuesByType[issue.type] || 0) + 1;
    });

    return report;
  }
}

// Create singleton instance
const dataConsistencyService = new DataConsistencyService();

module.exports = {
  DataConsistencyService,
  dataConsistencyService
};