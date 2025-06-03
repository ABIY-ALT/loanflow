
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
  // These are checked BEFORE cycle detection and depth checks for THIS object.
  // DocumentReference and CollectionReference check:
  if (typeof data.firestore === 'object' && data.firestore !== null && typeof data.path === 'string' && typeof data.id === 'string') {
    return data; // It's a DocumentReference or CollectionReference, return as-is.
  }
  // Broader check for other SDK internal objects if the above is not specific enough
  // This might catch Firestore instance itself or Query objects.
  if (typeof data.firestore === 'object' && data.firestore !== null) {
    return data;
  }
  // Check for _delegate, common in some Firestore SDK internal objects
  if (typeof data._delegate === 'object' && data._delegate !== null) {
    return data;
  }

  // 4. Max depth check
  if (depth > maxDepth) {
    // console.warn(`[convertTimestampsToISO] Max depth (${maxDepth}) exceeded for object:`, data);
    return `[Max Depth Exceeded (${depth})]`;
  }

  // 5. Initialize 'seen' set for cycle detection.
  // A new Set is created for each top-level call by the service layer.
  // This set is passed down through recursive calls.
  const currentSeenSet = seenObjectsParam || new Set<any>();

  // 6. Circular reference check for THIS object before adding it to the set.
  if (currentSeenSet.has(data)) {
    // console.warn('[convertTimestampsToISO] Circular reference detected for object:', data);
    return `[Circular Reference Detected]`;
  }

  // 7. Add current object to 'seen' set before recursing into its properties/elements.
  currentSeenSet.add(data);

  let res: any;
  try {
    // 8. Recursive processing based on object type
    if (Array.isArray(data)) {
      res = data.map(item => convertTimestampsToISO(item, depth + 1, maxDepth, currentSeenSet));
    } else if (Object.prototype.toString.call(data) === '[object Object]') { // Robust plain object check
      res = {};
      for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
          // For plain objects, recurse on their properties.
          // The recursive call to convertTimestampsToISO for data[key]
          // will be caught by the SDK/Timestamp/Date/etc. checks at the top
          // of that new call if data[key] is one of those types.
          res[key] = convertTimestampsToISO(data[key], depth + 1, maxDepth, currentSeenSet);
        }
      }
    } else {
      // If it's an object but not a Timestamp, Date, Array, known SDK object, or plain JS object,
      // it's likely a custom class instance or some other complex type not meant for deep iteration here.
      // console.warn('[convertTimestampsToISO] Returning non-plain object as-is:', data?.constructor?.name, data);
      res = data; // Return as-is.
    }
  } finally {
    // 9. Remove current object from 'seen' set after its processing (or attempted processing) is complete.
    // This is crucial for the cycle detection to work correctly across different branches of the data structure.
    currentSeenSet.delete(data);
  }
  return res;
}
