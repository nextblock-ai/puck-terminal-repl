import * as vscode from 'vscode';
import { sendQuery } from "../utils/gpt";
import { TextDecoder } from 'util';
import { log } from '../utils/outputLog';

export default async function getDependencies(file: string): Promise<string[]> {
	// the user request is a file path. We need to load the file and add it to the input buffer
	const fileContents = await vscode.workspace.fs.readFile(vscode.Uri.file(file));
	const dependencies = [];
	const result = await sendQuery({
		model: 'gpt-4',
		temperature: 0.7,
		max_tokens: 1024,
		top_p: 1,
		messages: [{
			role: 'system',
			content: `You are a source code dependency file list generator. Given source code and the path to the project it came from, you return the paths of the file's dependencies as a json array. Do not include third-party libraries in your result. If you cannot determine the file's dependencies or if it has none, then output an empty array.`
		},{
			role: 'user',
			content: `project path: ${file}\n\nsource code:\n${new TextDecoder().decode(fileContents)}`
		}]
	});
	try {
		const deps = JSON.parse(result).dependencies;
		for(const dep of deps ) {
		// load the file and add it to the input buffer
		const depContents = await vscode.workspace.fs.readFile(vscode.Uri.file(dep));
		dependencies.push(new TextDecoder().decode(depContents));
		}
		dependencies.push(...deps);
	} catch (err: any) {
		log(err);
		return [];
	}
	return dependencies;
}