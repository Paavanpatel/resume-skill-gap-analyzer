import React from "react";
import { redirect } from "next/navigation";

jest.mock("next/navigation", () => ({
  redirect: jest.fn(),
  useRouter: jest.fn(),
  usePathname: jest.fn(),
}));

describe("RootPage", () => {
  it("redirects to /dashboard", () => {
    // Dynamic require so the module body executes after mock is set up
    const { default: RootPage } = require("@/app/page");

    try {
      RootPage();
    } catch {
      // redirect may throw in some setups
    }

    expect(redirect).toHaveBeenCalledWith("/dashboard");
  });
});
