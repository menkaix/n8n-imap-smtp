import type { ICredentialsDecrypted, ICredentialTestFunctions, IExecuteFunctions, INodeCredentialTestResult, INodeExecutionData, INodeType, INodeTypeDescription } from 'n8n-workflow';
export declare class EmailImap implements INodeType {
    description: INodeTypeDescription;
    methods: {
        credentialTest: {
            imapConnectionTest(this: ICredentialTestFunctions, credential: ICredentialsDecrypted): Promise<INodeCredentialTestResult>;
            smtpConnectionTest(this: ICredentialTestFunctions, credential: ICredentialsDecrypted): Promise<INodeCredentialTestResult>;
        };
    };
    execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]>;
}
