import axios from "axios";
import { v4 as uuidv4 } from 'uuid';

const BASE_URL = ""; // Uses Vite proxy or relative path

// Initialize or get unique user ID
export const getUserId = () => {
    let userId = localStorage.getItem('askmydocs_user_id');
    if (!userId) {
        userId = uuidv4();
        localStorage.setItem('askmydocs_user_id', userId);
    }
    return userId;
};

// Auto-attach user ID to all requests
axios.interceptors.request.use((config) => {
    config.headers['X-User-Id'] = getUserId();
    return config;
});

export const uploadDocument = (formData) =>
  axios.post(`${BASE_URL}/api/documents`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

export const getFiles = () => axios.get(`${BASE_URL}/api/documents`);
export const getFile = (id) => axios.get(`${BASE_URL}/api/documents/${id}`);
export const deleteFile = (id) => axios.delete(`${BASE_URL}/api/documents/${id}`);
export const chatWithFile = (id, question) =>
  axios.post(`${BASE_URL}/api/chat`, { document_ids: [id], question });
