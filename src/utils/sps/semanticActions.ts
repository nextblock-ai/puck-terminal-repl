import executeShellCommands from "../BashExecutor";
import * as vscode from 'vscode';
import { log } from "../outputLog";
import { applyPatch } from "diff";
import * as path from 'path';

export const codeEnhancer3 = (sps: any, changesObj: any) => ({
	CodeEnhancerMessage: async function (delimiters: any, titles: any) {
		const message = {
			role: delimiters.toJSON(), content: titles.sourceString.trim(),
		};
		return message;
	},
	Title: function (title: any) { return title.sourceString; },
	Delimiters: function (delimiters: any) { return delimiters.sourceString; },
	Finish: function (_: any) { return '🏁'; },
	Error: function (_: any) { return '⛔'; },
	TargetFile: function (_: any) { return '💽'; },
	Dependency: function (_: any) { return '🧩'; },
	Diff: function (_: any) { return '💠'; },
	FileRequest: function (_: any) { return '📤'; },
	BashCommand: function (_: any) { return '🖥️'; },
	VSCodeCommand: function (_: any) { return '🆚'; },
	Announce: function (_: any) { return '📢'; },
	_iter: async (...children: any[]) => {
		const recs = children.map(function (child) { return child.toJSON(); });
		// get all the commands
		const commands: string[] = [];
		const message = children[0].source.sourceString.split('\n');
		for (const msg of message) {
			if (msg.trim().length === 0) { continue; }
			commands.push(msg);
		}
		for (const msg of commands) {
			if (msg.trim().length === 0) { continue; }

			// if we see a finish flag we are done!
			if (msg.startsWith('🏁')) {
				sps.clearInputBuffer();
				sps.interrupt();
				changesObj.processFinish(msg);
				return;
			}

			// we process the request for a file - we return the file contents to the AI
			else if (msg.startsWith('📤')) {
				// get the file contents and the file path
				const file = await changesObj.processFileRequest(msg);
				// add the command and response to the input buffer
				sps.addMessageToInputBuffer({ role: 'assistant', content: msg });
				sps.addMessageToInputBuffer({ role: 'user', content: file.contents });
				return;
			}

			// if the message starts with a 💽' or a '🧩' then we have file content to save
			else if (msg.startsWith('💽') || msg.startsWith('🧩')) {
				const fileContents = commands.slice(1, commands.length - 1).join('\n');
				const change = await changesObj.processFileUpdate(msg, fileContents);
				let filePath = msg.split('💽')[1].trim();
				if (msg.startsWith('🧩')) { filePath = msg.split('🧩')[1].trim(); }

				// add the command and response to the input buffer
				sps.addMessageToInputBuffer({ role: 'assistant', content: msg });
				sps.addMessageToInputBuffer(change);
				return;
			}

			// if the message starts with a 💠 then we have a diff patch we need to apply
			else if (msg.startsWith('💠')) {
				// process the diff and get the file path
				const change = await changesObj.processDiffRequest(msg);
				const filePath = msg.split('💠')[1].trim();
				sps.addMessageToInputBuffer({ role: 'assistant', content: msg });
				sps.addMessageToInputBuffer({ role: 'user', content: `file patched: ${filePath}` });
				return;
			}

			// if the message starts with a 🖥️ then we have a bash command to run
			else if (msg.startsWith('🖥️')) {
				const response = await changesObj.processBashCommand(msg);
				sps.addMessageToInputBuffer({ role: 'assistant', content: msg });
				sps.addMessageToInputBuffer({ role: 'user', content: response });
				continue;
			}

			// if the message starts with a 🆚 then we have a bash command
			else if (msg.startsWith('🆚')) {
				const response = await changesObj.processVSCodeCommand(msg);
				sps.addMessageToInputBuffer({ role: 'assistant', content: msg });
				sps.addMessageToInputBuffer({ role: 'user', content: response });
				continue;
			}

			// if the command starts with a 📢 then we need to output a message
			else if (msg.startsWith('📢')) {
				sps.addMessageToInputBuffer({ role: 'assistant', content: msg });
				return;
			}

			const delimiters = ['🏁', '📤', '💽', '🧩', '💠', '📤', '🖥️', '🆚', '📢'];
			// if the message doesn't start with any of the delimiters them we return an error
			if (!delimiters.some((delimiter) => msg.startsWith(delimiter))) {
				changesObj.outputln('ERROR: Unrecognized command. NO CONVERSATIONAL OUTPUT. Please review instructions and try again.');
				sps.addMessageToInputBuffer({
					role: 'system',
					content: 'ERROR: Unrecognized command. NO CONVERSATIONAL OUTPUT. Please review instructions and try again.'
				});
				break;
			}
			log(msg);
		}
		return;
	}
});

