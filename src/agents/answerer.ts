import * as vscode from 'vscode';
import { sendQuery } from "../utils/gpt";
import { TextDecoder } from 'util';
import { log } from '../utils/outputLog';

export async function getProgrammingAnswer(file: string): Promise<any> {
	try {
		return sendQuery({
			model: 'gpt-4',
			temperature: 0.7,
			max_tokens: 1024,
			top_p: 1,
			messages: [{
				role: 'system',
				content: `You are an expert answerer of programming questions of all kinds. Given a programming question, you give a detailed, informative answers complete with code usage examples.`
			},{
				role: 'user',
				content: new TextDecoder().decode(
					await vscode.workspace.fs.readFile(vscode.Uri.file(file))
				)
			}]
		});
	} catch (err: any) {
		log(err);
	}
}