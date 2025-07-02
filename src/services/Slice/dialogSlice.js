import { createSlice } from "@reduxjs/toolkit";

// Начальное состояние: стек диалогов и информация о последнем закрытом
const initialState = {
    stack: [], // Здесь будут храниться все открытые диалоги в виде массива (стека)
    lastReturnedData: null, // Информация о последнем закрытом диалоге
};

const dialogSlice = createSlice({
    name: "dialog",
    initialState,
    reducers: {
        // Открыть диалог: добавляем новый диалог в верхушку стека
        openDialog: (state, action) => {
            state.stack.push(action.payload); // payload должен содержать { title, componentKey, props? }
        },

        // Закрыть диалог: удаляем верхний диалог из стека
        closeDialog: (state) => {
            if (state.stack.length > 0) {
                state.stack.pop();
            }
        },

        // Обновить props конкретного диалога по индексу
        updateDialogProps: (state, action) => {
            const { index, newProps } = action.payload;
            if (state.stack[index]) {
                state.stack[index].props = {
                    ...state.stack[index].props,
                    ...newProps,
                };
            }
        },

        // Очистить весь стек диалогов
        clearDialogStack: (state) => {
            state.stack = [];
        },

        // Сохранить информацию о закрытом диалоге
        dialogDataReturned: (state, action) => {
            // payload: { dialogType, data }
            state.lastReturnedData  = action.payload;
        },
        // Очистить lastClosedDialog (опционально)
        clearDialogDataReturned: (state) => {
            state.lastReturnedData  = null;
        },
    },
});

// Экспорт действий
export const {
    openDialog,
    closeDialog,
    clearDialogStack,
    updateDialogProps,
    dialogDataReturned,
    clearDialogDataReturned,
} = dialogSlice.actions;

// Селектор для получения текущего активного (последнего открытого) диалога
export const selectCurrentDialog = (state) =>
    state.dialog.stack[state.dialog.stack.length - 1] || null;

// Селектор для получения последнего закрытого диалога
export const selectLastClosedDialog = (state) =>
    state.dialog.lastClosedDialog;

// Экспорт редьюсера
export default dialogSlice.reducer;
