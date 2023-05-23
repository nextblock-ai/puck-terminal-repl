/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-case-declarations */
/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from "vscode";
import { Command } from "../utils/Command";
import triage from "../agents/triage";
import { getProgrammingAnswer } from "../agents/answerer";
import CodeEnhancer from "../agents/commander";
import CodeEnhancer3 from "../agents/coder";
import getDocumentation from "../agents/documenter";

function colorText(text: string, colorIndex: number): string {
	let output = '';
	for (let i = 0; i < text.length; i++) {
		const char = text.charAt(i);
		if (char === ' ' || char === '\r' || char === '\n') {
			output += char;
		} else {
			output += `\x1b[3${colorIndex}m${text.charAt(i)}\x1b[0m`;
		}
	}
	return output;
}

export default class PuckREPLCommand extends Command {
	
	working = false;
	terminal: vscode.Terminal | undefined;
	pty: any;
	history: string[] = [];
	writeEmitter: vscode.EventEmitter<string>;
	sps: any;

	_spinner = {
		interval: 100,
		frames: ['🌍', '🌎', '🌏'],
		currentFrame: 0,
		handle: null,
	};

    constructor(commandId: string, title: string, context: vscode.ExtensionContext) {
        
		super(commandId, title, context);

		let line = '';
		const we = this.writeEmitter = new vscode.EventEmitter<string>();

		this.pty = {
			
			onDidWrite: we.event,
			open: () => we.fire('Puck Terminal REPL v0.1.0.\r\n\r\n>>'),
			close: () => { /* noop*/ },
			handleInput: async (data: string) => {
				
				// ctrl + c interrupts everything
				if (data === '\x03') {
					this.interrupt();
					line = '';
					return;
				}

				// if we are working then we can't do anything
				if(this.working) {
					return;
				}

				// if this is a carriage return then we need to execute the command
				if (data === '\r') { // Enter
					this.history.push(line);
					if(line === 'clear') {
						we.fire('\x1b[2J\x1b[3J\x1b[;H');
						line = '';
						return;
					}
					we.fire(`\r\n${colorText(line, 1)}\r\n\n`);
					this.startSpinner();
					this.working = true;
					await this.handleInput(line);
					line = '';
					return;
				}

				if (data === '\x7f') { // Backspace
					if (line.length === 0) {
						return;
					}
					line = line.substr(0, line.length - 1);
					// Move cursor backward
					we.fire('\x1b[D');
					// Delete character
					we.fire('\x1b[P');
					return;
				}

				// arrow up
				if (data === '\x1b[A') {
					if (this.history.length === 0) {
						return;
					}
					if (this.history.length === 1) {
						line = this.history[0];
					} else {
						line = this.history[this.history.length - 2];
					}
					we.fire('\x1b[2K');
					we.fire('\r>>> ' + line);
					return;
				}

				// arrow down
				if (data === '\x1b[B') {
					if (this.history.length === 0) {
						return;
					}
					line = this.history[this.history.length - 1];
					we.fire('\x1b[2K');
					we.fire('\r>>> ' + line);
					return;
				}

				line += data;
				we.fire(data);
			},
		};
    }
	interrupt() {
		const we = this.writeEmitter;
		if (this.working) {
			we.fire('\r\n');
			we.fire('KeyboardInterrupt\r\n');
			this.working = false;
		} else {
			we.fire('^C\r\n');
			we.fire('KeyboardInterrupt\r\n');
			we.fire('>>> ');
		}
	}
	async handleInput(line: string) {
		// this is where we would send the command to the puck
		const triageLine = await triage(line);
		const triageType = triageLine.split(' ')[0];
		switch(triageType) {
			case '💡':
				await this.handleCodeRelatedRequest(triageLine);
				break;
			case '📚':
				await this.handleTestAndDocumentationRequest(triageLine);
				break;
			case '🖥️':
				await this.handleCommandExecutionRequest(triageLine);
				break;
			default:
				await this.handleUnknownRequest(triageLine);
				break;
		}
		this.stopSpinner();
		this.working = false;
		this.writeEmitter.fire('>>> ');
		return triageLine;
	}
	async handleTestAndDocumentationRequest(line: string) {
		this.writeEmitter.fire('\r\n📚 Documentation/test request\r\n');
		const answer = await getProgrammingAnswer(line);
		this.writeEmitter.fire(answer);
	}
	async handleCodeRelatedRequest(line: string) {
		this.writeEmitter.fire('\r\n💡 Code-related request\r\n');
		this.sps = new CodeEnhancer3(super.context, this.writeEmitter);
		const result = await this.sps.handleUserRequest(line);
		this.writeEmitter.fire(result);
	}
	async handleCommandExecutionRequest(line: string) {
		this.writeEmitter.fire('\r\n🖥️ Command execution\r\n');
		this.sps = new CodeEnhancer(super.context, this.writeEmitter);
		const result = await this.sps.handleUserRequest(line);
		this.writeEmitter.fire(result);
	}
	async handleUnknownRequest(line: string) {
		this.stopSpinner();
		this.writeEmitter.fire('\r\n❓ Unknown request\r\n');
		this.writeEmitter.fire('>>> ');
	}
	startSpinner() {
		const s = this._spinner;
		(s as any).handle = setInterval(() => {
			this.writeEmitter.fire(`\r${s.frames[s.currentFrame++]}`);
			s.currentFrame %= s.frames.length;
		}, s.interval);
	}
	stopSpinner() {
		const s = this._spinner;
		if (s.handle) {
			clearInterval(s.handle);
			s.handle = null;
			this.writeEmitter.fire("\r" + " ".repeat(s.frames.length) + "\r");
		}
	}
	processCtrlC() {
		if (this.working) {
			this.stopSpinner();
			this.writeEmitter.fire('\r\n');
			this.writeEmitter.fire('KeyboardInterrupt\r\n');
			this.working = false;
		} else {
			this.writeEmitter.fire('^C\r\n');
			this.writeEmitter.fire('KeyboardInterrupt\r\n');
			this.writeEmitter.fire('>>> ');
		}
	}
	clear() {
		this.writeEmitter.fire('\x1b[2J\x1b[3J\x1b[;H');	
	}

    async execute() {
		if(this.terminal) {
			this.terminal.show();
			return;
		}
		this.terminal = vscode.window.createTerminal({ name: `Puck Terminal REPL`, pty: this.pty });
		
    }

	async processCommand(command: string) {
		// call the executeCommand call
		const result = await vscode.commands.executeCommand(command);
		if (result) {
			this.terminal?.sendText(result.toString());
		}
	}
}
