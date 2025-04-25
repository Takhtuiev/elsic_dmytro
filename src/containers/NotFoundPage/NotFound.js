import {Alert, Typography} from "@mui/material";

const NotFound = ({ message = "Ні чого не знайдено..." }) => {
    return (
        <Alert severity="warning"  variant="outlined">
            <Typography>
                {message}
            </Typography>
        </Alert>
    )
};

export default NotFound;
