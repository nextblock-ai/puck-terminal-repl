/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable @typescript-eslint/no-explicit-any */
import * as Ohm from 'ohm-js';
import * as fs from 'fs';
import { adhocChatMessage, sendQuery } from '../gpt';
import { log } from '../outputLog';
import * as vscode from 'vscode';

// an action handler for a semantic action
export type SemanticActionHandler = Ohm.ActionDict<unknown>;

// a semantic prompt structure - consists of a prompt, a grammar file, and semantic action handler
export default class SPS {
    protected projectFolder: string | undefined;
    protected prompt: string;
    protected grammarFile: string;
    protected semanticActionHandler: SemanticActionHandler | undefined;
    protected inputBuffer: adhocChatMessage[];
    private _executing: boolean;
    private _llmOptions: any;
    // prompt and grammar file are required
    constructor(prompt: string, grammarFile: string, llmOptions = {
        model: 'gpt-4',
        temperature: 0.7,
        max_tokens: 2048,
        top_p: 1,
        messages: []
    }) {
        this.prompt = prompt;
        this.grammarFile = grammarFile;
        this.inputBuffer = [];
        this._executing = false;
        this._llmOptions = llmOptions;
    }
    // add a message to the input buffer to send to the LLM
    addMessageToInputBuffer(message: adhocChatMessage): void { this.inputBuffer.push(message); }
    clearInputBuffer() { this.inputBuffer = []; }
    interrupt(): void { this._executing = false; }
    
    // perform a single iteration of the SPS
    async iterate(semanticActionHandler: SemanticActionHandler): Promise<any> {
        if(this.inputBuffer.length ===0) {
            this._executing = false;
            return;
        }
        this.semanticActionHandler = semanticActionHandler;
        const getResponse = async () => sendQuery({
            model: 'gpt-4',
            temperature: 0.8,
            max_tokens: 2048,
            top_p: 0.8,
            messages: [{
                role: 'system',
                content: this.prompt
            }, ...this.inputBuffer.map((message) => ({
                role: message.role,
                content: message.content
            })) as any]
        });
        let response: any, failCount = 0;
        try {
            response = await getResponse();
        } catch (e: any) {
            if(failCount < 5) {
                failCount++;
                log(`Retrying: ${e.message}`);
                response = await getResponse();
            } else {
                this._executing === false;
                return {
                    stop: true
                };
            }
        }
        try {
            response += '\n';
            const { grammar, semantics } = this.loadGrammar(this.grammarFile);
            const ohmParser = semantics.addOperation("toJSON", this.semanticActionHandler);
            const match = grammar.match(response);
            if (!match.failed()) {
                const result = await ohmParser(match).toJSON();
                return result;
            } else {
                if(this._executing === false) { return {
                    stop: true
                }; }
                this.addMessageToInputBuffer({
                    role: 'system',
                    content: 'INVALID OUTPUT FORMAT. Please review the instructions and try again.'
                });
                console.log(`invalid output format: ${response}`);
                await this.iterate(semanticActionHandler);
            }
        } catch (e: any) { 
            log(e.message, true);
            log(e.problems, true);
        }
    }

    // execute the SPS - iterates until explicitly disabled
    async execute(semanticActionHandler: SemanticActionHandler): Promise<any> {
        this._executing = true;
        const _run = async (): Promise<any> => {
            if (!this._executing) { return; }
            const result = await this.iterate(semanticActionHandler);
            if (!this._executing || result && result.stop) { // execution can be stopped by the semantic action handler
                this._executing = false;
                console.log('Execution stopped');
                return result;
            }
            if (!this._executing) {
                console.log('Execution completed');
                return result;
            } 
            return _run();
        }; 
        return _run();
    }

    // serialize the SPS to a file
    serializeToFile(filePath: string): void {
        const serializedData = JSON.stringify({
            prompt: this.prompt,
            grammarFile: this.grammarFile,
            inputBuffer: this.inputBuffer,
        });
        fs.writeFileSync(filePath, serializedData);
    }

    // deserialize from file
    static deserializeFromFile(filePath: string): SPS {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const deserializedData = JSON.parse(fileContent);
        const sps = new SPS(
            deserializedData.prompt,
            deserializedData.grammarFile);
        sps.inputBuffer = deserializedData.inputBuffer;
        return sps;
    }

    // load the SPS grammar
    protected loadGrammar(grammarFile: string) {
        // Read the grammar file and return an Ohm.js grammar object
        const grammar = Ohm.grammar(grammarFile);
        const semantics = grammar.createSemantics();
        return { grammar, semantics };
    }

    protected getProjectFolder(): string {
        // get the project folder
		this.projectFolder = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
		if(!this.projectFolder) { throw new Error('No project folder found'); }
		process.chdir(this.projectFolder);
        return this.projectFolder;
    }
}
