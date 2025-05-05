import {fetchBaseQuery} from "@reduxjs/toolkit/query/react";
import {API_URL, LOGIN, LOGOUT, REFRESH_JWT} from "../config";

let accessToken = undefined;

const getPayloadToken = (token) => {
    try {
        if (token) {
            const tokenPayload = token.split('.')[1];
            const decodedTokenPayload = atob(tokenPayload);
            return JSON.parse(decodedTokenPayload);
        } else return null
    } catch (error) {
        console.error("Error decoding JWT token");
        return null;
    }
}

const baseQuery = fetchBaseQuery({
    baseUrl: API_URL,
    credentials: 'include', // Включить куки в запросы
    prepareHeaders: (headers) => {
        if (accessToken) {
            headers.set('Authorization', `Bearer ${accessToken}`);
        }
        return headers;
    },
})

const refreshJwtToken = async (api, extraOptions) => {
    const refreshResult = await baseQuery({
        url: REFRESH_JWT,
        method: 'POST',
    }, api, extraOptions)
    if (refreshResult.error) {
        return refreshResult
    } else {
        // store the new token
        if (refreshResult.data?.accessToken) {
            accessToken = refreshResult.data.accessToken;
            console.log("Refresh JWT OK!")

            return {data: {userDetails: getPayloadToken(refreshResult.data.accessToken)}}
        } else {
            accessToken = null;
            console.log("No accessToken in response " + JSON.stringify(refreshResult))
            return {error: "No accessToken in response"}
        }
    }
}

export const baseQueryWithReauth = async (args, api, extraOptions) => {

    // Обработка REFRESH_JWT отдельно
    if (args.url === REFRESH_JWT) {
        return refreshJwtToken(api, extraOptions);
    }

    let result = await baseQuery(args, api, extraOptions);

    // Обработка ошибки 401 при наличии токена (обновляем токен)
    if (result.error?.status === 401 && accessToken) {
        const resultRefresh = await refreshJwtToken(api, extraOptions);

        if (resultRefresh.error) {
            // Добавляем данные ошибки и флаг
            result.error = {
                ...result.error,
                data: [resultRefresh.error.data?.[0], ...(result.error.data || [])],
                errorReAuth: true,
            };
            return result;
        } else {
            // Повторяем запрос с новым токеном
            return baseQuery(args, api, extraOptions);
        }
    }

    // Дополнительная обработка для LOGIN
    if (args.url === LOGIN && result.data?.accessToken) {
        const { accessToken: newAccessToken, ...restData } = result.data;

        accessToken = newAccessToken;

        result.data = {
            userDetails: getPayloadToken(accessToken),
            ...restData,
        };

        return result;
    }

    // Обработка LOGOUT
    if (args.url === LOGOUT) {
        accessToken = null;
        return { data: "Logout" };
    }

    // Возвращаем результат по умолчанию
    return result;
};
