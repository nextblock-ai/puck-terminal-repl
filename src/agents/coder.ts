/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from 'vscode';
import SPS, { SemanticActionHandler } from "../utils/sps/sps";
import { codeEnhancer3grammar } from '../utils/sps/grammar';
import { codeEnhancer3prompt } from '../utils/sps/prompts';
import { codeEnhancer3 } from '../utils/sps/semanticActions';
import { getActionHandlers } from '../utils/sps/action.handlers';

type UnifiedDiff = {
    oldFileName: string;
    newFileName: string;
    oldFileStart: number;
    newFileStart: number;
    oldFileLines: number;
    newFileLines: number;
    changes: string[];
};

// all commands are a subclass of Command
export default class CodeEnhancer3 extends SPS {

    static grammar = codeEnhancer3grammar;
    static prompt = codeEnhancer3prompt();
    triggered = false;

    public semanticActions: SemanticActionHandler = codeEnhancer3(this, getActionHandlers(this));
    constructor(
        public context: vscode.ExtensionContext, 
        public writeEmitter: vscode.EventEmitter<string>) {
        super( 
            CodeEnhancer3.prompt,  CodeEnhancer3.grammar
        );
        this.projectFolder = this.getProjectFolder();
    }

    async handleUserRequest(request: string) {

        // get the project folder
        if(!this.projectFolder) { throw new Error('No project folder found'); }

        process.chdir(this.projectFolder);
        // add the user request to the input
        this.addMessageToInputBuffer({
            role: 'user',
            content: `📢 ${request}`
        });

        // execute the user request
        return await this.execute(this.semanticActions);
    }

}



