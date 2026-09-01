import React, {lazy, Suspense} from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";

// ✅ Подключение шрифтов Roboto для Material UI
import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';

// ✅ Провайдер темы
import { ColorModeContextProvider } from "./Providers/ColorModeProvider";

// ✅ Компоненты
import NavigationTabs from "./components/Navigation/NavigationTabs";
import Footer from "./containers/Footer/Footer";
import ScrollToTop from "./components/ScrollToTop";
import { Box } from "@mui/system";

import Biegeberechnung from "./containers/Elsic/Biegeberechnung";
import MyAccount from "./components/Navigation/MyAccount";
import ProtectedRoute from "./components/Auth/ProtectedRoute";

// 🔁 Лениво загружаемые страницы
const Home = lazy(() => import('./containers/Home'));
const Contacts = lazy(() => import('./containers/Contacts'));

const NotFound = lazy(() => import('./containers/NotFoundPage/NotFound'));

/**
 * Основное приложение без store обертки — используется внутри <Provider>
 */
function AppContent() {

    return (
        <ColorModeContextProvider>
            <BrowserRouter>
                <ScrollToTop />
                <Box display="flex" flexDirection="column" minHeight="100vh">
                    {/* Верхняя навигация */}
                    <Box width="100%">
                        <NavigationTabs />
                    </Box>

                    {/* Основной контент */}
                    <Box
                         sx={{
                             width: "100%",
                             minHeight: '100vh',
                             maxWidth: 'lg',
                             mx: 'auto',
                         }}
                    >
                            <Routes>
                                <Route path="/" element={<Home />} />
                                <Route path="/home" element={<Home />} />
                                <Route path="/contacts" element={<Contacts />} />

                                <Route path="/my_account/*" element={<MyAccount />}/>

                                <Route element={<ProtectedRoute permission="org:engineer:engineer" />}>
                                    <Route
                                        path="/biegeberechnung"
                                        element={<Biegeberechnung />}
                                    />
                                </Route>

                                <Route path="*" element={<NotFound message="URL не дійсний..." />} />
                            </Routes>
                    </Box>

                    {/* Футер прижат к низу */}
                    <Box width="100%" mt="auto">
                        <Footer />
                    </Box>

                </Box>
            </BrowserRouter>
        </ColorModeContextProvider>
    );
}

/**
 * Внешняя обертка с Redux-хранилищем
 */
export default function App() {
    return (
            <AppContent />
    );
}
