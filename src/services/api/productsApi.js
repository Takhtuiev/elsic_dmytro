import { createApi} from '@reduxjs/toolkit/query/react';
import {baseQueryWithReauth} from "../apiConfig.js";

const productsApi = createApi({
    reducerPath: 'productsApi',
    baseQuery: baseQueryWithReauth,
    endpoints: (builder) => ({
        getPageProducts: builder.query({
            query: ( {page, sort, order} ) => ({
                url: `/rest/product/page/${page ? page : 1}${sort ? `?sort=${sort}` : ''}${order ? `&order=${order}` : ''}`,
                method: 'POST',
            }),
            providesTags: ['PageProducts'],
        }),
        getProduct: builder.query({
            query: ({ id }) => ({
                url: `/rest/product/` + id,
                method: 'POST',
            }),
        }),
        updateProduct: builder.mutation({
            query: ({ newProductValue }) => ({
                url: `/rest/product/save`,
                method: 'POST',
                body: newProductValue,
            }),
            invalidatesTags: ['PageProducts'],
        }),
        deleteProduct: builder.mutation({
            query: ( id ) => ({
                url: `/rest/product/delete`,
                method: 'POST',
                body: id,
            }),
            invalidatesTags: ['PageProducts'],
        }),
    }),
});

export const {
    useGetPageProductsQuery,
    useGetProductQuery,
    useUpdateProductMutation,
    useDeleteProductMutation
} = productsApi;
export default productsApi;
