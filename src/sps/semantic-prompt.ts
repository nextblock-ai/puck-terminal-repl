/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable @typescript-eslint/no-explicit-any */
import * as Ohm from 'ohm-js';
import * as vscode from 'vscode';

import { codeEnhancerPrompt } from '../utils/sps/prompts';
import { codeEnhancer } from '../utils/sps/semanticActions';
import { getActionHandlers } from '../utils/sps/action.handlers';

import { adhocChatMessage, countTokens, sendQuery } from '../utils/gpt';

function _getProjectFolder(): string | undefined {
	const folders = vscode.workspace.workspaceFolders;
	if (folders) {
		return folders[0].uri.fsPath;
	}
	return undefined;
}

// a semantic prompt structure - consists of a prompt, a grammar file, and semantic action handler
export class SemanticPrompt {

	protected prompt?: string; // the initial prompt. sent by the system user
	protected inputBuffer: adhocChatMessage[];
	protected _executing: boolean;
	private _llmOptions: any;

	// prompt and grammar file are required
	constructor(llmOptions = {
		model: 'gpt-4',
		temperature: 0.9,
		max_tokens: 2048,
		top_p: 1,
		messages: []
	}) {
		this.inputBuffer = [];
		this._executing = false;
		this._llmOptions = llmOptions;
	}

	// add a message to the input buffer to send to the LLM
	addMessageToInputBuffer(message: adhocChatMessage): void { this.inputBuffer.push(message); }
	clearInputBuffer(): void { this.inputBuffer = []; }
	interrupt(): void { this._executing = false; }

	// perform a single iteration of the SPS
	protected async iterate(semanticActionHandler: SemanticActionHandler): Promise<any> {

		return new Promise((resolve, reject) => {
			// get a count of the number of tokens in the input buffer
			const tokenCount = countTokens(this.inputBuffer.map((message) => message.content).join(' '));
			let maxTokens = 8192 - tokenCount; // calculate max tokens we can send to the LLM
			if (maxTokens > 2048) { maxTokens = 2048; } // max tokens is 2048
			if (maxTokens < 10) { // less than 10 tokens left, throw an error
				throw new Error('Input buffer exceeds maximum token count');
			}

			// create a copy of the LLM options and set the max tokens
			// then set the messages to send to the LLM to the input buffer
			const options = JSON.parse(JSON.stringify(this._llmOptions));
			options.max_tokens = maxTokens;
			options.messages = [{
				role: 'system',
				content: this.prompt
			}, ...this.inputBuffer.map((message) => ({
				role: message.role,
				content: message.content
			}))];

			// perform the query
			let response, retries = 0;
			sendQuery(options).then((response) => {
				// add the response to the input buffer
				response += '\n';
				const grammar = this.grammar; // get the grammar
				const semantics = this.semantics; // get the semantics
				const ohmParser = semantics.addOperation(
					"toJSON", // this processes the grammar and returns a JSON object
					semanticActionHandler
				);
				const match = grammar.match(response);
				if (!match.failed()) {
					return ohmParser(match).toJSON().then(resolve);
				} else {
					this.addMessageToInputBuffer({
						role: 'system',
						content: 'INVALID OUTPUT FORMAT. Please review the instructions and try again.'
					});
					console.log(`invalid output format: ${response}`);
					return this.iterate(semanticActionHandler).then((result) => {
						resolve(result);
					});
				}
			}).catch((error) => {
				// if there is an error, retry up to 3 times
				if (retries < 3) {
					retries++;
					return this.iterate(semanticActionHandler);
				} else {
					vscode.window.showErrorMessage('Error: ' + error.message);
					throw error;
				}
			});

		});
	}

	// execute the SPS - iterates until explicitly disabled
	protected async execute(semanticActionHandler: SemanticActionHandler): Promise<any> {
		this._executing = true;
		const _run = async (): Promise<any> => {
			if (!this._executing) { return; }
			const result = await this.iterate(semanticActionHandler);
			if (result && result.stop) {
				this._executing = false;
				console.log('Execution stopped');
				return result;
			}
			if (this._executing) {
				return await _run();
			}
			return result;
		};
		return await _run();
	}

