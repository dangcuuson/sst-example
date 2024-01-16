import { OperationVariables } from '@apollo/client';
import { Mutation, MutationComponentOptions } from '@apollo/client/react/components';
import React from 'react';
import { useSetMessage } from './ApolloMutationResultMessagePopup';

// similar to ApolloQueryWrapper, ApolloMutationWrapper will streamline common behaviour when using mutation
// 1. If error: display a pop-up error message.
// 2. If success: display a pop-up success message (optional)

type MutationWrapperProps<TData, TVariables> = MutationComponentOptions<TData, TVariables> & {
    // if defined, will show sucess message
    getSuccessMessage?: (data: TData) => string;
    // will show error message whether it's defined or not
    getErrorMessage?: () => string;
};

function ApolloMutationWrapper<TData, TVariables extends OperationVariables>(
    props: MutationWrapperProps<TData, TVariables>,
): React.ReactNode {
    const setMessage = useSetMessage();
    const { getSuccessMessage, getErrorMessage, ...mutationProps } = props;
    return (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        <Mutation<any, any>
            {...mutationProps}
            onCompleted={(data: TData) => {
                if (getSuccessMessage) {
                    const content = getSuccessMessage(data);
                    setMessage({ color: 'success', content });
                }
                if (props.onCompleted) {
                    props.onCompleted(data);
                }
            }}
            onError={(error) => {
                const getDefaultErrorMessage = () => {
                    return import.meta.env.PROD
                        ? `There was an error occured :(`
                        : error.message.replace(/GraphQL error:/g, '');
                };
                const errorMessage = getErrorMessage ? getErrorMessage() : getDefaultErrorMessage();
                console.error(error);
                setMessage({ color: 'error', content: errorMessage });
                if (props.onError) {
                    props.onError(error);
                }
            }}
        />
    );
}

export default ApolloMutationWrapper;
