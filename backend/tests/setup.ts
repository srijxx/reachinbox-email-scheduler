import dotenv from 'dotenv';
import path from 'path';

// Load test environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Ensure test environment
process.env.NODE_ENV = 'test';

// Provide dummy values for required env vars in unit tests
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'mysql://test:test@localhost:3306/test';
}
if (!process.env.SESSION_SECRET) {
  process.env.SESSION_SECRET = 'test-secret';
}
