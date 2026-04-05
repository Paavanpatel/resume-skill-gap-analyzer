/** @type {import('jest').Config} */
module.exports = {
  displayName: "frontend",
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  // testPathPattern: "src/.*\\.(test|spec)\\.(ts|tsx)$",
  testMatch: ["**/src/**/*.(test|spec).(ts|tsx)"],
  transform: {
    "^.+\\.(ts|tsx)$": [
      "ts-jest",
      {
        tsconfig: {
          jsx: "react-jsx",
        },
      },
    ],
  },
  transformIgnorePatterns: ["/node_modules/(?!(lucide-react)/)"],
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.d.ts",
    "!src/**/layout.tsx",
    "!src/types/**",
  ],
};
