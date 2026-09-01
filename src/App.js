import React, { lazy } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "@fontsource/roboto/300.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";
import { Box } from "@mui/system";
import { Protect } from "@clerk/clerk-react";
import { ColorModeContextProvider } from "./Providers/ColorModeProvider";
import NavigationTabs from "./components/Navigation/NavigationTabs";
import Footer from "./containers/Footer/Footer";
import ScrollToTop from "./components/ScrollToTop";
import Biegeberechnung from "./containers/Bending/Biegeberechnung";
import MyAccount from "./components/Navigation/MyAccount";
import AccessDenied from "./components/Auth/AccessDenied";
import OrganizationAdmin from "./components/Admin/OrganizationAdmin";

const Home = lazy(() => import("./containers/Home"));
const Contacts = lazy(() => import("./containers/Contacts"));
const NotFound = lazy(() => import("./containers/NotFoundPage/NotFound"));

function AppContent() {
    return (
        <ColorModeContextProvider>
            <BrowserRouter>
                <ScrollToTop />
                <Box display="flex" flexDirection="column" minHeight="100vh">
                    <Box width="100%"><NavigationTabs /></Box>

                    <Box sx={{ width: "100%", minHeight: "100vh", maxWidth: "lg", mx: "auto" }}>
                        <Routes>
                            <Route path="/" element={<Home />} />
                            <Route path="/home" element={<Home />} />
                            <Route path="/contacts" element={<Contacts />} />
                            <Route path="/my_account/*" element={<MyAccount />} />

                            <Route
                                path="/biegeberechnung"
                                element={
                                    <Protect permission="org:calculation:use" fallback={<AccessDenied />}>
                                        <Biegeberechnung />
                                    </Protect>
                                }
                            />

                            <Route
                                path="/administration"
                                element={
                                    <Protect role="org:admin"  fallback={<AccessDenied />}>
                                        <OrganizationAdmin />
                                    </Protect>
                                }
                            />

                            <Route path="*" element={<NotFound message="Invalid URL..." />} />
                        </Routes>
                    </Box>

                    <Box width="100%" mt="auto"><Footer /></Box>
                </Box>
            </BrowserRouter>
        </ColorModeContextProvider>
    );
}

export default function App() {
    return <AppContent />;
}