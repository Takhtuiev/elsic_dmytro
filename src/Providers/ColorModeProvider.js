import React, { createContext, useState, useContext, useMemo } from 'react';
import {createTheme, CssBaseline, ThemeProvider} from "@mui/material";

// Создание контекста для цветовой темы
const ColorModeProvider = createContext();


// Кастомный хук для доступа к значению цветовой темы и функции обновления
export const useColorMode = () => {
    const context = useContext(ColorModeProvider);
    if (!context) {
        throw new Error('useColorMode must be used within a ColorModeProvider');
    }
    return context;
}

// Провайдер контекста цветовой темы
export const ColorModeContextProvider = ({ children }) => {

    const storedMode = localStorage.getItem('colorMode');
    const [mode, setMode] = useState(storedMode || 'light');

    // Функция для переключения режима и сохранения его в localStorage
    const toggleColorMode = () => {
        setMode(prevMode => {
            const newMode = prevMode === 'light' ? 'dark' : 'light';
            localStorage.setItem('colorMode', newMode);
            return newMode;
        });
    };

    // Создание объекта colorMode для предоставления в контекст
    const colorMode = useMemo(() => ({ toggleColorMode }), []);

    // Создание темы MUI с учетом текущего режима
    const theme = useMemo(
        () => createTheme({
            palette: { mode },
            components: {
                // Здесь можно добавлять глобальные стили для элементов
                MuiCssBaseline: {
                    styleOverrides: {
                        body: {
                            minHeight: '100vh',
                            backgroundColor: mode === 'light' ? '#FAFAF6' : '#121212',

                        //    backgroundColor: mode === 'light' ? '#f5f5f5' : '#121212', // фон для light/dark темы
                        //    backgroundImage: mode === 'dark'
                        //        ? `linear-gradient(rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.8)), url(${urlBackGroundImage})`
                        //        : `url(${urlBackGroundImage})`,
                        //    backgroundSize: 'cover', // Изображение будет покрывать весь экран
                        //    backgroundPosition: 'center center', // Центрирование изображения
                        //    backgroundAttachment: 'fixed', // Фон не будет двигаться при прокрутке
                        },
                    },
                },
            },
        }),
        [mode]
    );


    return (
        <ColorModeProvider.Provider value={colorMode}>
            <ThemeProvider theme={theme}>
                <CssBaseline />
                {children}
            </ThemeProvider>
        </ColorModeProvider.Provider>
    );
};
