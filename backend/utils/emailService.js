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
      <p><strong>Date:</strong> ${new Date(bookingDetails.date).toLocaleDateString()}</p>
      <p><strong>Time:</strong> ${bookingDetails.time}</p>
      <p><strong>Price:</strong> $${bookingDetails.price}</p>
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

module.exports = {
  initializeEmailService,
  sendBookingConfirmation,
  sendCancellationEmail,
};
