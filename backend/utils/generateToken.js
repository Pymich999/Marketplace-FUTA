const jwt = require('jsonwebtoken');

/**
 * Generate a JWT token for user authentication
 * @param {string} userId - The user's ID from MongoDB
 * @returns {string} JWT token
 */
const generateJwtToken = (userId) => {
  // Replace 'your_jwt_secret' with your actual JWT secret from environment variables
  // It's recommended to use process.env.JWT_SECRET in production
  return jwt.sign({ id: userId }, process.env.JWT_SECRET || 'your_jwt_secret', {
    expiresIn: '30d', // Token expires in 30 days
  });
};

module.exports = { generateJwtToken };