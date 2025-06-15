import { configureStore } from "@reduxjs/toolkit";
import { setupListeners } from "@reduxjs/toolkit/query";

import authApi from "../services/Slice/authApi";
import usersApi from "../services/Slice/userApi";
import drinksApi from "../services/Slice/drinksApi";
import dialogSlice from "../services/Slice/dialogSlice";

export const store = configureStore({
    reducer: {
        [authApi.reducerPath]: authApi.reducer,
        [usersApi.reducerPath]: usersApi.reducer,
        [drinksApi.reducerPath]: drinksApi.reducer,
        dialog: dialogSlice, // наш slice для модального окна
    },
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(
            authApi.middleware,
            usersApi.middleware,
            drinksApi.middleware,
        ),
});

setupListeners(store.dispatch);
