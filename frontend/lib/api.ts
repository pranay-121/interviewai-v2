import axios from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
  timeout: 120000,
  headers: { "Content-Type": "application/json" },
});

// Attach stored token on startup
if (typeof window !== "undefined") {
  try {
    const stored = localStorage.getItem("interviewai-auth");
    if (stored) {
      const { state } = JSON.parse(stored);
      if (state?.accessToken) {
        api.defaults.headers.common["Authorization"] = `Bearer ${state.accessToken}`;
      }
    }
  } catch {}
}

// Response interceptor - NO auto redirect
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    // Just reject — do NOT redirect automatically
    // Let each page handle 401 errors individually
    return Promise.reject(error);
  }
);

export default api;
