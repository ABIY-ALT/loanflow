
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
    return `[Circular Reference: ${data.constructor?.name || 'UnknownType'}]`;
  }
  if (depth > maxDepth) {
    return `[Max Depth Exceeded: ${data.constructor?.name || 'UnknownType'}]`;
  }

  // 6. Add current object to 'seen' set before recursing into its properties/elements.
  // This is crucial for objects we are about to iterate/recurse into.
  currentSeenSet.add(data);

  let res: any;

  try {
    // 7. Recursive processing based on object type for objects that made it past earlier checks.
    if (Array.isArray(data)) {
      res = data.map(item => {
        // Re-apply checks to array items before recursive call
        if (item === null || typeof item !== 'object') return item;
        if (item instanceof Timestamp) return formatISO(item.toDate());
        if (item instanceof Date) return formatISO(item);
        if (typeof item.firestore === 'object' && item.firestore !== null) return item;
        if (typeof item.path === 'string' && typeof item.id === 'string') return item;
        if (typeof item._delegate === 'object' && item._delegate !== null) return item;
        return convertTimestampsToISO(item, depth + 1, maxDepth, currentSeenSet);
      });
    } else {
      const proto = Object.getPrototypeOf(data);
      if (proto === Object.prototype || proto === null) {
        // Plain JavaScript object (direct prototype is Object.prototype or null)
        res = {};
        for (const key in data) {
          if (Object.prototype.hasOwnProperty.call(data, key)) {
            // Explicitly skip DocumentReference fields which should not be deeply converted
            if (key === 'workflowVersionRef' || key === 'currentStageRef') {
              res[key] = data[key]; // Assign as-is
            } else {
              const value = data[key];
              // Re-apply checks to property values before recursive call
              if (value === null || typeof value !== 'object') {
                res[key] = value;
              } else if (value instanceof Timestamp) {
                res[key] = formatISO(value.toDate());
              } else if (value instanceof Date) {
                res[key] = formatISO(value);
              } else if (typeof value.firestore === 'object' && value.firestore !== null) {
                res[key] = value;
              } else if (typeof value.path === 'string' && typeof value.id === 'string') {
                res[key] = value;
              } else if (typeof value._delegate === 'object' && value._delegate !== null) {
                res[key] = value;
              } else {
                res[key] = convertTimestampsToISO(value, depth + 1, maxDepth, currentSeenSet);
              }
            }
          }
        }
      } else {
        // Unhandled complex object type. Return a placeholder string to stop recursion.
        // console.warn(`[convertTimestampsToISO] Unhandled complex object type at depth ${depth}:`, data?.constructor?.name, data);
        res = `[Unhandled Complex Object: ${data?.constructor?.name || 'UnknownType'}]`;
      }
    }
  } finally {
    // 8. Remove current object from 'seen' set after its processing is complete for this path.
    currentSeenSet.delete(data);
  }
  return res;
}
