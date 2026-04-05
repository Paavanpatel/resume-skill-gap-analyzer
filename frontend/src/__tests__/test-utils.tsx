import React from "react";
import { render, RenderOptions } from "@testing-library/react";
import { ToastProvider } from "@/components/ui/Toast";

const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return <ToastProvider>{children}</ToastProvider>;
};

const customRender = (ui: React.ReactElement, options?: Omit<RenderOptions, "wrapper">) =>
  render(ui, { wrapper: AllTheProviders, ...options });

export * from "@testing-library/react";
export { customRender as render };
