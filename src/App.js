import { BrowserRouter, Route, Routes } from "react-router-dom";
import { lazy, Suspense } from "react";
import { Provider } from "react-redux";
import { store } from "./Store/store";
import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import { JwtProvider } from "./Providers/JwtProvider";
import { ColorModeContextProvider } from "./Providers/ColorModeProvider";

import LoadingSpinner from "./components/MyComponent/LoadingSpinnerBoard/LoadingSpinner";
import NavigationTabs from "./components/Navigation/NavigationTabs";
import Footer from "./containers/Footer/Footer";
import { Box } from "@mui/system";
import ScrollToTop from "./components/ScrollToTop";

// 🔁 lazy load all route components
const Home = lazy(() => import('./containers/Home/Home'));
const DrinksList = lazy(() => import('./containers/DrinksPage/DrinksList'));
const VariantsDrinksList = lazy(() => import('./containers/DrinksPage/VariantsDrinksList'));
const DrinksDetails = lazy(() => import('./containers/DrinksPage/DrinksDetails'));
const BrandDetails = lazy(() => import('./containers/DrinksPage/BrandDetails'));
const UserList = lazy(() => import('./containers/UsersPage/UserList'));
const MyAccountDetails = lazy(() => import('./containers/UsersPage/MyAccountDetails'));
const NotFound = lazy(() => import('./containers/NotFoundPage/NotFound'));

export default function App() {

    return (
        <ColorModeContextProvider>
            <Provider store={store}>
                <JwtProvider>
                    <BrowserRouter>
                        <ScrollToTop />
                        <Box
                            display="flex"
                            flexDirection="column"
                            minHeight="100vh"
                        >
                            {/* Навигация */}
                            <Box width="100%">
                                <NavigationTabs />
                            </Box>

                            {/* Контент */}
                            <Box
                                width="100%"
                                maxWidth="xl" // Ограничиваем ширину
                                mx="auto"
                            >
                                <Suspense fallback={<LoadingSpinner />}>
                                    <Routes>
                                        <Route exact path="/" element={<Home />} />
                                        <Route path="/drinks/pagevar" element={<VariantsDrinksList />} />
                                        <Route path="/drinks/page" element={<DrinksList />} />
                                        <Route path="/drinksDetails/:id" element={<DrinksDetails />} />
                                        <Route path="/brand/:name" element={<BrandDetails />} />
                                        <Route path="/admin/userlist/" element={<UserList />}>
                                            <Route path=":page" element={<UserList />} />
                                        </Route>
                                        <Route path="/my_account" element={<MyAccountDetails />} />
                                        <Route path="*" element={<NotFound message={'URL не дійсний...'} />} />
                                    </Routes>
                                </Suspense>
                            </Box>

                            {/* Подвал */}
                            <Box width="100%" mt="auto">
                                <Footer />
                            </Box>
                        </Box>
                    </BrowserRouter>
                </JwtProvider>
            </Provider>
        </ColorModeContextProvider>
    )
}
