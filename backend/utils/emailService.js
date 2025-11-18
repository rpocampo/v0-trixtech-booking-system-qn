const nodemailer = require('nodemailer');

let transporter = null;

// Initialize email transporter
const initializeEmailService = () => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    console.log('Email service disabled - EMAIL_USER or EMAIL_PASSWORD not configured');
    return null;
  }

  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  console.log('Email service initialized');
  return transporter;
};

// Send booking confirmation email
const sendBookingConfirmation = async (email, bookingDetails) => {
  if (!transporter) return; // Skip if email not configured

  const mailOptions = {
    from: process.env.SENDER_EMAIL || 'noreply@trixtech.com',
    to: email,
    subject: 'Booking Confirmation - TRIXTECH',
    html: `
      <h2>Your booking has been confirmed!</h2>
      <p><strong>Service:</strong> ${bookingDetails.serviceName}</p>
      ${bookingDetails.quantity > 1 ? `<p><strong>Quantity:</strong> ${bookingDetails.quantity}</p>` : ''}
      <p><strong>Date:</strong> ${new Date(bookingDetails.date).toLocaleDateString()}</p>
      <p><strong>Time:</strong> ${bookingDetails.time}</p>
      <p><strong>Total Price:</strong> ₱${bookingDetails.totalPrice}</p>
      <p>Thank you for booking with TRIXTECH!</p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Booking confirmation sent to ${email}`);
  } catch (error) {
    console.error('Error sending email:', error);
  }
};

// Send booking cancellation email
const sendCancellationEmail = async (email, bookingDetails) => {
  if (!transporter) return;

  const mailOptions = {
    from: process.env.SENDER_EMAIL || 'noreply@trixtech.com',
    to: email,
    subject: 'Booking Cancelled - TRIXTECH',
    html: `
      <h2>Your booking has been cancelled</h2>
      <p><strong>Service:</strong> ${bookingDetails.serviceName}</p>
      ${bookingDetails.quantity > 1 ? `<p><strong>Quantity:</strong> ${bookingDetails.quantity}</p>` : ''}
      <p><strong>Date:</strong> ${new Date(bookingDetails.date).toLocaleDateString()}</p>
      <p>If you have any questions, please contact our support team.</p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Cancellation email sent to ${email}`);
  } catch (error) {
    console.error('Error sending email:', error);
  }
};

// Send admin notification for new booking
const sendAdminBookingNotification = async (bookingDetails, customerDetails) => {
  if (!transporter || !process.env.ADMIN_EMAIL) return;

  const mailOptions = {
    from: process.env.SENDER_EMAIL || 'noreply@trixtech.com',
    to: process.env.ADMIN_EMAIL,
    subject: 'New Booking Received - TRIXTECH',
    html: `
      <h2>New Booking Alert!</h2>
      <p><strong>Customer:</strong> ${customerDetails.name} (${customerDetails.email})</p>
      <p><strong>Service:</strong> ${bookingDetails.serviceName}</p>
      ${bookingDetails.quantity > 1 ? `<p><strong>Quantity:</strong> ${bookingDetails.quantity}</p>` : ''}
      <p><strong>Date:</strong> ${new Date(bookingDetails.date).toLocaleDateString()}</p>
      <p><strong>Total Price:</strong> ₱${bookingDetails.totalPrice}</p>
      <p>Please review and confirm the booking.</p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Admin notification sent for new booking`);
  } catch (error) {
    console.error('Error sending admin email:', error);
  }
};

// Send low stock alert to admin
const sendLowStockAlert = async (serviceName, currentQuantity) => {
  if (!transporter || !process.env.ADMIN_EMAIL) return;

  const mailOptions = {
    from: process.env.SENDER_EMAIL || 'noreply@trixtech.com',
    to: process.env.ADMIN_EMAIL,
    subject: 'Low Stock Alert - TRIXTECH',
    html: `
      <h2>Low Stock Alert!</h2>
      <p><strong>Service:</strong> ${serviceName}</p>
      <p><strong>Current Quantity:</strong> ${currentQuantity}</p>
      <p>Please restock this item soon.</p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Low stock alert sent for ${serviceName}`);
  } catch (error) {
    console.error('Error sending low stock email:', error);
  }
};

module.exports = {
  initializeEmailService,
  sendBookingConfirmation,
  sendCancellationEmail,
  sendAdminBookingNotification,
  sendLowStockAlert,
};
