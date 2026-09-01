import React, { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App.js';
import reportWebVitals from './reportWebVitals.js';

import { ClerkProvider } from '@clerk/clerk-react';

const PUBLISHABLE_KEY =
    process.env.REACT_APP_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
    throw new Error('Missing Clerk Publishable Key');
}

const root = ReactDOM.createRoot(
    document.getElementById('root')
);

root.render(
    <StrictMode>
        <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
            <App />
        </ClerkProvider>
    </StrictMode>
);

reportWebVitals();