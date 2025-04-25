import {useState} from "react";
import MyDialog from "../../MyComponent/MyDialog";
import LoginCard from "./LoginCard";
import RegistrationCard from "./RegistrationCard";

function DialogLoginRegistration({ show, setShow}) {

    const [isRegistration, setIsRegistration] = useState(false);

    const handleClose = () => {
        setShow(false);
        //Сбросить все старые данные
        setIsRegistration(false);
    };

    const logReg = () => {
        setIsRegistration(!isRegistration);
    };

    return (
        <MyDialog
            open={!!show}
            onClose={handleClose}
            title={isRegistration ? 'Registration' : 'Login'}
        >
            {isRegistration
                ?
                <RegistrationCard
                    logReg={logReg}
                />
                :
                <LoginCard
                    close={handleClose}
                    logReg={logReg}
                />
            }
        </MyDialog>
    );
}

export default DialogLoginRegistration;