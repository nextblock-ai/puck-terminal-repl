import * as vscode from "vscode";
import { commands } from '../constants';

import SetOpenAIKeyCommand from "./SetOpenAIKeyCommand";
import PuckREPLCommand from "./PuckREPLCommand";

export function activate(context: vscode.ExtensionContext) {

    new SetOpenAIKeyCommand('puck.terminalRepl.setOpenAIKey', 'puck.terminalRepl.setOpenAIKey', context);
	new PuckREPLCommand('puck.terminalRepl.createTerminal', 'puck.terminalRepl.createTerminal', context);
}


export function deactivate() { 
    // noop
}