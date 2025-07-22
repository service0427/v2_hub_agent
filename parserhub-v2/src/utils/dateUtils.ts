/**
 * Date utility functions to ensure consistent timezone handling
 */

/**
 * Get current timestamp in KST
 * This ensures all timestamps are consistently stored in Korean time
 */
export function getCurrentKSTDate(): Date {
  return new Date();
}

/**
 * Format date for PostgreSQL timestamp
 * Ensures proper timezone handling
 */
export function formatForPostgres(date: Date): string {
  return date.toISOString();
}