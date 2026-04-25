import axios from "axios";

const storedBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api";

export const api = axios.create({
  baseURL: storedBaseUrl,
});

export function getStoredToken() {
  return sessionStorage.getItem("auth_token");
}

export function setStoredAuth(token: string, userType: string) {
  sessionStorage.setItem("auth_token", token);
  sessionStorage.setItem("user_type", userType);
}

export function clearStoredAuth() {
  sessionStorage.removeItem("auth_token");
  sessionStorage.removeItem("user_type");
}

export function getStoredUserType() {
  return sessionStorage.getItem("user_type");
}

api.interceptors.request.use((config) => {
  const token = getStoredToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

