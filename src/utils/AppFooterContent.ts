import * as vscode from 'vscode';
import { FooterContentManager, IStatusBarItem } from './FooterContentManager';

export default class AppFooterContent {

    static instance: AppFooterContent;

    fileProcessingItem?: IStatusBarItem;

    private iconReady = '$(check)';
    private iconActive = '$(sync~spin)';
    private fileProcessing = 'File Processing';
    private status = 'ready';

    private constructor() {
        AppFooterContent.instance = this;
    }

    public static getInstance(): AppFooterContent {
        if (!AppFooterContent.instance) {
            AppFooterContent.instance = new AppFooterContent();
        }
        return AppFooterContent.instance;
    }

    public static activate(): void {
        const instance = AppFooterContent.getInstance();
        instance.fileProcessingItem = {
            id: 'file-processor',
            alignment: vscode.StatusBarAlignment.Left,
            position: 1000,
            text: 'Ready',
            tooltip: 'Ready',
            command: 'extension.openSettings'
        };
        FooterContentManager.getInstance().addStatusBarItem(instance.fileProcessingItem);
        
        FooterContentManager.getInstance().addStatusBarItem({
            id: 'terminal-repl',
            alignment: vscode.StatusBarAlignment.Right,
            position: 1000,
            text: '$(terminal)',
            tooltip: 'Terminal REPL',
            command: 'puck.terminalRepl.createTerminal'
        });
    }

    // set the status bar text for fileProcessingItem
    public setStatus(status: 'ready' | 'active'): void {
        this.status = status;
        if(!this.fileProcessingItem) {
            throw new Error('fileProcessingItem not initialized');
        }
        if (this.status === 'active') {
            this.fileProcessingItem.text = `${this.iconActive} ${this.fileProcessing}`;
            this.fileProcessingItem.tooltip = 'Processing';
            this.fileProcessingItem.command = undefined;
        } else {
            this.fileProcessingItem.text = `${this.iconReady} Ready`;
            this.fileProcessingItem.tooltip = 'Ready';
            this.fileProcessingItem.command = 'extension.openSettings';
        }
    }

    // set the status bar text
    public setText(text: string): void {
        this.fileProcessing = text;
    }
}
