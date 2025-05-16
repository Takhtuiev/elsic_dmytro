import MyCard from "../MyComponent/MyCard";
import {Box} from "@mui/system";
import {Skeleton} from "@mui/lab";
import {Divider} from "@mui/material";

function CardVariantDrinkSkeleton() {
    return (
        <MyCard sx={{ flexDirection: 'column' }}>
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: 'center' }}>
                <Skeleton width="60%" height={32} />
                <Skeleton width="40%" height={20} />
            </Box>

            <Divider sx={{ my: 1 }} />

            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Skeleton variant="rectangular" width="48%" height={120} />
                <Box sx={{ width: "48%" }}>
                    <Skeleton width="60%" />
                    <Skeleton width="40%" />
                    <Skeleton width="80%" />
                    <Skeleton width="50%" />
                    <Skeleton width="40%" />
                </Box>
            </Box>

            <Divider sx={{ my: 1 }} />

            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <Skeleton width="30%" height={30} />
                <Skeleton width="90%" height={20} />
                <Skeleton width="90%" height={20} />
             </Box>
        </MyCard>
    );
}
export default CardVariantDrinkSkeleton