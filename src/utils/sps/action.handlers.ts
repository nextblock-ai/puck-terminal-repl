import * as vscode from 'vscode';
import * as path from 'path';
import { TextDecoder, TextEncoder } from 'util';
import * as diff from 'diff';
import { execSync } from 'child_process';
import { log } from '../outputLog';

export function getActionHandlers(sps: any) {
	return {
		processFileRequest: async (msg: string): Promise<any> => {
			sps.writeEmitter.fire(msg+'\r\n');
			const file = msg.replace('📤', '').trim();
			const filepath = path.join(sps.projectFolder || '', file);
			const fileContents = await vscode.workspace.fs.readFile(vscode.Uri.file(filepath));
			let fileContentsStr = new TextDecoder().decode(fileContents);
			fileContentsStr = fileContentsStr.split('\n').join('\r\n');
			sps.writeEmitter.fire(fileContentsStr+'\r\n');
			return { file: filepath, contents: fileContentsStr };
		},
		processFileUpdate: async (msg: string, content: string): Promise<any> => {
            sps.writeEmitter.fire(msg+'\r\n');
            let file = msg.replace('💽', '').trim();
            file = file.replace('🧩', '').trim();
            const filepath = path.join(sps.projectFolder || '', file);
            await vscode.workspace.fs.writeFile(vscode.Uri.file(filepath), 
                new TextEncoder().encode(content));
            return { file: file, contents: `updated ${file}` };
        },
		processDiffRequest: async (msg: string): Promise<any> => {
            sps.writeEmitter.fire(msg+'\r\n');
            const file = msg.replace('💠', '').trim();
            const filepath = path.join(sps.projectFolder || '', file);
            const fileContents = await vscode.workspace.fs.readFile(vscode.Uri.file(filepath));
            const fileContentsStr = new TextDecoder().decode(fileContents);
            // use the diff npm lib to apply the patch
            let patchedContents = fileContentsStr;
            const parsedDiff = diff.parsePatch(fileContentsStr);
            for(const d of parsedDiff) {
                patchedContents = diff.applyPatch(fileContentsStr, d);
            }
            sps.writeEmitter.fire(patchedContents+'\r\n');
            await vscode.workspace.fs.writeFile(vscode.Uri.file(filepath),
                new TextEncoder().encode(patchedContents));
            return { file: file, contents: patchedContents };
        },
		processBashCommand: async (msg: string): Promise<string> => {
            sps.writeEmitter.fire(msg+'\r\n');
            const command = msg.replace('🖥️', '').trim();
            if(command.startsWith('cd ')) {
                const dir = command.replace('cd ', '').trim();
                sps.projectFolder = dir;
                process.chdir(dir);
                sps.writeEmitter.fire('changed directory to '+dir+'\r\n');
                return 'changed directory to '+dir;
            }
            const result = execSync(command);
            const msgStr = result.toString().replace(/\n/g, '\r\n');
            if(msgStr) {
                sps.writeEmitter.fire(msgStr+'\r\n');
                return msgStr;
            }
            sps.writeEmitter.fire('command completed successfully'+'\r\n');
            return 'command completed successfully';
        },
		processVSCodeCommand: async (msg: string): Promise<any> => {
            sps.writeEmitter.fire(msg+'\r\n');
            const command = msg.replace('🆚', '').trim();
            const result = await vscode.commands.executeCommand(command);
            sps.writeEmitter.fire(result+'\r\n');
            return result;
        },
        processNotification: async (msg: string): Promise<any> => {
            sps.writeEmitter.fire(msg+'\r\n');
            const notification = msg.replace('📢', '').trim();
            log(notification);
            return notification;
        },
        processFinish: async (msg: string): Promise<any> => {
            sps.writeEmitter.fire(msg+'\r\n');
            sps.triggered = false;
            return msg;
        },
		addOpenTaskToTaskList: (msg: string) => {
			const taskName = msg.replace('📬', '').trim();
			if(sps.openTasks.includes(taskName)) {
				return msg + ' - already open';
			}
			sps.openTasks.push(taskName);
            sps.writeEmitter.fire(msg+'\r\n');
            log('added task '+taskName);
			return msg;
		},
		removeOpenTaskFromTaskList: (msg: string) => {
			const taskName = msg.replace('📭', '').trim();
			// check to see if the task is already open
			if(!sps.openTasks.includes(taskName)) {
				return msg + ' - complete';
			}
			const firstOpenTask = sps.inputBuffer.findIndex((msg: any) => msg.content.includes(taskName));
			// if there is one then delete everything in the input after and including the open task
			if(firstOpenTask !== -1) {
				sps.inputBuffer.splice(firstOpenTask, sps.inputBuffer.length - firstOpenTask);
			}
			sps.openTasks = sps.openTasks.filter((task: any) => task !== taskName);
            sps.writeEmitter.fire(msg+'\r\n');
			return msg;
		},
        truncateInputBuffer: () => {
            sps.inputBuffer.splice(
                sps.taskListhHeight, 
                sps.inputBuffer.length - sps.taskListhHeight
            );
            return sps.inputBuffer;
        },
        output(msg: string) { sps.writeEmitter.fire(msg); },
        outputln(msg: string) { sps.writeEmitter.fire(msg+'\r\n'); },
        warning(message: string) { sps.writeEmitter.fire(message+'\r\n'); },
        error(message: string) { sps.writeEmitter('❌ ' + message); },
        inputBuffer: () => sps.inputBuffer,
        setInputBuffer: (inputBuffer: any) => {
            sps.inputBuffer = inputBuffer;
            return inputBuffer;
        },
        clearInputBuffer: () => {
            sps.inputBuffer = [];
            return sps.inputBuffer;
        },
		openTasks: () => sps.openTasks,
        taskListHeight: () => sps.taskListHeight,
        setTaskListHeight: (height: number) => {
            sps.taskListHeight = height;
            return height;
        },
        sendOpenTasksStatus: () => {
            const ot = sps.openTasks.map((task: any) => `📬 ${task}`).join('\r\n');
            const curOpenTask = sps.openTasks[0];
            const tasksVal = '\r\nOPEN TASKS:\r\n' + ot 
            + '\r\nCOMMAND HISTORY:\r\n' + sps.commandHistory.join('\r\n')
            + '\r\nCURRENT TASK: 📬 ' + curOpenTask + '\r\n';
            sps.addMessageToInputBuffer({ role: 'user', content: tasksVal });
            sps.writeEmitter.fire(tasksVal+'\r\n');
        },
        addCommandHistory: (msg: string) => {
            sps.commandHistory.push(msg);
            return msg;
        },
		commandHistory: () => sps.commandHistory,
	};
}