	// use the responders to build the semantic actions
	get grammar(): Ohm.Grammar {
		return {} as any;
	}

	get semantics(): Ohm.Semantics {
		const grammar = this.grammar;
		if (!grammar) {
			throw new Error('No grammar loaded');
		}
		const semantics = grammar.createSemantics();
		return semantics;
	}
}


// an action handler for a semantic action
export type SemanticActionHandler = Ohm.ActionDict<unknown>;

export interface Variable {
	name: string;
	value?: string | number | boolean | object;
	type?: string;
	scope: 'execution' | 'iteration';
}

export interface Array {
	name: string;
	delimiter?: string;
	value?: (string | number | boolean | object)[];
	type?: string;
	scope: 'execution' | 'iteration';
}

export type onProcess = (context: any, scope: 'init' | 'loop' | 'post', obj: any) => Promise<boolean | void>;

interface ScopeBehavior {
	onInit?: (parent: SemanticProcessor) => void;
	onLoop?: (parent: SemanticProcessor) => void;
	onPost?: (parent: SemanticProcessor) => void;
}

export interface SemanticResponder extends ScopeBehavior {
	name: string;
	inputPrompt?: string;
	outputPrompt?: string;
	delimiter?: string;
	scopes: ('init' | 'loop' | 'post')[];
	process: onProcess;
	filter?: (input: any) => any; // Add this line
}

export interface SemanticProcessor {
	variables: Variable[];
	arrays: Array[];
	responders: SemanticResponder[];
}


export class ModularSemanticPrompt extends SemanticPrompt implements SemanticProcessor {

	variables: Variable[] = [];
	arrays: Array[] = [];
	responders: SemanticResponder[] = [];

	static prompt = codeEnhancerPrompt();

	triggered = false;
	taskListHeight = 0;
	projectFolder: string | undefined;
	openTasks: string[] = [];
	commandHistory: string[] = [];

	public semanticActions: SemanticActionHandler = codeEnhancer(this, getActionHandlers(this));

	constructor(
		public context: vscode.ExtensionContext,
		public writeEmitter: vscode.EventEmitter<string>,
		llmOptions?: any) {
		super(llmOptions);
		this.projectFolder = _getProjectFolder();
	}

	async handleUserRequest(userRequest: string) {
		if (!this.projectFolder) { throw new Error('No project folder found'); }
		// get the project folder
		process.chdir(this.projectFolder);

		// add the user request to the input
		this.addMessageToInputBuffer({
			role: 'user',
			content: `${userRequest}`
		});
		// execute the user request
		return await this.execute();
	}

	addResponder(responder: SemanticResponder): void {
		this.responders.push(responder);
	}


	private _parseCommands(text: string, legalEmojis: string[]) {
		const lines = text.split('\n');
		const cmds: any = [];
		let emojiFound: string | undefined = '';
		lines.forEach(line => {
			const eFound = legalEmojis.find(emoji => line.startsWith(emoji));
			if (eFound) {
				emojiFound = eFound;
				const value = line.replace(eFound, '').trim();
				cmds.push({ command: emojiFound, message: [value] });
			} else {
				const latestCmd = cmds[cmds.length - 1];
				latestCmd.message.push(line);
			}
		});
		return cmds;
	}

	// execute the SPS - iterates until explicitly disabled
	public async execute(): Promise<any> {

		this._executing = true;
		const _run = async (): Promise<any> => {
			if (!this._executing) { return; }
			const result = await this.iterate(this.semanticActionHandlers);
			if (result && result.stop) {
				this._executing = false;
				console.log('Execution stopped');
				return result;
			}
			if (this._executing) {
				return await _run();
			}
			return result;
		};
		return await _run();
	}


	// use the responders to build the semantic actions
	get grammar(): Ohm.Grammar {
		// get a list of repsonders - filter out the responderrs with no delimiter
		const responders = this.responders.filter(responder => responder.delimiter);
		return Ohm.grammar(`
			CodeEnhancer {
				CodeEnhancerMessage=(Delimiters Title)+
				Title=(~(Delimiters) any)*
				Delimiters=(${responders.map(responder => responder.name).join('|')})
				${responders.map(responder => responder.name + '="' + responder.delimiter + '"\n')}
			}
		`);
	}

