
// Определяем API_URL в зависимости от окружения
export const API_URL = process.env.REACT_APP_API_URL; // Значение по умолчанию для локального запуска

export const CLOUD_NAME = "dsprli69j"; // name Cloudinary


export const ID_EL_START = 'my-element-'

export const UPLOAD_IMAGE = {maxWidth: 1920, maxHeight: 1080}
export const WATERMARK = null;
export const FONT_WATERMARK = 'Roboto';


// Endpoints
export const REFRESH_JWT = '/auth/refresh';
export const LOGIN = '/auth/login';
export const LOGOUT = '/auth/logout';
