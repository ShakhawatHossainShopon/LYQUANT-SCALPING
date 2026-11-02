const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:5001";

export const API = {
  header: `${API_BASE_URL}/api/header`,
  account: `${API_BASE_URL}/api/header`,
  sessions: `${API_BASE_URL}/api/sessions`,
  createSession: `${API_BASE_URL}/api/sessions/create`,
  deleteSession: `${API_BASE_URL}/api/sessions/delete`,
  activateSession: `${API_BASE_URL}/api/sessions/activate`,
  endSession: `${API_BASE_URL}/api/sessions/end`,
  tracker: `${API_BASE_URL}/api/tracker`,
  sessionHistory: `${API_BASE_URL}/api/sessions/history`,
};

export default API;
