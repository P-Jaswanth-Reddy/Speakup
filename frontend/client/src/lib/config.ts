// Automatically use localhost when running locally, otherwise use Render production URL
export const API_BASE_URL = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" 
  ? "http://localhost:10000" 
  : "https://speakup-wipm.onrender.com";
