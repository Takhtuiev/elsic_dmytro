import { fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { Mutex } from "async-mutex";
import { API_URL, LOGIN, LOGOUT, REFRESH_JWT } from "../config";

// Переменная для хранения актуального accessToken
let accessToken = undefined;

// Глобальный mutex для предотвращения одновременного обновления токена
const mutex = new Mutex();

// Функция декодирования JWT токена для получения данных пользователя
const getPayloadToken = (token) => {
    try {
        if (token) {
            const tokenPayload = token.split('.')[1];
            const decodedTokenPayload = atob(tokenPayload);
            return JSON.parse(decodedTokenPayload);
        }
    } catch (error) {
        console.error("Error decoding JWT token:", error);
    }
    return null;
};

// Базовый fetch-запрос с токеном и включёнными куками
const baseQuery = fetchBaseQuery({
    baseUrl: API_URL,
    credentials: "include", // Добавляем куки (включая refreshToken)
    prepareHeaders: (headers) => {
        if (accessToken) {
            headers.set("Authorization", `Bearer ${accessToken}`);
        }
        return headers;
    },
});

// Функция обновления токена (refreshToken → новый accessToken)
const refreshJwtToken = async (api, extraOptions) => {
    return await mutex.runExclusive(async () => {
        const refreshResult = await baseQuery({
            url: REFRESH_JWT,
            method: "POST",
        }, api, extraOptions);

        if (refreshResult.data?.accessToken) {
            accessToken = refreshResult.data.accessToken;
            console.log("✅ Token refreshed");

            return {
                data: {
                    userDetails: getPayloadToken(accessToken),
                },
            };
        } else {
            accessToken = null;
            console.warn("❌ Failed to refresh token:", refreshResult.error || refreshResult);
            return {
                error: refreshResult.error || { message: "No accessToken in response" },
            };
        }
    });
};

// Обёртка вокруг baseQuery с логикой авторизации, обновления и повторных запросов
export const baseQueryWithReauth = async (args, api, extraOptions) => {
    // Если сейчас уже идёт обновление токена — ждём его окончания
    if (mutex.isLocked()) {
        await mutex.waitForUnlock();
    }

    // Выполняем обычный запрос
    let result = await baseQuery(args, api, extraOptions);

    // Обработка логина — сохраняем новый accessToken
    if (args.url === LOGIN && result.data?.accessToken) {
        accessToken = result.data.accessToken;
        result.data = {
            ...result.data,
            userDetails: getPayloadToken(accessToken),
        };
        return result;
    }

    // Обработка логаута — очищаем токен
    if (args.url === LOGOUT) {
        accessToken = null;
        return { data: "Logout" };
    }

    // Если accessToken истёк — пробуем обновить и повторить запрос
    if (result.error?.status === 401 && accessToken) {
        const refreshResult = await refreshJwtToken(api, extraOptions);

        if (refreshResult.error) {
            return {
                error: {
                    ...result.error,
                    data: [
                        refreshResult.error.data?.[0],
                        ...(result.error.data || []),
                    ],
                    errorReAuth: true,
                },
            };
        }

        // Повторяем исходный запрос после успешного обновления токена
        result = await baseQuery(args, api, extraOptions);
    }

    return result;
};
