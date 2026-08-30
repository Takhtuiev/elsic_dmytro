import React, {lazy, Suspense, useEffect} from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import {Provider, useDispatch, useSelector} from "react-redux";
import { store } from "./Store/store";

// ✅ Подключение шрифтов Roboto для Material UI
import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';

// ✅ Провайдер темы
import { ColorModeContextProvider } from "./Providers/ColorModeProvider";

// ✅ Компоненты
import { BoardSpinner } from "./components/MyComponent/LoadingSpinnerBoard/LoadingSpinner";
import NavigationTabs from "./components/Navigation/NavigationTabs";
import Footer from "./containers/Footer/Footer";
import ScrollToTop from "./components/ScrollToTop";
import { Box } from "@mui/system";


import {useRefreshAccessTokenQuery} from "./services/Slice/authApi";
import {clearJwtUserDetails, setJwtUserDetails} from "./services/Slice/jwtUserSlice";
import WineKega from "./containers/WineKega";
import BagInBoxPage from "./containers/WineBagInBox";

// 🔁 Лениво загружаемые страницы
const AppDialog = lazy(() => import('./components/MyComponent/AppDialog'));
const Home = lazy(() => import('./containers/Home'));
const Cooperation = lazy(() => import('./containers/Cooperation'));
const Contacts = lazy(() => import('./containers/Contacts'));

const DrinksList = lazy(() => import('./containers/DrinksPage/DrinksList'));
const VariantsDrinksList = lazy(() => import('./containers/DrinksPage/VariantsDrinksList'));
const DrinksDetails = lazy(() => import('./containers/DrinksPage/DrinksDetails'));
const BrandDetails = lazy(() => import('./containers/DrinksPage/BrandDetails'));
const UserList = lazy(() => import('./containers/UsersPage/UserList'));
const MyAccountDetails = lazy(() => import('./containers/UsersPage/MyAccountDetails'));
const NotFound = lazy(() => import('./containers/NotFoundPage/NotFound'));

/**
 * Основное приложение без store обертки — используется внутри <Provider>
 */
function AppContent() {
    const dispatch = useDispatch();

    // Проверяем наличие пользователя в localStorage
    const hasUserInStorage = !!localStorage.getItem("jwtUser");

    // Делаем запрос на обновление токена только если юзер есть
    const { data, error } = useRefreshAccessTokenQuery(undefined, {skip: !hasUserInStorage,});

    // Если пришли данные — устанавливаем, если ошибка — сбрасываем
    useEffect(() => {
        if (data?.userDetails) {
            dispatch(setJwtUserDetails(data.userDetails));
        }
        if (error) {
            dispatch(clearJwtUserDetails());
        }
    }, [data, error, dispatch]);

    // Есть ли хоть одно диалоговое окно в стеке
    const isDialogOpen = useSelector((state) => state.dialog.stack.length > 0);

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
                        <Suspense fallback={<BoardSpinner />}>
                            <Routes>
                                <Route path="/" element={<Home />} />
                                <Route path="/home" element={<Home />} />
                                <Route path="/cooperation" element={<Cooperation />} />
                                <Route path="/contacts" element={<Contacts />} />
                                <Route path="/drinks/wine_kega" element={<WineKega />} />
                                <Route path="/drinks/wine_baginbox" element={<BagInBoxPage />} />

                                <Route path="/drinks/pagevar" element={<VariantsDrinksList />} />
                                <Route path="/drinks/page" element={<DrinksList />} />
                                <Route path="/drinksDetails/:id/:brandSlug/:slug/:packagingVolume" element={<DrinksDetails />} />
                                <Route path="/brand/:id/:slug" element={<BrandDetails />} />
                                <Route path="/admin/userlist" element={<UserList />} />
                                <Route path="/admin/userlist/:page" element={<UserList />} />
                                <Route path="/my_account" element={<MyAccountDetails />} />
                                <Route path="*" element={<NotFound message="URL не дійсний..." />} />
                            </Routes>
                        </Suspense>
                    </Box>

                    {/* Футер прижат к низу */}
                    <Box width="100%" mt="auto">
                        <Footer />
                    </Box>

                    {/* Диалоговое окно поверх всего */}
                    {isDialogOpen &&
                        <Suspense fallback={<BoardSpinner />}>
                            <AppDialog />
                        </Suspense>
                    }
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
        <Provider store={store}>
            <AppContent />
        </Provider>
    );
}
