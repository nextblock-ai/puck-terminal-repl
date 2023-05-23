/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from 'vscode';
import SPS, { SemanticActionHandler } from "../utils/sps/sps";
import { codeEnhancerGrammar } from '../utils/sps/grammar';
import { codeEnhancerPrompt } from '../utils/sps/prompts';
import { codeEnhancer } from '../utils/sps/semanticActions';
import { getActionHandlers } from '../utils/sps/action.handlers';


// all commands are a subclass of Command
export default class CodeEnhancer extends SPS {
    static grammar = codeEnhancerGrammar;
    static prompt = codeEnhancerPrompt();

    triggered = false;
    taskListHeight = 0;
    openTasks: string[] = [];
    commandHistory: string[] = [];
    
    public semanticActions: SemanticActionHandler = codeEnhancer(this, getActionHandlers(this));

    constructor(
        public context: vscode.ExtensionContext,
        public writeEmitter: vscode.EventEmitter<string>) {
        super( 
            CodeEnhancer.prompt,  
            CodeEnhancer.grammar);
        this.projectFolder = this.getProjectFolder();
    }
	async handleUserRequest(userRequest: string) {
		
        if(!this.projectFolder) { throw new Error('No project folder found'); }

        // get the project folder
		process.chdir(this.projectFolder);
        
        // add the user request to the input
        this.addMessageToInputBuffer({
            role: 'user',
            content: `👤 ${userRequest}`
        });
        // execute the user request
        return await this.execute(this.semanticActions);
    }

}