export const codeEnhancer2 = (sps: any, changesObj: any) => ({
	CodeEnhancerMessage: async function (delimiters: any, titles: any) {
		const message = {
			role: delimiters.toJSON(), content: titles.sourceString.trim(),
		};
		return message;
	},
	Title: function (title: any) { return title.sourceString; },
	Delimiters: function (delimiters: any) { return delimiters.sourceString; },
	Finish: function (_: any) { return '🏁'; },
	Error: function (_: any) { return '⛔'; },
	TargetFile: function (_: any) { return '💽'; },
	Dependency: function (_: any) { return '🧩'; },
	Diff: function (_: any) { return '💠'; },
	FileRequest: function (_: any) { return '📤'; },
	Announce: function (_: any) { return '📢'; },
	_iter: async (...children: any[]) => {
		const recs = children.map(function (child) { return child.toJSON(); });
		// get all the commands
		const commands: string[] = [];
		const message = children[0].source.sourceString.split('\n');
		for (const msg of message) {
			if (msg.trim().length === 0) { continue; }
			commands.push(msg);
		}
		for (const msg of commands) {
			if (msg.trim().length === 0) { continue; }

			// if we see a finish flag we are done!
			if (msg.startsWith('🏁')) {
				sps.clearInputBuffer();
				sps.interrupt();
				return sps.changes;
			}

			// we process the request for a file - we return the file contents to the AI
			else if (msg.startsWith('📤')) {
				const file = await changesObj.processFileRequest(msg);
				const filePath = msg.split('📤')[1].trim();
				sps.addMessageToInputBuffer({ role: 'assistant', content: msg });
				sps.addMessageToInputBuffer({ role: 'user', content: `${filePath}:\n${file}` });
			}

			// if the message starts with a 💽' or a '🧩' then we have the primary file
			else if (msg.startsWith('💽') || msg.startsWith('🧩')) {
				const change = await changesObj.processFileUpdate(msg);
				sps.changes.push(change);
			}

			// if the message starts with a 💠 then we have a diff
			else if (msg.startsWith('💠')) {
				const change = await changesObj.processDiffRequest(msg);
				sps.changes.push(change);
			}

			// if the command starts with a 📢 then we need to output a message
			else if (msg.startsWith('📢')) {
				sps.addMessageToInputBuffer({ role: 'assistant', content: msg });
			}

			const delimiters = ['🧩', '💽', '💠', '📤', '📢'];
			// if the message doesn't start with any of the delimiters them we return an error
			if (!delimiters.some((delimiter) => msg.startsWith(delimiter))) {
				sps.addMessageToInputBuffer({
					role: 'system',
					content: 'ERROR: Unrecognized command. NO CONVERSATIONAL OUTPUT. Please review instructions and try again.'
				});
				break;
			}
			log(msg);
		}
		return sps.changes;
	}
});

