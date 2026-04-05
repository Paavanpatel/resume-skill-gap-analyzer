/**
 * Comprehensive tests for the API client and token helpers.
 */
import axios from "axios";
import {
  getStoredTokens,
  storeTokens,
  clearTokens,
  getErrorMessage,
  apiClient,
  login,
  register,
  logout,
  getMe,
  uploadResume,
  listResumes,
  submitAnalysis,
  getAnalysisStatus,
  getAnalysisResult,
  getAnalysisHistory,
  generateRoadmap,
  getRoadmap,
  generateAdvisorRewrites,
} from "@/lib/api";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] ?? null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, "localStorage", { value: localStorageMock });

// Mock apiClient methods for API function tests
jest.spyOn(apiClient, "get").mockResolvedValue({ data: {} });
jest.spyOn(apiClient, "post").mockResolvedValue({ data: {} });

describe("Token helpers", () => {
  beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllMocks();
  });

  describe("storeTokens", () => {
    it("stores access token in localStorage", () => {
      storeTokens("my-access-token");
      expect(localStorageMock.setItem).toHaveBeenCalledWith("access_token", "my-access-token");
    });
  });

  describe("getStoredTokens", () => {
    it("returns null when no token stored", () => {
      expect(getStoredTokens()).toBeNull();
    });

    it("returns access token when stored", () => {
      localStorageMock.getItem.mockReturnValueOnce("test-token");
      const tokens = getStoredTokens();
      expect(tokens).toEqual({ access: "test-token" });
    });
  });

  describe("clearTokens", () => {
    it("removes access_token and user from localStorage", () => {
      clearTokens();
      expect(localStorageMock.removeItem).toHaveBeenCalledWith("access_token");
      expect(localStorageMock.removeItem).toHaveBeenCalledWith("user");
    });
  });
});

describe("getErrorMessage", () => {
  it("returns generic message for unknown errors", () => {
    expect(getErrorMessage(new Error("test"))).toBe("Something went wrong. Please try again.");
  });

  it("returns generic message for null", () => {
    expect(getErrorMessage(null)).toBe("Something went wrong. Please try again.");
  });

  it("returns server error message from API response", () => {
    const error = new axios.AxiosError("Request failed");
    (error as any).response = {
      status: 400,
      data: { error: { message: "Email already exists" } },
    };
    // Make it pass isAxiosError check
    (error as any).isAxiosError = true;
    Object.defineProperty(error, "isAxiosError", { value: true });
    expect(getErrorMessage(error)).toBe("Email already exists");
  });

  it("returns rate limit message for 429", () => {
    const error = new axios.AxiosError("Request failed");
    (error as any).response = { status: 429, data: {} };
    Object.defineProperty(error, "isAxiosError", { value: true });
    expect(getErrorMessage(error)).toBe("Too many requests. Please wait a moment.");
  });

  it("returns file too large message for 413", () => {
    const error = new axios.AxiosError("Request failed");
    (error as any).response = { status: 413, data: {} };
    Object.defineProperty(error, "isAxiosError", { value: true });
    expect(getErrorMessage(error)).toBe("File is too large.");
  });
});

