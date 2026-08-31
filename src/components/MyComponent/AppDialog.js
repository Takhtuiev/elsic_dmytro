import React, { Suspense } from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    IconButton
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { BoardSpinner } from "./LoadingSpinnerBoard/LoadingSpinner";
import { useDispatch, useSelector } from "react-redux";
import {closeDialog} from "../../services/Slice/dialogSlice";
import { useMediaQuery, useTheme } from "@mui/system";

// Карта ленивых компонентов
const componentMap = {

    UserEditPropertiesCard: React.lazy(() => import("../UserCard/UserEditPropertiesCard")),
    DeleteUser: React.lazy(() => import("../UserCard/DeleteUser")),

    DeleteConfirm: React.lazy(() => import("../ModalWindow/DeleteConfirm")),

    LoginCard: React.lazy(() => import("../ModalWindow/LoginRegistration/LoginCard")),
    RegistrationCard: React.lazy(() => import("../ModalWindow/LoginRegistration/RegistrationCard")),
    ChangePassword: React.lazy(() => import("../UserCard/ChangePassword")),
};


function AppDialog() {
    const theme = useTheme();
    const isFullScreen = useMediaQuery(theme.breakpoints.down("sm"));
    const dispatch = useDispatch();

    // получаем весь стек диалогов
    const dialogStack = useSelector((state) => state.dialog.stack);

    const onClose = (dialogType, data) => {
        if (data) {
            console.log(dialogType,data)
            dispatch({
                type: "dialog/dialogClosed",
                payload: {
                    dialogType,
                    data
                }
            });
        }
        dispatch(closeDialog());
    };

    return (
        <>
            {dialogStack.map((dialog, index) => {
                const { title, maxWidth, componentKey, props } = dialog;
                const Component = componentMap[componentKey];
                if (!Component) return null;

                const zIndexBase = 1300;

                return (
                    <Dialog
                        key={index}
                        open={true}
                        onClose={(event, reason) => {
                            if (reason === "backdropClick") return;
                            dispatch(closeDialog()); // Закрывает верхний
                        }}
                        scroll="body"
                        fullScreen={isFullScreen}
                        maxWidth={maxWidth || "md"}
                        fullWidth
                        sx={{
                            zIndex: zIndexBase + index * 10,
                            backdropFilter: index < dialogStack.length - 1 ? "blur(1px)" : "none",
                            opacity: index < dialogStack.length - 1 ? 0.85 : 1,
                        }}
                    >
                        <DialogTitle>
                            {title || "Dialog"}
                            <IconButton
                                aria-label="close"
                                onClick={() => dispatch(closeDialog())}
                                sx={{ position: "absolute", right: 8, top: 8 }}
                            >
                                <CloseIcon />
                            </IconButton>
                        </DialogTitle>

                        <DialogContent>
                            <Suspense fallback={<BoardSpinner />}>
                                <Component
                                    {...props}
                                    onClose={(data) => onClose(componentKey, data)}
                                />
                            </Suspense>
                        </DialogContent>
                    </Dialog>
                );
            })}
        </>
    );
}

export default AppDialog;
