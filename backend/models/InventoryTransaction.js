const mongoose = require('mongoose');

const inventoryTransactionSchema = new mongoose.Schema(
  {
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
      required: true,
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
    },
    transactionType: {
      type: String,
      enum: ['booking_deduction', 'booking_cancellation', 'manual_adjustment', 'restock'],
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
    },
    previousStock: {
      type: Number,
      required: true,
    },
    newStock: {
      type: Number,
      required: true,
    },
    batchId: {
      type: String,
      // Reference to specific batch if using batch tracking
    },
    reason: {
      type: String,
      required: true,
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      // For manual adjustments, tracks who made the change
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      // Additional data like customer info, booking details, etc.
    },
  },
  { timestamps: true }
);

// Index for efficient queries
inventoryTransactionSchema.index({ serviceId: 1, createdAt: -1 });
inventoryTransactionSchema.index({ bookingId: 1 });
inventoryTransactionSchema.index({ transactionType: 1, createdAt: -1 });

// Static method to log inventory transaction
inventoryTransactionSchema.statics.logTransaction = async function(data) {
  try {
    const transaction = new this(data);
    await transaction.save();

    // Emit real-time event for inventory updates
    const io = global.io;
    if (io) {
      io.emit('inventory-transaction', {
        serviceId: data.serviceId,
        transactionType: data.transactionType,
        quantity: data.quantity,
        newStock: data.newStock,
        timestamp: transaction.createdAt,
      });
    }

    return transaction;
  } catch (error) {
    console.error('Error logging inventory transaction:', error);
    throw error;
  }
};

// Method to get inventory history for a service
inventoryTransactionSchema.statics.getInventoryHistory = async function(serviceId, limit = 50) {
  try {
    return await this.find({ serviceId })
      .populate('bookingId', 'customerId quantity bookingDate')
      .populate('performedBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit);
  } catch (error) {
    console.error('Error getting inventory history:', error);
    return [];
  }
};

// Method to get current stock from transaction history (for validation)
inventoryTransactionSchema.statics.getCurrentStockFromHistory = async function(serviceId) {
  try {
    const latestTransaction = await this.findOne({ serviceId })
      .sort({ createdAt: -1 });

    return latestTransaction ? latestTransaction.newStock : 0;
  } catch (error) {
    console.error('Error getting current stock from history:', error);
    return 0;
  }
};

module.exports = mongoose.model('InventoryTransaction', inventoryTransactionSchema);