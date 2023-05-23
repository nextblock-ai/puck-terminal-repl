/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from 'vscode';
import SPS, { SemanticActionHandler } from "../utils/sps/sps";
import { codeEnhancer2grammar } from '../utils/sps/grammar';
import * as diff from 'diff';
import { TextDecoder } from 'util';
import { codeEnhancer2prompt } from '../utils/sps/prompts';
import { codeEnhancer2 } from '../utils/sps/semanticActions';
import getDependencies from './dependencies';

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
export default class CodeEnhancer2 extends SPS {
    static grammar = codeEnhancer2grammar;
    static prompt = codeEnhancer2prompt;
    triggered = false;
    public semanticActions?: SemanticActionHandler;

    constructor(public context: vscode.ExtensionContext, criteria: string) {
        super(
            CodeEnhancer2.prompt(criteria), CodeEnhancer2.grammar
        );
        this.semanticActions = codeEnhancer2(this, {
            changes: [],
            processFileRequest: async (msg: string): Promise<string> => {
                const file = msg.replace('📤', '').trim();
                const fileContents = await vscode.workspace.fs.readFile(vscode.Uri.file(file));
                const fileContentsStr = new TextDecoder().decode(fileContents);
                return fileContentsStr;
            },
            processFileUpdate: async (msg: string): Promise<any> => {
                let file = msg.replace('💽', '').trim();
                file = msg.replace('🧩', '').trim();
                const fileContentsStr = msg.split('\n').slice(1).join('\n');
                return { file: file, contents: fileContentsStr };
            },
            processDiffRequest: async (msg: string): Promise<any> => {
                const file = msg.replace('💠', '').trim();
                const fileContents = await vscode.workspace.fs.readFile(vscode.Uri.file(file));
                const fileContentsStr = new TextDecoder().decode(fileContents);
                // use the diff npm lib to apply the patch
                let patchedContents = fileContentsStr;
                const parsedDiff = diff.parsePatch(fileContentsStr);
                for(const d of parsedDiff) {
                    patchedContents = diff.applyPatch(fileContentsStr, d);
                }
                return { file: file, contents: patchedContents };
            }
        });
    }

    async handleUserRequest(fileName: string, semanticActionHandler: SemanticActionHandler) {
        // the user request is a file path. We need to load the file and add it to the input buffer
        const fileContents = await vscode.workspace.fs.readFile(vscode.Uri.file(fileName));
        const dependencies = await getDependencies(fileName);
        // add the user request to the input
        this.addMessageToInputBuffer({
            role: 'user',
            content: `💽 ${fileName}:\n\n${fileContents}`
        });
        for(const dep of dependencies) {
            // get the file contents
            const fileContents = await vscode.workspace.fs.readFile(vscode.Uri.file(dep));
            this.addMessageToInputBuffer({
                role: 'user',
                content: `🧩 ${dep}\n\n${new TextDecoder().decode(fileContents)}\n\n`
            });
        }
        // execute the user request and return the result
        return await this.execute(semanticActionHandler);
    }

}



