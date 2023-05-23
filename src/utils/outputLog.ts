/* eslint-disable @typescript-eslint/no-unused-vars */
import * as vscode from 'vscode';

// This method is called when your extension is activated
export function activate(_context: vscode.ExtensionContext) {
    log('Puck Terminal REPL extension activated.');
}

export function deactivate() {
    // nothing to do
}

// log a message to the output channel
let outputChannel: vscode.OutputChannel;

export function log(message: string, showChannel = false) {
    if(!outputChannel) { outputChannel = vscode.window.createOutputChannel('Puck Terminal REPL'); }
    outputChannel.appendLine(message);
    if(showChannel) { outputChannel.show(); }
}