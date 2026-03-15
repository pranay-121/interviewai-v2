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

// Auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const stored = localStorage.getItem("interviewai-auth");
        if (stored) {
          const { state } = JSON.parse(stored);
          if (state?.refreshToken && state?.user?.id) {
            const { data } = await axios.post(
              `${api.defaults.baseURL}/auth/refresh`,
              { user_id: state.user.id, refresh_token: state.refreshToken }
            );
            api.defaults.headers.common["Authorization"] = `Bearer ${data.access_token}`;
            original.headers["Authorization"] = `Bearer ${data.access_token}`;
            return api(original);
          }
        }
      } catch {}
      if (typeof window !== "undefined") window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;
