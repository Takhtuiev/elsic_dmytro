import React from "react";
import { Button, useTheme } from "@mui/material";
import {
    SignInButton,
    UserButton,
    useUser,
} from "@clerk/clerk-react";
import { dark } from "@clerk/ui/themes";

function UserBar() {
    const { user, isLoaded } = useUser();
    const theme = useTheme();

    if (!isLoaded) {
        return null;
    }

    if (!user) {
        return (
            <SignInButton mode="modal">
                <Button
                    sx={{
                        textTransform: "none",
                        fontSize: "0.9rem",
                    }}
                >
                    Login
                </Button>
            </SignInButton>
        );
    }

    const isDark = theme.palette.mode === "dark";

    const clerkAppearance = isDark
        ? {
            theme: dark,
        }
        : {};

    return (
        <UserButton
            userProfileMode="modal"

            // ТЕМА МЕНЮ UserButton
            appearance={clerkAppearance}

            // ТЕМА МОДАЛЬНОГО UserProfile
            userProfileProps={{
                appearance: clerkAppearance,
            }}
        />
    );
}

export default UserBar;