import { fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { Mutex } from "async-mutex";
import { API_URL, LOGIN, LOGOUT, REFRESH_JWT } from "../config";
import {clearJwtUserDetails, setJwtUserDetails} from "./Slice/jwtUserSlice";

let accessToken = undefined;
const mutex = new Mutex(); // глобальный мьютекс для защиты refresh

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
    return await mutex.runExclusive(async () => {
        const refreshResult = await baseQuery({
            url: REFRESH_JWT,
            method: "POST",
        }, api, extraOptions);

        if (refreshResult.data?.accessToken) {
            accessToken = refreshResult.data.accessToken;
            const userDetails = getPayloadToken(accessToken);

            // ✅ Сохраняем в Redux
            api.dispatch(setJwtUserDetails(userDetails));

            console.log("✅ Token refreshed");
            return { data: { userDetails } };
        } else {
            accessToken = null;

            // ❌ Сброс при ошибке
            api.dispatch(clearJwtUserDetails());

            console.warn("❌ Failed to refresh token:", refreshResult.error || refreshResult);
            return { error: refreshResult.error || "No accessToken in response" };
        }
    });
};

export const baseQueryWithReauth = async (args, api, extraOptions) => {

    // Если сейчас уже идёт обновление токена — ждём его окончания
    if (mutex.isLocked()) {
        await mutex.waitForUnlock();
    }

    // Прямой refresh-запрос (например, вызван при запуске страници)
    if (args.url === REFRESH_JWT) {
        return refreshJwtToken(api, extraOptions);
    }

    let result = await baseQuery(args, api, extraOptions);

    // Если токен просрочен — пробуем обновить и повторить запрос
    if (result.error?.status === 401 && accessToken) {
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

        // Повторяем исходный запрос после успешного обновления токена
        result = await baseQuery(args, api, extraOptions);
    }

    // Обработка логина — сохраняем токен
    if (args.url === LOGIN && result.data?.accessToken) {
        accessToken = result.data.accessToken;
        result.data = {
            userDetails: getPayloadToken(accessToken),
            ...result.data,
        };
    }

    // Обработка логаута — сбрасываем токен
    if (args.url === LOGOUT) {
        accessToken = null;
        return { data: "Logout" };
    }

    return result;
};
