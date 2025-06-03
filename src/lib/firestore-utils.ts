
'use client'; // Or remove if no client-side usage, though formatISO/Timestamp are often general.

import { Timestamp } from 'firebase/firestore';
import { formatISO } from 'date-fns';

export function convertTimestampsToISO(data: any, depth = 0, maxDepth = 15, seen?: Set<any>): any {
  // 1. Base cases: null, non-object
  if (data === null || typeof data !== 'object') {
    return data;
  }

  // 2. Firestore SDK specific types or known convertible types
  // These should be checked before the 'seen' set or depth limit for these specific types.
  if (data instanceof Timestamp) {
    return formatISO(data.toDate());
  }
  if (data instanceof Date) {
    return formatISO(data);
  }
  // Heuristic for other Firestore SDK objects that shouldn't be deeply traversed
  // Check for a 'firestore' property which is common in many v8/v9 SDK objects
  if (typeof data.firestore === 'object' && data.firestore !== null) {
    return data; // Return SDK object as-is
  }
  // Heuristic for DocumentReference-like objects (path and id are good indicators)
  if (typeof data.path === 'string' && typeof data.id === 'string') {
      return data; // Return SDK object as-is (likely a DocumentReference)
  }

  // 3. Circular reference / max depth checks for general objects
  seen = seen || new Set();
  if (seen.has(data)) {
    return `[Circular Reference: ${data.constructor?.name || 'UnknownType'}]`;
  }
  if (depth > maxDepth) {
    return `[Max Depth Exceeded: ${data.constructor?.name || 'UnknownType'}]`;
  }

  // 4. Add to seen set *after* SDK object checks but *before* recursing into its properties
  seen.add(data);

  let res: any;
  // 5. Recursive processing
  if (Array.isArray(data)) {
    res = data.map(item => convertTimestampsToISO(item, depth + 1, maxDepth, seen));
  } else if (typeof data.toDate === 'function') { 
    // This handles objects that have a toDate method but are not Timestamp or Date instances (e.g., from older SDK versions or mocks)
    // This check is after `instanceof Timestamp` and `instanceof Date` to prioritize direct type checks.
    try {
      res = formatISO(data.toDate());
    } catch (e) {
      res = "[Invalid Timestamp-like Object]";
    }
  } else if (data.constructor === Object || Object.getPrototypeOf(data) === null || (typeof Object.getPrototypeOf(data) === 'object' && Object.getPrototypeOf(Object.getPrototypeOf(data)) === null) ) {
    // Plain JavaScript object
    res = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        res[key] = convertTimestampsToISO(data[key], depth + 1, maxDepth, seen);
      }
    }
  } else {
    // Unhandled complex object type. It's not a primitive, not a known Date/Timestamp,
    // not an Array, not caught as a common SDK object, and not a plain JS object.
    // We return it as-is and rely on the `seen` set or `maxDepth` to prevent infinite loops
    // if this object itself contains further complex structures or cycles.
    res = data;
  }

  seen.delete(data);
  return res;
}
