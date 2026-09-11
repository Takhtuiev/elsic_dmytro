import {useEffect} from "react";
import {
    useOrganization,
    useOrganizationList,
    useUser
} from "@clerk/clerk-react";

function ClerkOrgInitializer() {
    const {isSignedIn} = useUser();
    const {organization} = useOrganization();

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
            organization ||
            !userMemberships?.data?.length
        ) {
            return;
        }

        setActive({
            organization:
            userMemberships.data[0].organization.id
        });
    }, [
        isSignedIn,
        isLoaded,
        organization,
        userMemberships,
        setActive
    ]);

    return null;
}

export default ClerkOrgInitializer;