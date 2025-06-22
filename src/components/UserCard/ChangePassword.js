import React, { useState } from "react";
import {
    Button, Typography,
} from "@mui/material";
import MyInputPassword from "../MyComponent/MyInputPassword";
import ErrorBox from "../ErrorBoard/ErrorBox";
import { useChangePasswordMutation } from "../../services/Slice/userApi";
import {closeDialog} from "../../services/Slice/dialogSlice";
import {useDispatch} from "react-redux";
import Grid from "@mui/material/Grid";
import SaveIcon from "@mui/icons-material/Save";

function ChangePasswordDialog() {
    const dispatch = useDispatch();

    const [oldPassword, setOldPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState(null);

    const [changePassword, { isLoading }] = useChangePasswordMutation();

    const onClose = async () => {
        dispatch(closeDialog());
    }
        const handleSave = async () => {
        setError(null);

        if (!oldPassword || !newPassword || !confirmPassword) {
            setError({ general: "All fields are required" });
            return;
        }

        if (newPassword !== confirmPassword) {
            setError({ confirmPassword: "Passwords do not match" });
            return;
        }

        const result = await changePassword({
            oldPassword,
            newPassword,
        });

        if (result.error) {
            setError(result.error.data || { general: "Password change failed" });
        } else {
            onClose(); // close dialog on success
            setOldPassword("");
            setNewPassword("");
            setConfirmPassword("");
        }
    };

    const handleClose = () => {
        setOldPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setError(null);
        onClose();
    };

    return (
        <Grid container direction={"column"} spacing={1} pt={1}>

            <MyInputPassword
                obj={{ key: "oldPassword", label: "Current Password", value: oldPassword, error: error?.oldPassword }}
                setValue={(val) => setOldPassword(val)}
            />

            <Typography variant="subtitle2" sx={{ mt: 3, color: 'text.secondary' }}>
                Set a New Password
            </Typography>

            <MyInputPassword
                obj={{ key: "newPassword", label: "New Password", value: newPassword, error: error?.newPassword }}
                setValue={(val) => setNewPassword(val)}
                type={"text"}
            />
            <MyInputPassword
                obj={{ key: "confirmPassword", label: "Confirm New Password", value: confirmPassword, error: error?.confirmPassword }}
                setValue={(val) => setConfirmPassword(val)}
                type={"text"}
            />

            {error?.general && <ErrorBox error={{ general: error.general }} />}

            <Grid container justifyContent={"center"}>
                <Button onClick={handleClose} disabled={isLoading}>Cancel</Button>
                <Button
                    variant="contained"
                    loading={isLoading}
                    onClick={handleSave}
                    size="sm"
                 >
                    <SaveIcon sx={{ marginRight: '1rem' }} />Save
                </Button>

             </Grid>

        </Grid>
    );
}

export default ChangePasswordDialog;
