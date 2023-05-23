'use strict';

import * as vscode from 'vscode';
import SetOpenAIKeyCommand from './commands/SetOpenAIKeyCommand';
import PuckREPLCommand from './commands/PuckREPLCommand';
import * as outputLog from './utils/outputLog';
import AppFooterContent from './utils/AppFooterContent';

import { commands } from './constants';
export function activate(context: vscode.ExtensionContext) {
	outputLog.activate(context);
	new SetOpenAIKeyCommand(commands['puck.terminalRepl.setOpenAIKey'].command, commands['puck.terminalRepl.setOpenAIKey'].title, context);
	new PuckREPLCommand(commands['puck.terminalRepl.createTerminal'].command, commands['puck.terminalRepl.createTerminal'].title, context);
	AppFooterContent.activate();
}

