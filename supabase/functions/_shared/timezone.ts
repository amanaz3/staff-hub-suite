/**
 * Gulf Standard Time utilities for Deno edge functions
 * GST is UTC+4 (no DST)
 */

const GST_OFFSET_HOURS = 4;
const GST_OFFSET_MS = GST_OFFSET_HOURS * 60 * 60 * 1000;

export function nowInGST(): Date {
  const utc = new Date();
  return new Date(utc.getTime() + GST_OFFSET_MS);
}

/**
 * Parse schedule time (in GST) as UTC timestamp for accurate comparison
 * @param dateString - Date in YYYY-MM-DD format
 * @param timeString - Time in HH:MM or HH:MM:SS format (GST)
 * @returns Date object in UTC (for comparison with database timestamps)
 */
export function parseScheduledTimeAsUTC(dateString: string, timeString: string): Date {
  const [hours, minutes] = timeString.split(':').map(Number);
  const date = new Date(dateString + 'T00:00:00Z');
  // Schedule time is in GST, convert to UTC by subtracting offset
  date.setUTCHours(hours - GST_OFFSET_HOURS, minutes, 0, 0);
  return date;
}

export function todayInGST(): string {
  const gst = nowInGST();
  return gst.toISOString().split('T')[0];
}

export function yesterdayInGST(): string {
  const gst = nowInGST();
  gst.setDate(gst.getDate() - 1);
  return gst.toISOString().split('T')[0];
}

/**
 * Format UTC timestamp as GST time for display
 * @param utcDate - Date object (with UTC time)
 * @returns Formatted time string in 12-hour format (GST)
 */
export function formatTimeInGST(utcDate: Date): string {
  // Get UTC hours and add GST offset to display GST time
  let gstHours = utcDate.getUTCHours() + GST_OFFSET_HOURS;
  const minutes = utcDate.getUTCMinutes();
  
  // Handle day overflow (e.g., 23:00 UTC + 4 = 27:00 → 3:00 AM next day)
  gstHours = gstHours % 24;
  
  const displayHours = gstHours % 12 || 12;
  const ampm = gstHours >= 12 ? 'PM' : 'AM';
  const displayMinutes = minutes.toString().padStart(2, '0');
  
  return `${displayHours}:${displayMinutes} ${ampm}`;
}

// Legacy function - kept for backward compatibility but renamed
export function formatTime12Hour(date: Date): string {
  return formatTimeInGST(date);
}

// Legacy function - kept for backward compatibility
export function parseScheduledTime(dateString: string, timeString: string): Date {
  return parseScheduledTimeAsUTC(dateString, timeString);
}

export function getDayName(date: Date): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[date.getDay()];
}

export function isWorkingDay(date: Date, workingDays: string[]): boolean {
  if (!workingDays || workingDays.length === 0) {
    // Default: All days except Sunday
    return date.getDay() !== 0;
  }
  const dayName = getDayName(date);
  return workingDays.includes(dayName);
}
