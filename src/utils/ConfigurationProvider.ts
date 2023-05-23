import * as vscode from 'vscode';

export class ConfigurationProvider {
    protected config = vscode.workspace.getConfiguration();

    private readonly onConfigChanged: vscode.EventEmitter<vscode.ConfigurationChangeEvent> = new vscode.EventEmitter<vscode.ConfigurationChangeEvent>();
    public readonly onConfigurationChanged: vscode.Event<vscode.ConfigurationChangeEvent> = this.onConfigChanged.event;

    constructor() {
        this.initialize();
    }

    private initialize() {
        vscode.workspace.onDidChangeConfiguration((event: vscode.ConfigurationChangeEvent) => {
            this.config = vscode.workspace.getConfiguration();
            this.onConfigChanged.fire(event);
        });
    }

    getValue<T>(section: string): T | undefined {
        return this.config.get<T>(section);
    }

    updateValue<T>(section: string, value: T, target: vscode.ConfigurationTarget) {
        this.config.update(section, value, target);
    }

    has(section: string): boolean {
        return this.config.has(section);
    }

    getSection(section: string): vscode.WorkspaceConfiguration {
        return this.config.getConfiguration(section);
    }

    onDidChangeConfiguration(listener: (event: vscode.ConfigurationChangeEvent) => void): vscode.Disposable {
        return this.onConfigurationChanged(listener);
    }
}