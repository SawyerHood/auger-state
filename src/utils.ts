export function visitPromises(
  value: any,
  onPromise: (p: Promise<any>) => void,
): void {
  if (value == null) {
    return;
  }
  if (value instanceof Promise) {
    onPromise(value);
  } else if (Array.isArray(value) || value instanceof Set) {
    for (const item of value) {
      visitPromises(item, onPromise);
    }
  } else if (value instanceof Map) {
    for (const item of value.values()) {
      visitPromises(item, onPromise);
    }
  } else if (typeof value == 'object') {
    for (const item of Object.values(value)) {
      visitPromises(item, onPromise);
    }
  }
}
