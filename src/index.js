import React, {StrictMode, useEffect} from "react";
import ReactDOM from "react-dom/client";

import "./index.css";
import App from "./App.js";
import reportWebVitals from "./reportWebVitals.js";

import {
    ClerkProvider,
    useOrganizationList,
    useUser
} from "@clerk/clerk-react";

import {Provider} from "react-redux";
import store from "./Store/Store";

const PUBLISHABLE_KEY =
    process.env.REACT_APP_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
    throw new Error("Missing Clerk Publishable Key");
}

function OrganizationInitializer() {
    const {isSignedIn} = useUser();

    const {
        isLoaded,
        setActive,
        userMemberships
    } = useOrganizationList({
        userMemberships: {
            infinite: true
        }
    });

    useEffect(() => {
        if (
            !isSignedIn ||
            !isLoaded ||
            !userMemberships?.data?.length
        ) {
            return;
        }

        const organization = userMemberships.data[0].organization;

        setActive({
            organization: organization.id
        });
    }, [
        isSignedIn,
        isLoaded,
        userMemberships,
        setActive
    ]);

    return null;
}

const root = ReactDOM.createRoot(
    document.getElementById("root")
);

root.render(
    <StrictMode>
        <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
            <Provider store={store}>
                <OrganizationInitializer />
                <App />
            </Provider>
        </ClerkProvider>
    </StrictMode>
);

reportWebVitals();