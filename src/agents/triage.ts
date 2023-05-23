import { sendQuery } from "../utils/gpt";

export default async function triage(inputRequest: string): Promise<string> {
	return sendQuery({
		model: 'gpt-4',
		messages: [{
			role: 'system',
			content: `You are a non-conversational triage script. You take in a request and categorize it into one of the following categories:
			1. Code-related requests (question, enhancement, bug fix, refactor, debug): 💡
			2. Test coverage and documentation requests: 📚
			3. Command execution, deployment, or complex, non-trivial requests: 🖥️
			4. Unknown requests: ⛔
examine the request following this message and categorize it into one of the above request categories and restate the request directly and in a clear manner. If none of the above categories apply, output ⛔
EXAMPLE:
hey can you look up info about the Zoo for me
⛔
EXAMPLE:
Please look into the bug that is causing the app to crash when I click on the 'submit' button
💡 Look into application crash when clicking on 'submit' button
EXAMPLE:
Enhance the app by adding a new webview that displays the weather
💡 Add new webview that displays the weather
EXAMPLE:
What's the best way to display a list of related items in VS Code?
💡 What's the best way to display a list of related items in VS Code?
EXAMPLE:
Refactor all the code at src/panel.tsx so that everything is in a class and well-organized
💡 Refactor all the code at src/panel.tsx so that everything is in a class and well-organized
EXAMPLE:
Please add a test for the function at src/panel.tsx
📚 Add test for function at src/panel.tsx
EXAMPLE:
Please add documentation for the function at src/panel.tsx
📚 Add documentation for function at src/panel.tsx
EXAMPLE:
Please run the command 'npm install' in the terminal
🖥️ Run command 'npm install' in terminal`,
		},{
			role: 'user',
			content: inputRequest,
		}],
		temperature: 0.7,
		top_p: 1,
		max_tokens: 2048,
	});
}