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

        getLoadEditListsByName: builder.query({
            query: ({ field, name }) => ({
                url: `/rest/drinks/load_edit_lists/${field}?name=${name ?? ''}`,
                method: 'GET',
            }),
            providesTags: ['EditList'],
        }),

        updateLoadEditLists: builder.mutation({
            query: ({ field, newItem, altName, image }) => {

                const formData = new FormData();

                // Добавляем JSON-объект как Blob
                // Безопасная проверка: если newItem валиден — добавляем его
                if (newItem && typeof newItem === 'object') {
                    formData.append('item', new Blob([JSON.stringify(newItem)], { type: 'application/json' }));
                } else {
                    // Можно бросить исключение, вернуть ошибку или просто ничего не добавлять
                    console.warn('newItem is invalid:', newItem);
                    throw new Error('newItem must be a valid object');
                }

                if (image) {
                    formData.append(`image`, image); // Добавляем изображение
                }

                return {
                    url: `/rest/drinks/load_edit_lists/${field}?name=${altName ?? ''}`,
                    method: 'POST',
                    body: formData,
                };
            },
            invalidatesTags: ['Drinks','EditList'],
        }),

        deleteItemList: builder.mutation({
            query: ( {key, name} ) => ({
                url: `/rest/drinks/load_edit_lists/${key}?name=${name}`,
                method: 'DELETE',
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

    useGetPageVariantsDrinksQuery,
    useDeleteVariantDrinksMutation,

    useGetLoadEditListsQuery,
    useGetLoadEditListsByNameQuery,
    useUpdateLoadEditListsMutation,
    useDeleteItemListMutation,
} = drinksApi;

export default drinksApi;
