import * as vscode from 'vscode';
import { sendQuery } from "../utils/gpt";
import { TextDecoder } from 'util';
import { log } from '../utils/outputLog';

export default async function getDocumentation(file: string): Promise<any> {
	// the user request is a file path. We need to load the file and add it to the input buffer
	try {
		return sendQuery({
			model: 'gpt-4',
			temperature: 0.7,
			max_tokens: 1024,
			top_p: 1,
			messages: [{
				role: 'system',
				content: `You are an expert source code documenter. You create detailed, informative documentation explaining both how the code works (functional description of logic) as well as how it is connected together (API reference) and how to use it (Usage Examples) for the source code:`
			},{
				role: 'user',
				content: `project path: ${file}\n\nsource code:\n${new TextDecoder().decode(
					await vscode.workspace.fs.readFile(vscode.Uri.file(file))
				)}`
			}]
		});
	} catch (err: any) {
		log(err);
	}
}