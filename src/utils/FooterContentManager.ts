import * as vscode from 'vscode';

export interface IStatusBarItem {
    id: string;
    item?: vscode.StatusBarItem;
    alignment: vscode.StatusBarAlignment;
    position: number;
    icons?: string[]; // array of icon names. first is the default icon
    text?: string;
    tooltip?: string;
    command?: string; // command to run when clicked. this is the easy way to call VS code commands
}

/**
 * Manages the footer content for the extension
 *  - status bar items
 *  - status bar text
 *  - status bar icons
 *  - status bar tooltips
 *  - status bar click handlers
 *  - status bar alignment
 *  - status bar position
 */
export class FooterContentManager {
    private static instance: FooterContentManager;
    protected statusBarItems: IStatusBarItem[] = [];
    private constructor() {
        FooterContentManager.instance = this;
        this.initialize();
    }
    private initialize() {
        vscode.workspace.onDidChangeConfiguration((event: vscode.ConfigurationChangeEvent) => {
            this.statusBarItems = this.statusBarItems.map((item:IStatusBarItem)=> {
                item = this._addItem(item);
                return item;
            });
        });
    }
    public static getInstance(): FooterContentManager {
        if (!FooterContentManager.instance) {
            FooterContentManager.instance = new FooterContentManager();
        }
        return FooterContentManager.instance;
    }
	private _addItem(item: IStatusBarItem) {
		const statusBarItem = vscode.window.createStatusBarItem(
			item.alignment, 
			item.position
		);
		statusBarItem.text = item.text || '';
		statusBarItem.tooltip = item.tooltip || '';
		statusBarItem.command = item.command;
		statusBarItem.show();
        item.item = statusBarItem;
		return item;
	}
    public addStatusBarItem(item: IStatusBarItem) {
        const existingItem: any = this.statusBarItems.find(i => i.id === item.id);
        if (existingItem) {
            this.removeStatusBarItem(existingItem);
            existingItem.item.dispose();
        }
        item = this._addItem(item);
        this.statusBarItems.push(item);
    }
    public removeStatusBarItem(id: IStatusBarItem) {
        const item = this.statusBarItems.find(i => i.id === id.id);
        if(item) {
            item.item && item.item.dispose();
            this.statusBarItems = this.statusBarItems.filter(i => i !== id);
        }
    }
}