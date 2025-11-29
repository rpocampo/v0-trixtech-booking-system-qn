const Invoice = require('../models/Invoice');
const { sendTemplateNotification } = require('./notificationService');
const path = require('path');
const fs = require('fs').promises;

// Generate invoice from booking
const generateInvoiceFromBooking = async (bookingId) => {
  try {
    const invoice = await Invoice.generateFromBooking(bookingId);
    console.log(`Invoice ${invoice.invoiceNumber} generated for booking ${bookingId}`);
    return invoice;
  } catch (error) {
    console.error('Error generating invoice from booking:', error);
    throw error;
  }
};

// Send invoice email to customer
const sendInvoiceEmail = async (invoiceId) => {
  try {
    const invoice = await Invoice.findById(invoiceId)
      .populate('customerId', 'name email')
      .populate('serviceId', 'name')
      .populate('bookingId');

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    const customer = invoice.customerId;
    if (!customer || !customer.email) {
      console.warn(`No email found for customer ${customer?._id}, skipping invoice email`);
      return;
    }

    // Format invoice items for email
    const itemsText = invoice.items.map(item =>
      `• ${item.description} - ${item.quantity}x ₱${item.unitPrice.toFixed(2)} = ₱${item.totalPrice.toFixed(2)}`
    ).join('\n');

    const emailContent = {
      subject: `Invoice ${invoice.invoiceNumber} - TRIXTECH`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Invoice ${invoice.invoiceNumber}</h2>

          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>Invoice Details</h3>
            <p><strong>Invoice Number:</strong> ${invoice.invoiceNumber}</p>
            <p><strong>Invoice Date:</strong> ${invoice.invoiceDate.toLocaleDateString()}</p>
            <p><strong>Due Date:</strong> ${invoice.dueDate.toLocaleDateString()}</p>
            <p><strong>Service:</strong> ${invoice.serviceId?.name || 'Service'}</p>
          </div>

          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>Items</h3>
            <pre style="font-family: Arial, sans-serif; white-space: pre-line;">${itemsText}</pre>
          </div>

          <div style="background: #ecfdf5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
            <h3 style="margin: 0 0 10px 0; color: #059669;">Total Amount</h3>
            <p style="font-size: 24px; font-weight: bold; margin: 0; color: #059669;">
              ₱${invoice.totalAmount.toFixed(2)}
            </p>
            <p style="margin: 10px 0 0 0; color: #065f46;">
              Status: ${invoice.paymentStatus === 'paid' ? '✅ Paid' : '⏳ ' + invoice.paymentStatus}
            </p>
          </div>

          <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; color: #92400e;">
              <strong>Payment Terms:</strong> ${invoice.paymentTerms}
            </p>
          </div>

          <p style="color: #6b7280; font-size: 14px;">
            Thank you for your business! If you have any questions about this invoice,
            please contact our support team.
          </p>

          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

          <div style="text-align: center; color: #9ca3af; font-size: 12px;">
            <p>TRIXTECH Booking System</p>
            <p>📧 support@trixtech.com | 📞 (02) 123-4567</p>
          </div>
        </div>
      `,
      text: `
Invoice ${invoice.invoiceNumber}

Invoice Details:
- Invoice Number: ${invoice.invoiceNumber}
- Invoice Date: ${invoice.invoiceDate.toLocaleDateString()}
- Due Date: ${invoice.dueDate.toLocaleDateString()}
- Service: ${invoice.serviceId?.name || 'Service'}

Items:
${itemsText}

Total Amount: ₱${invoice.totalAmount.toFixed(2)}
Status: ${invoice.paymentStatus === 'paid' ? 'Paid' : invoice.paymentStatus}

Payment Terms: ${invoice.paymentTerms}

Thank you for your business! If you have any questions about this invoice,
please contact our support team.

TRIXTECH Booking System
support@trixtech.com | (02) 123-4567
      `
    };

    // Send email using existing email service
    const { sendEmail } = require('./emailService');
    await sendEmail(customer.email, emailContent.subject, emailContent.html, emailContent.text);

    // Mark invoice as emailed
    invoice.emailSent = true;
    await invoice.save();

    console.log(`Invoice email sent to ${customer.email} for invoice ${invoice.invoiceNumber}`);

    // Send in-app notification
    await sendTemplateNotification(customer._id, 'INVOICE_SENT', {
      message: `Your invoice ${invoice.invoiceNumber} has been sent to your email.`,
      metadata: {
        invoiceId: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        amount: invoice.totalAmount,
      }
    });

    return true;
  } catch (error) {
    console.error('Error sending invoice email:', error);
    throw error;
  }
};

// Generate PDF invoice (placeholder for future implementation)
const generateInvoicePDF = async (invoiceId) => {
  try {
    // This would integrate with a PDF generation library like pdfkit or puppeteer
    // For now, we'll just return a placeholder URL
    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      throw new Error('Invoice not found');
    }

    // Placeholder PDF URL - in production, this would generate an actual PDF
    const pdfUrl = `/invoices/${invoice.invoiceNumber}.pdf`;
    invoice.pdfUrl = pdfUrl;
    await invoice.save();

    return pdfUrl;
  } catch (error) {
    console.error('Error generating invoice PDF:', error);
    throw error;
  }
};

// Send payment reminder for overdue invoices
const sendPaymentReminder = async (invoiceId) => {
  try {
    const invoice = await Invoice.findById(invoiceId)
      .populate('customerId', 'name email')
      .populate('serviceId', 'name');

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    const customer = invoice.customerId;
    if (!customer || !customer.email) {
      console.warn(`No email found for customer ${customer?._id}, skipping reminder`);
      return;
    }

    const daysOverdue = Math.floor((new Date() - invoice.dueDate) / (1000 * 60 * 60 * 24));

    const emailContent = {
      subject: `Payment Reminder - Invoice ${invoice.invoiceNumber}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc2626;">Payment Reminder</h2>

          <div style="background: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
            <p>Dear ${customer.name},</p>
            <p>Your invoice <strong>${invoice.invoiceNumber}</strong> is ${daysOverdue} days overdue.</p>
            <p><strong>Amount Due:</strong> ₱${invoice.totalAmount.toFixed(2)}</p>
            <p><strong>Due Date:</strong> ${invoice.dueDate.toLocaleDateString()}</p>
          </div>

          <p>Please arrange payment at your earliest convenience to avoid any service interruptions.</p>

          <div style="background: #ecfdf5; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Payment Methods:</strong></p>
            <ul style="margin: 10px 0 0 20px;">
              <li>GCash QR Code</li>
              <li>Bank Transfer</li>
              <li>Cash Payment</li>
            </ul>
          </div>

          <p>If you've already made the payment, please disregard this reminder.</p>

          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

          <div style="text-align: center; color: #9ca3af; font-size: 12px;">
            <p>TRIXTECH Booking System</p>
            <p>📧 support@trixtech.com | 📞 (02) 123-4567</p>
          </div>
        </div>
      `,
      text: `
Payment Reminder

Dear ${customer.name},

Your invoice ${invoice.invoiceNumber} is ${daysOverdue} days overdue.

Amount Due: ₱${invoice.totalAmount.toFixed(2)}
Due Date: ${invoice.dueDate.toLocaleDateString()}

Please arrange payment at your earliest convenience to avoid any service interruptions.

Payment Methods:
- GCash QR Code
- Bank Transfer
- Cash Payment

If you've already made the payment, please disregard this reminder.

TRIXTECH Booking System
support@trixtech.com | (02) 123-4567
      `
    };

    const { sendEmail } = require('./emailService');
    await sendEmail(customer.email, emailContent.subject, emailContent.html, emailContent.text);

    // Mark reminder as sent
    await invoice.sendReminder();

    console.log(`Payment reminder sent to ${customer.email} for invoice ${invoice.invoiceNumber}`);

    return true;
  } catch (error) {
    console.error('Error sending payment reminder:', error);
    throw error;
  }
};

// Process overdue invoices and send reminders
const processOverdueInvoices = async () => {
  try {
    const overdueInvoices = await Invoice.getOverdueInvoices();

    console.log(`Found ${overdueInvoices.length} overdue invoices`);

    for (const invoice of overdueInvoices) {
      // Only send reminder if we haven't sent one in the last 7 days
      const lastReminder = invoice.reminderSentAt;
      const shouldSendReminder = !lastReminder ||
        (new Date() - lastReminder) > (7 * 24 * 60 * 60 * 1000); // 7 days

      if (shouldSendReminder) {
        try {
          await sendPaymentReminder(invoice._id);
          console.log(`Reminder sent for overdue invoice ${invoice.invoiceNumber}`);
        } catch (error) {
          console.error(`Failed to send reminder for invoice ${invoice.invoiceNumber}:`, error);
        }
      }
    }

    return overdueInvoices.length;
  } catch (error) {
    console.error('Error processing overdue invoices:', error);
    throw error;
  }
};

// Auto-generate and send invoice when booking is confirmed
const handleBookingConfirmed = async (bookingId) => {
  try {
    console.log(`Auto-generating invoice for confirmed booking ${bookingId}`);

    // Generate invoice
    const invoice = await generateInvoiceFromBooking(bookingId);

    // Send invoice email
    await sendInvoiceEmail(invoice._id);

    console.log(`Invoice ${invoice.invoiceNumber} auto-generated and sent for booking ${bookingId}`);

    return invoice;
  } catch (error) {
    console.error('Error in auto-invoice generation for booking:', error);
    // Don't throw error to avoid breaking the booking flow
  }
};

module.exports = {
  generateInvoiceFromBooking,
  sendInvoiceEmail,
  generateInvoicePDF,
  sendPaymentReminder,
  processOverdueInvoices,
  handleBookingConfirmed,
};