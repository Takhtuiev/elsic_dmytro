import { fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { Mutex } from "async-mutex";
import { API_URL, LOGIN, LOGOUT, REFRESH_JWT } from "../config";

let accessToken = undefined;
const mutex = new Mutex(); // глобальный мьютекс

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
};

export const baseQueryWithReauth = async (args, api, extraOptions) => {
    // не блокируем refresh-запросы
    if (args.url === REFRESH_JWT) {
        return refreshJwtToken(api, extraOptions);
    }

    await mutex.waitForUnlock(); // если идёт обновление — ждём

    let result = await baseQuery(args, api, extraOptions);

    if (result.error?.status === 401 && accessToken) {
        // если токен просрочен и никто не обновляет — обновляем сами
        if (!mutex.isLocked()) {
            const release = await mutex.acquire();
            try {
                const refreshResult = await refreshJwtToken(api, extraOptions);
                if (refreshResult.error) {
                    return {
                        error: {
                            ...result.error,
                            data: [refreshResult.error.data?.[0], ...(result.error.data || [])],
                            errorReAuth: true,
                        },
                    };
                }
            } finally {
                release(); // обязательно освободить
            }
        } else {
            await mutex.waitForUnlock(); // другой поток уже обновляет — просто ждём
        }

        // повторяем запрос с новым токеном
        result = await baseQuery(args, api, extraOptions);
    }

    // логин
    if (args.url === LOGIN && result.data?.accessToken) {
        accessToken = result.data.accessToken;
        result.data = {
            userDetails: getPayloadToken(accessToken),
            ...result.data,
        };
        return result;
    }

    // логаут
    if (args.url === LOGOUT) {
        accessToken = null;
        return { data: "Logout" };
    }

    return result;
};
