// src/config.js

// Определяем API_URL в зависимости от окружения
export const API_URL = process.env.REACT_APP_API_URL; // Значение по умолчанию для локального запуска

export const REFRESH_JWT = '/auth/refresh';
export const LOGIN = '/auth/login';
export const LOGOUT = '/auth/logout';
