import jwt from 'jsonwebtoken';
import logger from './logger.js';

export const generateToken = (userId) => {
  if (!process.env.JWT_SECRET) {
    logger.error('JWT_SECRET is not set - cannot generate token');
    throw new Error('JWT_SECRET is not configured');
  }

  if (!userId) {
    logger.error('User ID is required to generate token');
    throw new Error('User ID is required');
  }

  try {
    return jwt.sign(
      { userId },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
      }
    );
  } catch (error) {
    logger.error('Error generating JWT token', { error: error.message, userId });
    throw error;
  }
};

export const verifyToken = (token) => {
  if (!process.env.JWT_SECRET) {
    logger.error('JWT_SECRET is not set - cannot verify token');
    throw new Error('JWT_SECRET is not configured');
  }

  if (!token) {
    throw new Error('Token is required');
  }

  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    logger.warn('Token verification failed', { error: error.name, message: error.message });
    throw error;
  }
};





