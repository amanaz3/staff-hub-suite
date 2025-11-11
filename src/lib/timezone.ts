import { toZonedTime, fromZonedTime, format as formatTz } from 'date-fns-tz';
import { format } from 'date-fns';

// Gulf Standard Time (UAE) - UTC+4
export const GST_TIMEZONE = 'Asia/Dubai';

/**
 * Get current date/time in GST
 */
export function nowInGST(): Date {
  return toZonedTime(new Date(), GST_TIMEZONE);
}

/**
 * Get today's date in GST as YYYY-MM-DD string
 */
export function todayInGST(): string {
  const gstNow = nowInGST();
  return format(gstNow, 'yyyy-MM-dd');
}

/**
 * Convert any date to GST timezone
 */
export function toGST(date: Date | string): Date {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return toZonedTime(dateObj, GST_TIMEZONE);
}

/**
 * Convert GST date to UTC for storage
 */
export function fromGST(date: Date): Date {
  return fromZonedTime(date, GST_TIMEZONE);
}

/**
 * Format a date in GST timezone
 * @param date - Date to format
 * @param formatStr - Format string (date-fns format)
 */
export function formatInGST(date: Date | string, formatStr: string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return formatTz(dateObj, formatStr, { timeZone: GST_TIMEZONE });
}

/**
 * Get current time in GST as ISO string (for database storage)
 */
export function nowInGSTISO(): string {
  return nowInGST().toISOString();
}

/**
 * Parse a date string and return it in GST
 */
export function parseInGST(dateString: string, timeString?: string): Date {
  if (timeString) {
    // Combine date and time, then convert to GST
    const combined = `${dateString}T${timeString}`;
    return toGST(combined);
  }
  return toGST(dateString);
}

/**
 * Create a Date object in GST from date and time components
 */
export function createGSTDate(
  year: number, 
  month: number, 
  day: number, 
  hours: number = 0, 
  minutes: number = 0, 
  seconds: number = 0
): Date {
  // Create date in GST context
  const localDate = new Date(year, month, day, hours, minutes, seconds);
  return fromZonedTime(localDate, GST_TIMEZONE);
}

/**
 * Check if a date/time is in the future (GST context)
 */
export function isFutureInGST(date: Date | string): boolean {
  const checkDate = toGST(date);
  const now = nowInGST();
  return checkDate > now;
}

/**
 * Get start of day in GST
 */
export function startOfDayGST(date: Date | string): Date {
  const gstDate = toGST(date);
  gstDate.setHours(0, 0, 0, 0);
  return gstDate;
}

/**
 * Get end of day in GST
 */
export function endOfDayGST(date: Date | string): Date {
  const gstDate = toGST(date);
  gstDate.setHours(23, 59, 59, 999);
  return gstDate;
}
