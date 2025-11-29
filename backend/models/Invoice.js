const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
      required: true,
    },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
    },
    invoiceDate: {
      type: Date,
      default: Date.now,
    },
    dueDate: {
      type: Date,
    },
    items: [{
      description: {
        type: String,
        required: true,
      },
      quantity: {
        type: Number,
        required: true,
        min: 1,
      },
      unitPrice: {
        type: Number,
        required: true,
        min: 0,
      },
      totalPrice: {
        type: Number,
        required: true,
        min: 0,
      },
      serviceType: {
        type: String,
        enum: ['service', 'equipment', 'supply'],
      },
    }],
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    taxRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 1,
    },
    taxAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    discountAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'PHP',
    },
    status: {
      type: String,
      enum: ['draft', 'sent', 'paid', 'overdue', 'cancelled'],
      default: 'draft',
    },
    paymentStatus: {
      type: String,
      enum: ['unpaid', 'partial', 'paid'],
      default: 'unpaid',
    },
    notes: {
      type: String,
    },
    billingAddress: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String,
    },
    paymentTerms: {
      type: String,
      default: 'Due upon receipt',
    },
    generatedBy: {
      type: String,
      enum: ['system', 'admin'],
      default: 'system',
    },
    sentAt: Date,
    paidAt: Date,
    reminderSentAt: Date,
    pdfUrl: String,
    emailSent: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Generate unique invoice number
invoiceSchema.statics.generateInvoiceNumber = function() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `INV-${year}${month}-${random}`;
};

// Auto-generate invoice number before saving
invoiceSchema.pre('save', async function(next) {
  if (!this.invoiceNumber) {
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!isUnique && attempts < maxAttempts) {
      const invoiceNumber = this.constructor.generateInvoiceNumber();
      const existing = await this.constructor.findOne({ invoiceNumber });
      if (!existing) {
        this.invoiceNumber = invoiceNumber;
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) {
      return next(new Error('Could not generate unique invoice number'));
    }
  }
  next();
});

// Calculate totals before saving
invoiceSchema.pre('save', function(next) {
  // Calculate subtotal from items
  this.subtotal = this.items.reduce((sum, item) => sum + item.totalPrice, 0);

  // Calculate tax
  this.taxAmount = this.subtotal * this.taxRate;

  // Calculate total
  this.totalAmount = this.subtotal + this.taxAmount - this.discountAmount;

  next();
});

// Instance method to mark as paid
invoiceSchema.methods.markAsPaid = function(paymentDate = new Date()) {
  this.status = 'paid';
  this.paymentStatus = 'paid';
  this.paidAt = paymentDate;
  return this.save();
};

// Instance method to send reminder
invoiceSchema.methods.sendReminder = function() {
  this.reminderSentAt = new Date();
  return this.save();
};

// Static method to get overdue invoices
invoiceSchema.statics.getOverdueInvoices = function() {
  return this.find({
    status: { $in: ['sent', 'draft'] },
    dueDate: { $lt: new Date() },
    paymentStatus: { $ne: 'paid' }
  }).populate('customerId', 'name email').populate('bookingId');
};

// Static method to auto-generate invoice from booking
invoiceSchema.statics.generateFromBooking = async function(bookingId) {
  const Booking = require('./Booking');
  const Service = require('./Service');

  const booking = await Booking.findById(bookingId)
    .populate('serviceId')
    .populate('customerId', 'name email');

  if (!booking) {
    throw new Error('Booking not found');
  }

  if (!booking.serviceId) {
    throw new Error('Service information not available');
  }

  // Check if invoice already exists for this booking
  const existingInvoice = await this.findOne({ bookingId });
  if (existingInvoice) {
    return existingInvoice;
  }

  // Create invoice items
  const items = [{
    description: `${booking.serviceId.name} - ${booking.serviceId.category}`,
    quantity: booking.quantity || 1,
    unitPrice: booking.basePrice || booking.serviceId.basePrice || 0,
    totalPrice: booking.totalPrice || 0,
    serviceType: booking.serviceId.serviceType,
  }];

  // Add delivery fee if applicable
  if (booking.serviceId.deliveryFee && booking.serviceId.deliveryFee > 0) {
    items.push({
      description: 'Delivery Fee',
      quantity: 1,
      unitPrice: booking.serviceId.deliveryFee,
      totalPrice: booking.serviceId.deliveryFee,
      serviceType: 'service',
    });
  }

  // Calculate due date (30 days from invoice date)
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 30);

  // Generate invoice number manually to ensure it's set before validation
  const invoiceNumber = this.generateInvoiceNumber();

  const invoice = new this({
    invoiceNumber, // Explicitly set invoice number
    bookingId: booking._id,
    customerId: booking.customerId._id,
    serviceId: booking.serviceId._id,
    paymentId: booking.paymentId,
    items,
    subtotal: booking.totalPrice,
    totalAmount: booking.totalPrice,
    dueDate,
    status: 'sent', // Auto-send when generated
    paymentStatus: booking.paymentStatus === 'paid' ? 'paid' : 'unpaid',
    notes: booking.notes,
    generatedBy: 'system',
    sentAt: new Date(),
  });

  if (booking.paymentStatus === 'paid') {
    invoice.paidAt = booking.updatedAt || new Date();
  }

  await invoice.save();
  await invoice.populate('customerId', 'name email');
  await invoice.populate('serviceId', 'name category');

  console.log(`Invoice ${invoice.invoiceNumber} generated for booking ${bookingId}`);
  return invoice;
};

module.exports = mongoose.model('Invoice', invoiceSchema);