import '@testing-library/jest-dom/vitest';

// jsdom has no ResizeObserver; Radix primitives and @tanstack/react-virtual need one.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;
