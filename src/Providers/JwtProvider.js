import React, {createContext, useContext, useEffect, useState} from 'react';
import {useRefreshAccessTokenQuery} from "../services/api/authApi";

// Создаем контекст
const TokenContext = createContext();

// Провайдер для управления TokenContext
export function JwtProvider({ children }) {
    const [jwtUserDetails, setJwtUserDetails] = useState();

    const { data: loadUserDetails, error: errorUserDetails } = useRefreshAccessTokenQuery();

    useEffect(() => {
        if (loadUserDetails) {
            // Если данные успешно получены с сервера, обновляем данные
            setJwtUserDetails(loadUserDetails.userDetails);
        }

        if (errorUserDetails) {
            setJwtUserDetails(null); // Сбрасываем состояние, если произошла ошибка
        }
    }, [loadUserDetails, errorUserDetails]); // Эффект будет зависеть от изменения данных и ошибок


    return (
        <TokenContext.Provider value={{ jwtUserDetails, setJwtUserDetails }}>
            {children}
        </TokenContext.Provider>
    );
}

// Кастомный хук для доступа к данным контекста
export function useJwtUserDetails() {
    const context = useContext(TokenContext);
    if (!context) {
        throw new Error('useJwtUserDetails must be used within a JwtProvider');
    }
    return context;
}