describe("Auth API functions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (apiClient.post as jest.Mock).mockResolvedValue({ data: {} });
    (apiClient.get as jest.Mock).mockResolvedValue({ data: {} });
  });

  it("login calls POST /auth/login", async () => {
    const mockData = { access_token: "token", token_type: "bearer", expires_in: 900 };
    (apiClient.post as jest.Mock).mockResolvedValue({ data: mockData });

    const result = await login({ email: "test@example.com", password: "pass123" });
    expect(apiClient.post).toHaveBeenCalledWith("/auth/login", {
      email: "test@example.com",
      password: "pass123",
    });
    expect(result).toEqual(mockData);
  });

  it("register calls POST /auth/register", async () => {
    const mockUser = { id: "1", email: "test@example.com" };
    (apiClient.post as jest.Mock).mockResolvedValue({ data: mockUser });

    const result = await register({
      email: "test@example.com",
      password: "password123",
      full_name: "Test",
    });
    expect(apiClient.post).toHaveBeenCalledWith("/auth/register", {
      email: "test@example.com",
      password: "password123",
      full_name: "Test",
    });
    expect(result).toEqual(mockUser);
  });

  it("logout calls POST /auth/logout and clears tokens", async () => {
    (apiClient.post as jest.Mock).mockResolvedValue({ data: {} });
    await logout();
    expect(apiClient.post).toHaveBeenCalledWith("/auth/logout");
  });

  it("logout clears tokens even on error", async () => {
    (apiClient.post as jest.Mock).mockRejectedValue(new Error("Network error"));
    await logout();
    expect(localStorageMock.removeItem).toHaveBeenCalledWith("access_token");
  });

  it("getMe calls GET /auth/me", async () => {
    const mockUser = { id: "1", email: "test@example.com" };
    (apiClient.get as jest.Mock).mockResolvedValue({ data: mockUser });

    const result = await getMe();
    expect(apiClient.get).toHaveBeenCalledWith("/auth/me");
    expect(result).toEqual(mockUser);
  });
});

describe("Resume API functions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (apiClient.post as jest.Mock).mockResolvedValue({ data: {} });
    (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });
  });

  it("uploadResume sends file as FormData", async () => {
    const file = new File(["content"], "resume.pdf", { type: "application/pdf" });
    const mockResp = { id: "r-1", original_filename: "resume.pdf" };
    (apiClient.post as jest.Mock).mockResolvedValue({ data: mockResp });

    const result = await uploadResume(file);
    expect(apiClient.post).toHaveBeenCalledWith("/resume/upload", expect.any(FormData), {
      headers: { "Content-Type": "multipart/form-data" },
    });
    expect(result).toEqual(mockResp);
  });

  it("listResumes calls GET /resume/ with pagination params", async () => {
    await listResumes();
    expect(apiClient.get).toHaveBeenCalledWith("/resume/", {
      params: { skip: 0, limit: 20 },
    });
  });
});

describe("Analysis API functions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (apiClient.post as jest.Mock).mockResolvedValue({ data: {} });
    (apiClient.get as jest.Mock).mockResolvedValue({ data: {} });
  });

  it("submitAnalysis sends resume ID and job details", async () => {
    await submitAnalysis("r-1", "A long job description for testing purposes", "Engineer", "Acme");
    expect(apiClient.post).toHaveBeenCalledWith("/analysis/r-1", {
      job_description: "A long job description for testing purposes",
      job_title: "Engineer",
      job_company: "Acme",
    });
  });

  it("submitAnalysis sends null for missing optional fields", async () => {
    await submitAnalysis("r-1", "Job description");
    expect(apiClient.post).toHaveBeenCalledWith("/analysis/r-1", {
      job_description: "Job description",
      job_title: null,
      job_company: null,
    });
  });

  it("getAnalysisStatus calls correct URL", async () => {
    await getAnalysisStatus("a-1");
    expect(apiClient.get).toHaveBeenCalledWith("/analysis/a-1/status");
  });

  it("getAnalysisResult calls correct URL", async () => {
    await getAnalysisResult("a-1");
    expect(apiClient.get).toHaveBeenCalledWith("/analysis/a-1");
  });

  it("getAnalysisHistory calls GET /analysis/history", async () => {
    await getAnalysisHistory();
    expect(apiClient.get).toHaveBeenCalledWith("/analysis/history");
  });
});

describe("Insights API functions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (apiClient.post as jest.Mock).mockResolvedValue({ data: {} });
    (apiClient.get as jest.Mock).mockResolvedValue({ data: {} });
  });

  it("generateRoadmap calls POST", async () => {
    await generateRoadmap("a-1");
    expect(apiClient.post).toHaveBeenCalledWith("/insights/a-1/roadmap");
  });

  it("getRoadmap calls GET", async () => {
    await getRoadmap("a-1");
    expect(apiClient.get).toHaveBeenCalledWith("/insights/a-1/roadmap");
  });

  it("generateAdvisorRewrites calls POST", async () => {
    await generateAdvisorRewrites("a-1");
    expect(apiClient.post).toHaveBeenCalledWith("/insights/a-1/advisor");
  });
});
