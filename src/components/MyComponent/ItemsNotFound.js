import {Alert, Typography} from "@mui/material";
import WarningIcon from "@mui/icons-material/Warning";

const ItemsNotFound = ({ message = "Ні чого не знайдено..." }) => {
    return (
        <Alert
            severity="warning"
            variant="outlined"
            icon={<WarningIcon sx={{  color: "action.disabled" }} />}
            sx={{
                borderColor: "action.disabled",
                color: "action.disabled",
                backgroundColor: theme => theme.palette.background.paper,
            }}
        >
            <Typography>{message}</Typography>
        </Alert>
    )
};

export default ItemsNotFound;
