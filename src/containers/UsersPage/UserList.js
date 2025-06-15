import React, {Suspense} from 'react';
import {useDeleteUserMutation, useGetLoadRoleListQuery, useGetPageUserListQuery} from "../../services/Slice/userApi";
import CardUser from "../../components/UserCard/CardUser";
import {USER_COLUMNS} from "../../CONSTANTS/Constants";
import GenericList from "../DrinksPage/GenericList";
import UserEditPropertiesCard from "../../components/UserCard/UserEditPropertiesCard";


const HEAD_PARAMS = {
    page: null,
    sort: null,
    order: null
};

const FILTER_PARAMS = {
    authorities: 'checkbox',
    enabled: 'checkbox',
};

const SORT_LIST = [
    USER_COLUMNS.username,
    USER_COLUMNS.email,
    USER_COLUMNS.phone,
    USER_COLUMNS.enabled
]


function UserList() {

    return (
        <GenericList
            useGetPage={useGetPageUserListQuery}
            useGetLists={useGetLoadRoleListQuery}
            useDeleteMutation={useDeleteUserMutation}
            HEAD_PARAMS={HEAD_PARAMS}
            FILTER_PARAMS={FILTER_PARAMS}
            TEXT_COLUMNS={USER_COLUMNS}
            SORT_LIST={SORT_LIST}
            CardComponent={CardUser}
            CardLineComponent={CardUser}
            EditCard={(props) => (
                <Suspense fallback={<div>Loading EditCard...</div>}>
                    <UserEditPropertiesCard {...props} />
                </Suspense>)}
        />
    )
}

export default UserList;
