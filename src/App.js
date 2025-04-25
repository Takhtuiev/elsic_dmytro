import {BrowserRouter, Route, Routes} from "react-router-dom"
import Home from "./containers/Home/Home";
import {lazy, Suspense} from "react";
import {Provider} from "react-redux";
import NotFound from "./containers/NotFoundPage/NotFound";
import {store} from "./Store/store";
import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import {JwtProvider} from "./Providers/JwtProvider";
import {ColorModeContextProvider} from "./Providers/ColorModeProvider";

import LoadingSpinner from "./components/MyComponent/LoadingSpinnerBoard/LoadingSpinner";
import NavigationTabs from "./components/Navigation/NavigationTabs";
import Footer from "./containers/Footer/Footer";
import DrinksList from "./containers/DrinksPage/DrinksList";
import VariantsDrinksList from "./containers/DrinksPage/VariantsDrinksList";
import BrandDetails from "./containers/DrinksPage/BrandDetails";
import {Box} from "@mui/system";


const UserList = lazy(() => import('./containers/UsersPage/UserList'));
const DrinksDetails = lazy(() => import('./containers/DrinksPage/DrinksDetails'));
const MyAccountDetails = lazy(() => import("./containers/UsersPage/MyAccountDetails"));

export default function App() {

    return (
        <ColorModeContextProvider>
            <Provider store={store}>
                <JwtProvider>
                    <BrowserRouter>
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
