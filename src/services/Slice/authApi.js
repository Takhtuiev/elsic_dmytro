import { createApi} from '@reduxjs/toolkit/query/react';
import {LOGIN, LOGOUT, REFRESH_JWT} from "../../config";
import {baseQueryWithReauth} from "../apiConfig.js";

const authApi = createApi({
    reducerPath: 'authApi',
    baseQuery: baseQueryWithReauth,
    endpoints: (builder) => ({
        // Endpoint для входа пользователя
        userLogin: builder.mutation({
            query: ( credentials ) => ({
                url: LOGIN,
                method: 'POST',
                body: credentials,
            }),
        }),

        // Endpoint для выхода пользователя
        userLogout: builder.mutation({
            query: () => ({
                url: LOGOUT,
                method: 'POST',
            }),
        }),

        // Endpoint для обновления accessToken по refreshAccessToken
        refreshAccessToken: builder.query({
            query: () => ({
                url: REFRESH_JWT,
                method: 'POST',
            }),
        }),
    }),
});


export const {
    useUserLoginMutation,
    useUserLogoutMutation,
    useRefreshAccessTokenQuery
} = authApi;
export default authApi;

