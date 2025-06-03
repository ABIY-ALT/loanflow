
// This function is NOT marked with 'use server' as it's a pure utility.
// It's intended to be imported by server-side code.
import { Timestamp } from 'firebase/firestore';
import { formatISO } from 'date-fns';

export function convertTimestampsToISO(data: any, depth = 0, maxDepth = 15, seenObjectsParam?: Set<any>): any {
  // 1. Base cases: null, non-object
  if (data === null || typeof data !== 'object') {
    return data;
  }

  // 2. Firestore SDK specific types or known convertible types that terminate recursion for this branch.
  if (data instanceof Timestamp) {
    return formatISO(data.toDate());
  }
  if (data instanceof Date) {
    return formatISO(data);
  }

  // 3. Heuristics for other Firestore SDK objects that shouldn't be deeply traversed.
  // These objects are returned as-is and also terminate recursion for this branch.
  if (typeof data.firestore === 'object' && data.firestore !== null) {
    return data; // e.g., Firestore instance, Query, CollectionReference
  }
  if (typeof data.path === 'string' && typeof data.id === 'string') {
    // This is likely a DocumentReference or similar.
    return data;
  }
  // Check for _delegate, common in some Firestore SDK internal objects
  if (typeof data._delegate === 'object' && data._delegate !== null) {
    return data;
  }


  // 4. Initialize 'seen' set for cycle detection for the current path of recursion if not already provided.
  const currentSeenSet = seenObjectsParam || new Set();

  // 5. Circular reference / max depth checks for general objects that are not handled above.
  if (currentSeenSet.has(data)) {
    return `[Circular Reference Detected]`;
  }
  if (depth > maxDepth) {
    return `[Max Depth Exceeded]`;
  }

  // 6. Add current object to 'seen' set before recursing into its properties/elements.
  currentSeenSet.add(data);

  let res: any;

  try {
    // 7. Recursive processing based on object type
    if (Array.isArray(data)) {
      res = data.map(item => convertTimestampsToISO(item, depth + 1, maxDepth, currentSeenSet));
    } else {
      // For objects (that are not Timestamps, Dates, or caught SDK objects at the top of this function call):
      // Convert direct Timestamp/Date properties.
      // Recurse on Array properties.
      // For all other properties (including nested non-array objects), assign as-is.
      res = {};
      for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
          const value = data[key];
          if (value instanceof Timestamp) {
            res[key] = formatISO(value.toDate());
          } else if (value instanceof Date) {
            res[key] = formatISO(value);
          } else if (Array.isArray(value)) {
            // If a property is an array, recurse on it
            res[key] = convertTimestampsToISO(value, depth + 1, maxDepth, currentSeenSet);
          }
          else {
            // For all other properties (including nested non-array objects), assign as-is.
            // This is the key change to stop deep recursion into objects.
            res[key] = value;
          }
        }
      }
    }
  } finally {
    // 8. Remove current object from 'seen' set after its processing is complete for this path.
    currentSeenSet.delete(data);
  }
  return res;
}
