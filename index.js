require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');

const app = express();
app.use(express.json());

const RETRY_LIMIT = process.env.RETRY_LIMIT || 3;

let retryCount = 0;

// Create nodemailer transporters for both primary and backup services
const primaryTransporter = nodemailer.createTransport({
  host: process.env.PRIMARY_EMAIL_SERVICE_HOST,
  port: process.env.PRIMARY_EMAIL_SERVICE_PORT,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.PRIMARY_EMAIL_SERVICE_USER,
    pass: process.env.PRIMARY_EMAIL_SERVICE_PASS,
  },
});

const backupTransporter = nodemailer.createTransport({
  host: process.env.BACKUP_EMAIL_SERVICE_HOST,
  port: process.env.BACKUP_EMAIL_SERVICE_PORT,
  secure: false,
  auth: {
    user: process.env.BACKUP_EMAIL_SERVICE_USER,
    pass: process.env.BACKUP_EMAIL_SERVICE_PASS,
  },
});

// Function to send email with retry logic
async function sendEmail(to, subject, text) {
  try {
    // Attempt sending with primary transporter
    await primaryTransporter.sendMail({
      from: 'pranitshah2929@gmail.com',
      to,
      subject,
      text,
    });
    console.log(`Email sent successfully to ${to} using primary service`);
    retryCount = 0; // Reset retry count after success
  } catch (error) {
    console.error(`Primary service failed: ${error.message}`);
    console.error(`Primary service failed: ${error.message}`, error);

    retryCount++;

    if (retryCount < RETRY_LIMIT) {
      console.log(`Retrying (${retryCount}/${RETRY_LIMIT})...`);
      await sendEmail(to, subject, text); // Retry with the primary service
    } else {
      console.log('Switching to backup email service...');
      try {
        await backupTransporter.sendMail({
          from: 'pranitshah2929@gmail.com',
          to,
          subject,
          text,
        });
        console.log(`Email sent successfully to ${to} using backup service`);
      } catch (backupError) {
        console.error(`Backup service failed: ${backupError.message}`);
      }
    }
  }
}

// Define a route to trigger email sending
app.post('/send-email', async (req, res) => {
  const { to, subject, text } = req.body;

  try {
    await sendEmail(to, subject, text);
    res.status(200).send('Email sent successfully');
  } catch (error) {
    res.status(500).send(`Failed to send email: ${error.message}`);
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});