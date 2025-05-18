import { fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { API_URL, LOGIN, LOGOUT, REFRESH_JWT } from "../config";

let accessToken = undefined;
let refreshingPromise = null; // Защита от гонки

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

const baseQuery = fetchBaseQuery({
    baseUrl: API_URL,
    credentials: "include",
    prepareHeaders: (headers) => {
        if (accessToken) {
            headers.set("Authorization", `Bearer ${accessToken}`);
        }
        return headers;
    },
});

const refreshJwtToken = async (api, extraOptions) => {
    if (!refreshingPromise) {
        refreshingPromise = (async () => {
            const refreshResult = await baseQuery({
                url: REFRESH_JWT,
                method: "POST",
            }, api, extraOptions);

            if (refreshResult.data?.accessToken) {
                accessToken = refreshResult.data.accessToken;
                console.log("✅ Token refreshed");
                return { data: { userDetails: getPayloadToken(accessToken) } };
            } else {
                accessToken = null;
                console.warn("❌ Failed to refresh token:", refreshResult.error || refreshResult);
                return { error: refreshResult.error || "No accessToken in response" };
            }
        })();

        // Сбросим после завершения, независимо от результата
        refreshingPromise.finally(() => {
            refreshingPromise = null;
        });
    }

    return refreshingPromise;
};

export const baseQueryWithReauth = async (args, api, extraOptions) => {
    // Отдельно обрабатываем refresh-запрос (важно!)
    if (args.url === REFRESH_JWT) {
        return refreshJwtToken(api, extraOptions);
    }

    let result = await baseQuery(args, api, extraOptions);

    // Если accessToken просрочен (401), пробуем обновить токен
    if (result.error?.status === 401 && accessToken) {
        const resultRefresh = await refreshJwtToken(api, extraOptions);

        if (resultRefresh.error) {
            return {
                error: {
                    ...result.error,
                    data: [resultRefresh.error.data?.[0], ...(result.error.data || [])],
                    errorReAuth: true,
                },
            };
        }

        // Повторяем исходный запрос уже с новым токеном
        return await baseQuery(args, api, extraOptions);
    }

    // Обработка логина
    if (args.url === LOGIN && result.data?.accessToken) {
        accessToken = result.data.accessToken;
        result.data = {
            userDetails: getPayloadToken(accessToken),
            ...result.data,
        };
        return result;
    }

    // Обработка логаута
    if (args.url === LOGOUT) {
        accessToken = null;
        return { data: "Logout" };
    }

    return result;
};
