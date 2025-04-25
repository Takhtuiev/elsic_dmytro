import Container from "@mui/material/Container";
import ErrorBox from "./ErrorBox";

function ErrorCard({ error }) {
    return (
        <Container maxWidth="sm" sx={{padding: '1rem'}}>
            <ErrorBox error={error} />
        </Container>
    )
}

export default ErrorCard;
