/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-case-declarations */
/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from "vscode";
import { Command } from "../utils/Command";

export default class SetOpenAIKeyCommand extends Command {
    constructor(commandId: string, title: string, context: vscode.ExtensionContext) {
        super(commandId, title, context);
    }

    async execute() {
        const apiKey = await vscode.window.showInputBox({
            prompt: 'Enter your OpenAI API key',
            ignoreFocusOut: true,
            password: true,
        });
        if (apiKey) {
            setOpenAIKey(apiKey);
            vscode.window.showInformationMessage('OpenAI API key saved successfully');
        } else {
            vscode.window.showErrorMessage('Invalid API key. Please try again');
        }
    }
    
    async setOpenAIKey(openAIKey: string): Promise<void> {
        try {
            await vscode.workspace.getConfiguration('puck').update('apikey', openAIKey, vscode.ConfigurationTarget.Global);
            const config = vscode.workspace.getConfiguration('puck');
            if (config.has('apikey')) {
                vscode.window.showInformationMessage('OpenAI API key saved successfully');
            } else {
                vscode.window.showErrorMessage('Failed to save OpenAI API key');
            }
        } catch (error: any) {
            vscode.window.showErrorMessage(`Error updating configuration: ${error.message}`);
        }
    }
}

export function getOpenAIKey(): string {
    const config = vscode.workspace.getConfiguration('puck');
    return config.get('apikey') || '';
}

async function setOpenAIKey(openAIKey: string): Promise<void> {
    try {
        await vscode.workspace.getConfiguration('puck').update('apikey', openAIKey, vscode.ConfigurationTarget.Global);
        const config = vscode.workspace.getConfiguration('puck');
        if (config.has('apikey')) {
            vscode.window.showInformationMessage('OpenAI API key saved successfully');
        } else {
            vscode.window.showErrorMessage('Failed to save OpenAI API key');
        }
    } catch (error: any) {
        vscode.window.showErrorMessage(`Error updating configuration: ${error.message}`);
    }
}