export const codeEnhancer = (sps: any, changesObj: any) => ({
	CodeEnhancerMessage: async function (delimiters: any, titles: any) {
		const message = {
			role: delimiters.toJSON(), content: titles.sourceString.trim(),
		};
		return message;
	},
	Title: function (title: any) { return title.sourceString; },
	Delimiters: function (delimiters: any) { return delimiters.sourceString; },
	Finish: function (_: any) { return '🏁'; },
	Error: function (_: any) { return '⛔'; },
	Warning: function (_: any) { return '⚠️'; },
	BashCommand: function (_: any) { return '🖥️'; },
	VSCommand: function (_: any) { return '🆚'; },
	Message: function (_: any) { return '💬'; },
	OpenTask: function (_: any) { return '📬'; },
	CompleteTask: function (_: any) { return '📭'; },
	_iter: async (...children: any[]) => {
		const recs = children.map(function (child) { return child.toJSON(); });
		// get all the commands
		const delimiters = ['🖥️', '🆚', '💬', '📬', '📭', '🏁', '⚠️', '⛔'];
		function parseCommands(text: string, legalEmojis: string[]) {
			const lines = text.split('\n');
			const cmds: any = [];
			let emojiFound: string | undefined = '';
			lines.forEach(line => {
				const eFound = legalEmojis.find(emoji => line.startsWith(emoji));
				if (eFound) {
					emojiFound = eFound;
					const value = line.replace(eFound, '').trim();
					cmds.push({ command: emojiFound, message: [ value ] });
				} else {
					const latestCmd = cmds[cmds.length - 1];
					latestCmd.message.push(line);
				}
			});
			return cmds;
		}
		const messageSource = children[0].source.sourceString;
		const messageCommands = parseCommands(messageSource, delimiters);

		const openTasks = messageCommands.filter((cmd: any) => cmd.command === '📬');
		const completeTasks = messageCommands.filter((cmd: any) => cmd.command === '📭');

		// if we have completed tasks then we need to remove them from the list
		if (completeTasks.length > 0) {
			if (sps.taskListHeight !== 0) {
				changesObj.truncateInputBuffer();
			}
			for (const task of completeTasks) {
				sps.taskListHeight = sps.taskListHeight + 1;
				changesObj.removeOpenTaskFromTaskList(task.title);
				sps.addMessageToInputBuffer({ role: 'assistant', content: `📭 ${task.message}` });
			}
		}

		// if we have open tasks then we need to add them to the list
		if (openTasks.length > 0) {
			if (sps.taskListHeight === 0) {
				sps.taskListHeight = sps.taskListHeight + 1;
			}
			for (const task of openTasks) {
				// check to see if the task is already in the list
				if (sps.openTasks.length > 0 && sps.openTasks.some((t: any) => t.title === task.message)) { continue; }
				changesObj.addOpenTaskToTaskList(task.message);
				sps.addMessageToInputBuffer({ role: 'assistant', content: `📬 ${task.message}` });
			}
		}

		// now we need to filter out the open and closed tasks from the message commands
		const filteredMessageCommands = messageCommands.filter((cmd: any) => !['📬', '📭', '🏁'].includes(cmd.command));

		for (const _cmd of filteredMessageCommands) {

			const cmd = _cmd.command;
			const msg = _cmd.message.join('\n');

			if (msg.trim().length === 0) { continue; }

			// if the command starts with a 🖥️' then we need to run the command
			if (cmd.startsWith('🖥️')) {
				sps.addMessageToInputBuffer({ role: 'assistant', content: `${cmd} ${msg}` });
				const result = await executeShellCommands(msg);
				sps.addMessageToInputBuffer({ role: 'user', content: result });
				changesObj.addCommandHistory(msg);
			}

			// if the command starts with a 🆚 then we need to run the command
			else if (cmd.startsWith('🆚')) {
				sps.addMessageToInputBuffer({ role: 'assistant', content: `${cmd} ${msg}` });
				const result = await changesObj.processVSCodeCommand(msg);
				sps.addMessageToInputBuffer({ role: 'user', content: result });
				changesObj.addCommandHistory(msg);
			}

			// if the command starts with a 💬 then we need to output a message
			else if (cmd.startsWith('💬')) {
				sps.addMessageToInputBuffer({ role: 'assistant', content: `${cmd} ${msg}` });
				sps.addMessageToInputBuffer({ role: 'user', content: 'acknowledging: ' + msg });
				changesObj.outputln(`${cmd} ${msg}`);
			}

			// else if the command starts with a ⛔ then we stop
			else if (cmd.startsWith('⛔')) {
				changesObj.outputln(`${cmd} ${msg}`);
				changesObj.error(msg);
			}

			else if (cmd.startsWith('⚠️')) {
				changesObj.outputln(`${cmd} ${msg}`);
				changesObj.warning(msg);
			}

			else {
				sps.addMessageToInputBuffer({
					role: 'system',
					content: 'ERROR: Unrecognized command. NO CONVERSATIONAL OUTPUT. Please review instructions and try again.'
				});
			}
		}

		// look for a finish command
		const finish = messageCommands.filter((cmd: any) => cmd.command === '🏁');
		if (finish.length > 0) {
			if (sps.openTasks.length === 0) {
				changesObj.clearInputBuffer();
				sps.interrupt();
				return;
			} else {
				completeTasks.push({
					command: '📭',
					message: sps.openTasks[0]
				});
				// remove the task from the list
				changesObj.removeOpenTaskFromTaskList(sps.openTasks[0]);
			}
		}
		// the current task is the first task in the list
		if (sps.openTasks.length > 0) {
			changesObj.sendOpenTasksStatus();
		}

		return recs;
	}
});


