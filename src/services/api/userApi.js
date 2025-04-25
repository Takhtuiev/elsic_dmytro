import { createApi} from '@reduxjs/toolkit/query/react';
import {baseQueryWithReauth} from "../apiConfig.js";

const usersApi = createApi({
    reducerPath: 'usersApi',
    baseQuery: baseQueryWithReauth,
    endpoints: (builder) => ({
        getPageUserList: builder.query({
            query: ({page, sort, order}) => ({
                url: `/admin/users/page/${page ? page : 1}${sort ? `?sort=${sort}` : ''}${order ? `&order=${order}` : ''}`,
                method: 'GET',
            }),
            providesTags: ['PageUsers'],
        }),
        getUser: builder.query({
            query: ({userName}) => ({
                url: `/admin/users?name=${userName}`,
                method: 'GET',
            }),
        }),
        getMyAccount: builder.query({
            query: () => ({
                url: `/admin/users/my_account`,
                method: 'GET',
            }),
        }),
        updateMyAccount: builder.mutation({
            query: (newValue) => ({
                url: `/admin/users/my_account`,
                method: 'PUT',
                body: newValue,
            }),
        }),
        registerNewUser: builder.mutation({
            query: ( newUserValue ) => ({
                url: `/admin/users/`,
                method: 'POST',
                body: newUserValue,
            }),
            invalidatesTags: ['PageUsers'],
        }),
        updateUserProperty: builder.mutation({
            query: ( newUserValue ) => ({
                url: `/admin/users/` + newUserValue.id,
                method: 'PUT',
                body: newUserValue,
            }),
            invalidatesTags: ['PageUsers'],
        }),
        deleteUser: builder.mutation({
            query: ( id ) => ({
                url: `/admin/users/` + id,
                method: 'DELETE',
            }),
            invalidatesTags: ['PageUsers'],
        }),
        getLoadRoleList: builder.query({
            query: () => ({
                url: `/admin/users/load_role_lists`,
                method: 'GET',
            }),
        }),
    }),
});


export const {
    useGetPageUserListQuery,
    useGetLoadRoleListQuery,
    useGetUserQuery,
    useGetMyAccountQuery,
    useUpdateMyAccountMutation,
    useRegisterNewUserMutation,
    useUpdateUserPropertyMutation,
    useDeleteUserMutation,
} = usersApi;
export default usersApi ;
