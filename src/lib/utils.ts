import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function calculateServiceDuration(hireDate: Date | string): { years: number; months: number; totalMonths: number } {
  const hire = new Date(hireDate);
  const now = new Date();
  
  let years = now.getFullYear() - hire.getFullYear();
  let months = now.getMonth() - hire.getMonth();
  
  if (months < 0) {
    years--;
    months += 12;
  }
  
  const totalMonths = years * 12 + months;
  
  return { years, months, totalMonths };
}

export function formatServiceDuration(years: number, months: number): string {
  if (years === 0 && months === 0) {
    return "Less than 1 month";
  }
  
  const yearText = years === 1 ? "year" : "years";
  const monthText = months === 1 ? "month" : "months";
  
  if (years === 0) {
    return `${months} ${monthText}`;
  }
  
  if (months === 0) {
    return `${years} ${yearText}`;
  }
  
  return `${years} ${yearText}, ${months} ${monthText}`;
}

export function isProbationCompleted(hireDate: Date | string, probationEndDate?: Date | string | null): boolean {
  if (probationEndDate) {
    return new Date(probationEndDate) <= new Date();
  }
  
  // Default 6 months probation
  const hire = new Date(hireDate);
  const probationEnd = new Date(hire);
  probationEnd.setMonth(probationEnd.getMonth() + 6);
  
  return probationEnd <= new Date();
}
