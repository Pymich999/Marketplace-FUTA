const crypto = require('crypto');
const transporter = require('../config/emailConfig');

// Function to generate 6-digit OTP
const generateOTP = () => {
  return crypto.randomInt(100000, 999999).toString();
};

// Function to send OTP via email using Brevo SMTP
const sendOTPEmail = async (email, otp) => {
  const validatedSenderEmail = 'futamarketplace@gmail.com';
  const mailOptions = {
    from: validatedSenderEmail,
    to: email,
    subject: 'Your OTP Verification Code',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Email Verification</h2>
        <p>Your OTP verification code is:</p>
        <h1 style="font-size: 32px; letter-spacing: 2px; text-align: center; padding: 10px; background-color: #f5f5f5; border-radius: 4px;">${otp}</h1>
        <p>This code will expire in 10 minutes.</p>
        <p>If you didn't request this code, please ignore this email.</p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return info;
  } catch (error) {
    throw new Error(`Failed to send OTP email: ${error.message}`);
  }
};

module.exports = {
  generateOTP,
  sendOTPEmail
};