export const codeEnhancer4 = (sps: any, changesObj: any) => ({
	CodeEnhancerMessage: async function (delimiters: any, titles: any) {
		const message = {
			role: delimiters.toJSON(), content: titles.sourceString.trim(),
		};
		return message;
	},
	Title: function (title: any) { return title.sourceString; },
	Delimiters: function (delimiters: any) { return delimiters.sourceString; },
	Error: function (_: any) { return '⛔'; },
	TargetFile: function (_: any) { return '💽'; },
	Finish: function (_: any) { return '🏁'; },
	Diff: function (_: any) { return '💠'; },
	FileRequest: function (_: any) { return '📤'; },
	BashCommand: function (_: any) { return '🖥️'; },
	VSCodeCommand: function (_: any) { return '🆚'; },
	Announce: function (_: any) { return '📢'; },
	OpenTask: function (_: any) { return '📬'; },
	CompleteTask: function (_: any) { return '📭'; },
	_iter: async (...children: any[]) => {


		const recs = children.map(function (child) { return child.toJSON(); });
		// get all the commands
		const delimiters = ['⛔', '💽', '🏁', '💠', '📤', '🖥️', '🆚', '📢', '📬', '📭'];
		function parseCommands(text: string, legalEmojis: string[]) {
			const lines = text.split('\n');
			const cmds: any = [];
			let emojiFound: string | undefined = '';
			lines.forEach(line => {
				const eFound = legalEmojis.find(emoji => line.startsWith(emoji));
				if (eFound) {
					emojiFound = eFound;
					const value = line.replace(eFound, '').trim();
					cmds.push({ command: emojiFound, message: [ value ] });
				} else {
					const latestCmd = cmds[cmds.length - 1];
					latestCmd.message.push(line);
				}
			});
			return cmds;
		}
		const messageSource = children[0].source.sourceString;
		const messageCommands = parseCommands(messageSource, delimiters);
		const openTasks = messageCommands.filter((cmd: any) => cmd.command === '📬');
		const completeTasks = messageCommands.filter((cmd: any) => cmd.command === '📭');
		const messageDiffs = messageCommands.filter((cmd: any) => cmd.command === '💠');
		const fileUpdates = messageCommands.filter((cmd: any) => cmd.command === '💽');

		// if we have completed tasks then we need to remove them from the list
		if (completeTasks.length > 0) {
			if (changesObj.taskListHeight() !== 0) {
				changesObj.truncateInputBuffer();
			}
			for (const task of completeTasks) {
				changesObj.setTaskListHeight(changesObj.taskListHeight() + 1);
				changesObj.removeOpenTaskFromTaskList(task.title);
				sps.addMessageToInputBuffer({ role: 'assistant', content: `📭 ${task.message}` });
			}
		}

		// if we have open tasks then we need to add them to the list
		if (openTasks.length > 0) {
			if (changesObj.taskListHeight() === 0) {
				changesObj.setTaskListHeight(
					changesObj.inputBuffer().length + 1
				);
			}
			for (const task of openTasks) {
				// check to see if the task is already in the list
				if (changesObj.openTasks.length > 0 && changesObj.openTasks.some((t: any) => t.title === task.message)) { continue; }
				changesObj.addOpenTaskToTaskList(task.message);
				sps.addMessageToInputBuffer({ role: 'assistant', content: `📬 ${task.message}` });
			}
		}
		
		// apply the diffs to the target file
		if(messageDiffs.length > 0) {
			for (const diff of messageDiffs) {
				// the first line after the diff emoji is the file path
				// the rest is the diff
				const lines = diff.message.join('\n').split('\n');
				const filePath = lines[0];
				const diffText = lines.slice(1).join('\n');
				// get the file from the file system
				const file = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath));
				const fileText = Buffer.from(file).toString('utf8');
				const patchedFileText = applyPatch(fileText, diffText);
				await vscode.workspace.fs.writeFile(vscode.Uri.file(filePath), Buffer.from(patchedFileText));
				sps.addMessageToInputBuffer({ role: 'assistant', content: `💠 APPLIED ${filePath}` });
				changesObj.outputln(`💠 APPLIED ${filePath}`);
			}
		}

		if(fileUpdates.length > 0) {
			for (const fileUpdate of fileUpdates) {
				// the first line after the file emoji is the file path
				// the rest is the file to write
				const lines = fileUpdate.message.join('\n').split('\n');
				const filePath = lines[0];
				const fileText = lines.slice(1).join('\n');
				await vscode.workspace.fs.writeFile(vscode.Uri.file(filePath), Buffer.from(fileText));
				sps.addMessageToInputBuffer({ role: 'assistant', content: `💽 SAVED ${filePath}` });
				changesObj.outputln(`💽 SAVED ${filePath}`);
			}
		}

		// now we need to filter out the open and closed tasks from the message commands
		const filteredMessageCommands = messageCommands.filter((cmd: any) => !['📬', '📭', '🏁'].includes(cmd.command));

		for (const _cmd of filteredMessageCommands) {

			const cmd = _cmd.command;
			const msg = _cmd.message.join('\n');

			if (msg.trim().length === 0) { continue; }

			// if the command starts with a 🖥️' then we need to run the command
			if (cmd.startsWith('🖥️')) {
				sps.addMessageToInputBuffer({ role: 'assistant', content: `${cmd} ${msg}` });
				const result = await executeShellCommands(msg);
				sps.addMessageToInputBuffer({ role: 'user', content: result });
				changesObj.addCommandHistory(msg);
			}

			// if the command starts with a 🆚 then we need to run the command
			else if (cmd.startsWith('🆚')) {
				sps.addMessageToInputBuffer({ role: 'assistant', content: `${cmd} ${msg}` });
				const result = await changesObj.processVSCodeCommand(msg);
				sps.addMessageToInputBuffer({ role: 'user', content: result });
				changesObj.addCommandHistory(msg);
			}

			// if the command starts with a 📢 then we need to output a message
			else if (cmd.startsWith('📢')) {
				sps.addMessageToInputBuffer({ role: 'assistant', content: `${cmd} ${msg}` });
				changesObj.outputln(`${cmd} ${msg}`);
			}

			// if the command starts with a 📤 then we need to output a file
			else if (cmd.startsWith('📤')) {
				const filePath = msg.split('\n')[0];
				// get the rest of the lines from msg
				if(msg.length > 1) { // we treat anything after the first line as info from the ai
					const restOfLines = msg.split('\n').slice(1).join('\n').trim();
					if(restOfLines.length > 0) {
						sps.addMessageToInputBuffer({ role: 'user', content: `📚 ${restOfLines}` });
						return;
					}
				}
				const projectFolder = sps.projectFolder;
				const fullPath = path.join(projectFolder, filePath);
				let fileStr = '';
				sps.addMessageToInputBuffer({ role: 'assistant', content: `${cmd} ${msg}` });
				changesObj.outputln(`${cmd} ${msg}`);
				try {
					const file = await vscode.workspace.fs.readFile(vscode.Uri.file(fullPath));
					fileStr = Buffer.from(file).toString('utf8');
					const fileArr = fileStr.split('\n');
					if(fileArr.length > 50) {
						// remove anything after the 100th line
						fileStr = fileArr.slice(0, 50).join('\n');
						fileStr += '\n... truncated to save buffer space. Use awk to view portions of the file, or use tasks and tempfiles to break up your work so you dont crash.';
					}
					fileStr = fileStr.split('\n').join('\r\n');
					sps.addMessageToInputBuffer({ role: 'user', content: `💼 ${filePath}\n${fileStr}\n` });
					changesObj.outputln(`💼 ${filePath}\r\n${fileStr}\r\n`);
				} catch (e) {
					sps.addMessageToInputBuffer({ role: 'user', content: `💼 ${filePath} NOT FOUND\r\n` });
					changesObj.outputln(`💼 ${filePath} NOT FOUND\r\n`);
				}
			}

			// else if the command starts with a ⛔ then we stop
			else if (cmd.startsWith('⛔')) {
				changesObj.outputln(`${cmd} ${msg}`);
				changesObj.error(msg);
			}

			else {
				// first 100 chars of the message
				const origMsg = messageSource.substring(0, 100) + '...';
				sps.addMessageToInputBuffer({
					role: 'assistant',
					content: origMsg
				});
				sps.addMessageToInputBuffer({
					role: 'system',
					content: 'ERROR: Unrecognized command. NO CONVERSATIONAL OUTPUT. Please review instructions and try again.'
				});
			}
		}

		// look for a finish command
		const finish = messageCommands.filter((cmd: any) => cmd.command === '🏁');
		if (finish.length > 0) {
			if (sps.openTasks.length === 0) {
				changesObj.clearInputBuffer();
				sps.interrupt();
				return;
			} else {
				completeTasks.push({
					command: '📭',
					message: changesObj.openTasks[0]
				});
				// remove the task from the list
				changesObj.removeOpenTaskFromTaskList(changesObj.openTasks[0]);
			}
		}
		// the current task is the first task in the list
		if (changesObj.openTasks().length > 0) {
			changesObj.sendOpenTasksStatus();
		}

		return recs;
	}
});

