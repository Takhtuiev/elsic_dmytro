import {createApi} from '@reduxjs/toolkit/query/react';
import {baseQueryWithReauth} from "../apiConfig.js";


const drinksApi = createApi({
    reducerPath: 'drinksApi',
    baseQuery: baseQueryWithReauth,
    endpoints: (builder) => ({
        getPageDrinks: builder.query({
            query: ({ params }) => {
                const queryString = new URLSearchParams(params).toString();
                const baseUrl = `/rest/drinks/page`;
                const url = queryString ? `${baseUrl}?${queryString}` : baseUrl;

                return {
                    url,
                    method: 'GET',
                };
            },
            providesTags: ['Drinks'],
        }),
        getDrinks: builder.query({
            query: ({ id }) => ({
                url: `/rest/drinks?id=${id}`,
                method: 'GET',
            }),
            providesTags: ['Drinks'],
        }),

        updateDrinks: builder.mutation({
            query: ({ newDrinkItem, images }) => {
                const formData = new FormData();

                // Добавляем JSON-объект как Blob
                formData.append('item', new Blob([JSON.stringify(newDrinkItem)], { type: 'application/json' }));

                if (images && Object.keys(images).length > 0) {
                    // Добавляем изображения с ключами-идентификаторами
                    Object.entries(images).forEach(([index, file]) => {
                        formData.append(`images[]`, file); // Передаем
                    });
                }

                return {
                    url: `/rest/drinks/` + (newDrinkItem.id || '0'),
                    method: 'POST',
                    body: formData,
                };
            },
            invalidatesTags: ['Drinks'],
        }),
        deleteDrinks: builder.mutation({
            query: ( id ) => ({
                url: `/rest/drinks/` + id,
                method: 'DELETE',
            }),
            invalidatesTags: ['Drinks'],
        }),

        getBrand: builder.query({
            query: ({ name }) => ({
                url: `/rest/brand/${name}`,
                method: 'GET',
            }),
            providesTags: ['Brand'],
        }),
        updateBrand: builder.mutation({
            query: ({ newBrand, altName, image }) => {

                const formData = new FormData();

                // Добавляем JSON-объект как Blob
                formData.append('item', new Blob([JSON.stringify(newBrand)], { type: 'application/json' }));

                if (image) {
                    formData.append(`image`, image); // Добавляем изображение
                }

                return {
                    url: `/rest/brand/` + (altName || ''),
                    method: 'PUT',
                    body: formData,
                };
            },
            invalidatesTags: ['Drinks','Brand','EditList'],
        }),
        deleteBrand: builder.mutation({
            query: ( name ) => ({
                url: `/rest/brand/${name}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['Brand','EditList'],
        }),

        getPageVariantsDrinks: builder.query({
            query: ({ params }) => {
                const queryString = new URLSearchParams(params).toString();
                const baseUrl = `/rest/variants_drink/page`;
                const url = queryString ? `${baseUrl}?${queryString}` : baseUrl;

                return {
                    url,
                    method: 'GET',
                };
            },
            providesTags: ['Drinks'],
        }),

        deleteVariantDrinks: builder.mutation({
            query: ( id ) => ({
                url: `/rest/variants_drink/` + id,
                method: 'DELETE',
            }),
            invalidatesTags: ['Drinks'],
        }),


        getLoadEditLists: builder.query({
            query: ({ params }) => {
                const queryString = new URLSearchParams(params).toString();
                const baseUrl = `/rest/drinks/load_edit_lists`;
                const url = queryString ? `${baseUrl}?${queryString}` : baseUrl;

                return {
                    url,
                    method: 'GET',
                };
            },
            providesTags: ['EditList'],
        }),
        updateLoadEditLists: builder.mutation({
            query: ({key, newItem, altItem}) => ({
                url: `/rest/drinks/load_edit_lists/${key}`,
                method: 'POST',
                body: {newName: newItem, altName: altItem},
            }),
            invalidatesTags: ['Drinks','EditList'],
        }),
        deleteItemList: builder.mutation({
            query: ( {key, name} ) => ({
                url: `/rest/drinks/load_edit_lists/${key}`,
                method: 'DELETE',
                body: name,
            }),
            invalidatesTags: ['EditList'],
        }),

    }),
});

export const {
    useGetPageDrinksQuery,
    useGetDrinksQuery,
    useUpdateDrinksMutation,
    useDeleteDrinksMutation,

    useGetBrandQuery,
    useUpdateBrandMutation,
    useDeleteBrandMutation,

    useGetPageVariantsDrinksQuery,
    useDeleteVariantDrinksMutation,

    useGetLoadEditListsQuery,
    useUpdateLoadEditListsMutation,
    useDeleteItemListMutation,
} = drinksApi;

export default drinksApi;
