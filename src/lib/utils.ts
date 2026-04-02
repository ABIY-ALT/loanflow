import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const LOCAL_ETHIOPIAN_PHONE_REGEX = /^(09|07)\d{8}$/

export function normalizeEthiopianPhone(value: string | null | undefined): string {
  if (!value) return ""

  const digitsOnly = value.replace(/\D/g, "")

  if (digitsOnly.startsWith("00251")) {
    return `0${digitsOnly.slice(5)}`
  }

  if (digitsOnly.startsWith("251")) {
    return `0${digitsOnly.slice(3)}`
  }

  if ((digitsOnly.startsWith("9") || digitsOnly.startsWith("7")) && digitsOnly.length === 9) {
    return `0${digitsOnly}`
  }

  return digitsOnly
}

export function isValidLocalEthiopianPhone(value: string | null | undefined): boolean {
  return LOCAL_ETHIOPIAN_PHONE_REGEX.test(normalizeEthiopianPhone(value))
}
