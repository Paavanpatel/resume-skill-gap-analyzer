import "@testing-library/jest-dom";

// Mock window.matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock global fetch to prevent network errors in tests
global.fetch = jest.fn(() => Promise.reject(new Error("Network request not mocked"))) as jest.Mock;

// Suppress console.error for network-related errors to reduce noise
const originalConsoleError = console.error;
console.error = (...args: any[]) => {
  // Filter out JSDOM XMLHttpRequest errors
  const errorStr = String(args[0]);
  if (errorStr.includes("AggregateError") || errorStr.includes("XMLHttpRequest")) {
    return;
  }
  originalConsoleError(...args);
};