	inputPromptProcessor(prompt: string, message: string): string {
		return message;
	}
	outputPromptProcessor(prompt: string, obj: any): any {
		return obj;
	}

	_println(message: string): void {
		this.writeEmitter.fire(message);
	}

	get semanticActionHandlers(): Ohm.ActionDict<unknown> {
		const semanticActions: any = {
			CodeEnhancerMessage: async (delimiters: any, titles: any) => {
				const message = {
					role: delimiters.toJSON(), content: titles.sourceString.trim(),
				};
				return message;
			},
			Title: (title: any) => { return title.sourceString; },
			Delimiters: (delimiters: any) => { return delimiters.sourceString; },
			_iter: async (children: any) => {
				const recs = children.map(function (child: any) { return child.toJSON(); });
				const delimiters = this.responders.map(responder => responder.delimiter);
				const messageSource = children[0].source.sourceString;
				const messageCommands = this._parseCommands(messageSource, delimiters as any).map((cmd: any) => {
					const arrayItem = this.arrays.find(item => item.delimiter === cmd.command);
					if (arrayItem && !arrayItem.type) {
						arrayItem.type = typeof cmd.content;
					}
					return cmd;
				});
				for (const arrayItem of this.arrays) {
					if (arrayItem.scope === 'iteration') {
						arrayItem.value = messageCommands.filter((cmd: any) => cmd.command === arrayItem.delimiter);
					} else {
						arrayItem.value && arrayItem.value.push(...messageCommands.filter((cmd: any) => cmd.command === arrayItem.delimiter));
					}
				}
				const initReponders = this.responders.filter(responder => responder.scopes.includes('init'));
				const loopReponders = this.responders.filter(responder => responder.scopes.includes('loop'));
				const postReponders = this.responders.filter(responder => responder.scopes.includes('post'));

				const contextObject = {
					writeEmitter: this.writeEmitter,
					variables: this.variables,
					arrays: this.arrays,
					responders: this.responders,
					triggered: this.triggered,
					taskListHeight: this.taskListHeight,
					projectFolder: this.projectFolder,
					openTasks: this.openTasks,
					commandHistory: this.commandHistory,
					inputBuffer: this.inputBuffer,
					addMessageToInputBuffer: this.addMessageToInputBuffer.bind(this),
					clearInputBuffer: this.clearInputBuffer.bind(this),
					interrupt: this.interrupt.bind(this),
					messageCommands: messageCommands,
				};

				for (const responder of initReponders) {
					responder.process(contextObject, 'init', messageCommands);
				}
				for (const messageCommand of messageCommands) {
					// set the variable value if it is an iteration variable
					for (const variable of this.variables) {
						if (variable.scope === 'iteration' && variable.name === messageCommand.command) {
							variable.value = messageCommand.message;
						}
					}
					for (const responder of loopReponders) {
						if (messageCommand.delimiter === responder.delimiter) {

							let inputMessage = messageCommand.message;

							if (responder.filter) {
								inputMessage = responder.filter(inputMessage);
							}
							if (responder.inputPrompt) {
								// Custom input processing using responder's inputPrompt
								inputMessage = this.inputPromptProcessor(responder.inputPrompt, messageCommand.message);
							}
							const output = await responder.process(contextObject, 'loop', messageCommand);
							if (responder.outputPrompt) {
								// Custom output processing using responder's outputPrompt
								const processedOutput = this.outputPromptProcessor(responder.outputPrompt, output);
								// Update the inputBuffer with the processedOutput
								this.addMessageToInputBuffer({
									role: 'assistant',
									content: `${processedOutput}`
								});
							} else {
								// Update the inputBuffer with the output
								this.addMessageToInputBuffer({
									role: 'assistant',
									content: `${output}`
								});
							}
						}
					}
				}
				for (const responder of postReponders) {
					responder.process(contextObject, 'post', messageCommands);
				}
				return recs;
			}
		};
		this.responders.forEach(responder => {
			semanticActions[responder.name] = (delimiter: any) => { return delimiter.sourceString; };
		});
		return semanticActions;
	}
}

