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

export function toGST(utcDate: Date | string): Date {
  const date = typeof utcDate === 'string' ? new Date(utcDate) : utcDate;
  return new Date(date.getTime() + GST_OFFSET_MS);
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

export function formatTime12Hour(date: Date): string {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  const displayMinutes = minutes.toString().padStart(2, '0');
  return `${displayHours}:${displayMinutes} ${ampm}`;
}

export function parseScheduledTime(dateString: string, timeString: string): Date {
  const [hours, minutes] = timeString.split(':').map(Number);
  // Create date in UTC, then adjust for GST
  const date = new Date(dateString + 'T00:00:00Z');
  date.setUTCHours(hours - GST_OFFSET_HOURS, minutes, 0, 0);
  return date;
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
