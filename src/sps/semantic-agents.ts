import * as vscode from "vscode";
import { ModularSemanticPrompt, SemanticResponder, Array } from "./semantic-prompt";
import { SemanticProcessor } from "./semantic-prompt";
import executeShellCommands from "../utils/BashExecutor";
import * as path from "path";
import { applyPatch } from "diff";
import * as os from "os";


async function getFileFromPath(filePath: string): Promise<string> {
  const file = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath));
  return Buffer.from(file).toString('utf8');
}

function getOperatingSystem() {
  const platform = os.platform();
  if (platform === "darwin") {
      return "mac";
  } else if (platform === "linux") { return "linux";
  } else if (platform === "win32") { return "windows";
  } else { return "unknown";
  }
}
function osSpecific(command: any) {
  const os = getOperatingSystem();
  return command[os];
}

const _postResponder: SemanticResponder = {
  name: "CompleteTask",
  "delimiter": "📭",
  scopes: [],
  process: async (context: any, scope: string, obj: any) => {
    //
  }
};

const diffCommandResponder: SemanticResponder = {
  name: "Diff",
  delimiter: "💠",
  scopes: ["init"],
  process: async (context: any, scope: string, obj: any) => {
    const messageCommands = context.messageCommands.filter((cmd: any) => cmd.command === '💠');
    for(let i = 0; i < messageCommands.length; i++) {
      const obj = messageCommands[i];
      const cmd = obj.command;
      const firstLine = obj.message[0];
      const fullPath = path.join(context.projectFolder, firstLine);
      const diffpatch = obj.message.slice(1).join('\n');
      context.addMessageToInputBuffer({ role: 'assistant', content: `${cmd} ${obj.command.join('\n')}` });
      context.writeEmitter.fire(`${cmd} ${firstLine}\r\n${diffpatch.split('\n').join('\r\n')}\r\n`);
      const patchedFileText = applyPatch(fullPath, diffpatch);
      context.writeEmitter.fire(`${cmd} ${firstLine}\r\n${patchedFileText.split('\n').join('\r\n')}\r\n`);
      await vscode.workspace.fs.writeFile(vscode.Uri.file(fullPath), Buffer.from(patchedFileText));
      context.addMessageToInputBuffer({ role: 'assistant', content: `💠 APPLIED ${fullPath}` });
      context.outputln(`💠 APPLIED ${fullPath}`);
    }
  }
};

const fileUpdatesdResponder: SemanticResponder = {
  name: "TargetFile",
  delimiter: "💽",
  scopes: ["init"],
  process: async (context: any, scope: string, obj: any) => {
    const messageCommands = context.messageCommands.filter((cmd: any) => cmd.command === '💽');
    for(let i = 0; i < messageCommands.length; i++) {
      const obj = messageCommands[i];
      const firstLine = obj.message[0];
      const fullPath = path.join(context.projectFolder, firstLine);
      const fileContents = obj.message.slice(1).join('\n');
				await vscode.workspace.fs.writeFile(vscode.Uri.file(fullPath), Buffer.from(fileContents));
				context.addMessageToInputBuffer({ role: 'assistant', content: `💽 SAVED ${fullPath}` });
				context.writeEmitter.fire(`💽 SAVED ${fullPath}\r\n${fileContents.split('\n').join('\r\n')}`);
    }
  }
};

const echoWorkResponder: SemanticResponder = {
  name: "echoWorkResponder",
  scopes: ["init"],
  process: async (context: any, scope: string, obj: any) => {
    const proposedFixes = context.messageCommands.filter((cmd: any) => cmd.command === '📬');
    const cmd = obj.command;
		const msg = obj.message.join('\n');


    const taskListHeightVar = context.variables.find((v: any) => v.name === "taskListHeight");
    const tlh = taskListHeightVar.value || 0;
    if(tlh === 0) {
      // remove the unneeded data in the input buffer
      taskListHeightVar.value = context.inputBuffer.length;
      context.setTaskListHeight(taskListHeightVar.value);
    }

    context.truncateInputBuffer();

    // add the bugs and updates to the list
    for(const fix of proposedFixes) {
      context.addMessageToInputBuffer({ role: 'user', content: `📬 ${fix.message}` });
      context.writeEmitter.fire(`${fix.command} ${fix.message}`);
    }
    return;
  }
};

const errorResponder: SemanticResponder = {
  name: "Error",
  delimiter: "⛔",
  scopes: ["loop"],
  process: async (context: any, scope: string, obj: any) => {
    const cmd = obj.command;
		const msg = obj.message.join('\n');
    context.outputln(`${cmd} ${msg}`);
    context.error(msg);
  }
};

const bashCommandResponder: SemanticResponder = {
  name: "BashCommand",
  delimiter: "🖥️",
  scopes: ["loop"],
  process: async (context: any, scope: string, obj: any) => {
    const cmd = obj.command;
		const msg = obj.message.join('\n');
    context.addMessageToInputBuffer({ role: 'assistant', content: `${cmd} ${msg}` });
    context.writeEmitter.fire(`${cmd} ${msg}\r\n`);
    const result = await executeShellCommands(obj.value);
    context.writeEmitter.fire(`${result}\r\n`);
    context.addMessageToInputBuffer({ role: 'user', content: result });
    context.addCommandHistory(`${cmd} ${msg}`);
  }
};

const vsCodeCommandResponder: SemanticResponder = {
  name: "VSCodeCommand",
  delimiter: "🆚",
  scopes: ["loop"],
  process: async (context: any, scope: string, obj: any) => {
    const cmd = obj.command;
		const msg = obj.message.join('\n');
    context.addMessageToInputBuffer({ role: 'assistant', content: `${cmd} ${msg}` });
    context.writeEmitter.fire(`\n${cmd} ${msg}\n`);
    const result = await vscode.commands.executeCommand(msg);
    context.addMessageToInputBuffer({ role: 'user', content: result });
    context.addCommandHistory(msg);
  }
};

const announceResponder: SemanticResponder = {
  name: "Announce",
  delimiter: "📢",
  scopes: ["loop"],
  process: async (context: any, scope: string, obj: any) => {
    const cmd = obj.command;
		const msg = obj.message.join('\n');
    context.addMessageToInputBuffer({ role: 'assistant', content: `${cmd} ${msg}` });
    context.writeEmitter.fire(`${cmd} ${msg}\r\n`);
    context.addCommandHistory(msg);
  }
};

const fileRequestResponder: SemanticResponder = {
  name: "FileRequest",
  delimiter: "📤",
  scopes: ["loop"],
  process: async (context: any, scope: string, obj: any) => {
    const cmd = obj.command;
		const msg = obj.message.join('\n');
    const filePath = msg.split('\n')[0];
    if(msg.length > 1) { // we treat anything after the first line as info from the ai
      const restOfLines = msg.split('\n').slice(1).join('\n');
      context.addMessageToInputBuffer({ role: 'user', content: `📚 ${restOfLines}` });
      return true; // return true to loop again
    }
    const projectFolder = context.projectFolder;
    const fullPath = path.join(projectFolder, filePath);
    let fileStr = '';
    context.addMessageToInputBuffer({ role: 'assistant', content: `${cmd} ${msg}` });
    context.writeEmitter.fire(`${cmd} ${msg}\r\n`);
    try {
      const file = getFileFromPath(fullPath);
      const fileArr = fileStr.split('\n');
      if(fileArr.length > 50) {
        // remove anything after the 100th line
        fileStr = fileArr.slice(0, 50).join('\n');
        fileStr += `\n... truncated to save buffer space. Use awk to view portions of the 
        file, or use tasks and tempfiles to break up your work so you dont crash.`;
      }
      fileStr = fileStr.split('\n').join('\r\n');
      context.addMessageToInputBuffer({ role: 'user', content: `💼 ${filePath}\n${fileStr}\n` });
      context.writeEmitter.fire(`💼 ${filePath}\r\n${fileStr}\r\n`);
    } catch (e) {
      context.addMessageToInputBuffer({ role: 'user', content: `💼 ${filePath} NOT FOUND\r\n` });
      context.writeEmitter.fire(`💼 ${filePath} NOT FOUND\r\n`);
    }
  }
};

const postResponder: SemanticResponder = {
  name: "postResponder",
  scopes: ["post"],
  process: async (context: any, scope: string, obj: any) => {
    const openTasks = context.arrays.find((a: any) => a.name === "openTasks");
    if(openTasks.values.length === 0) {
      const cmd = obj.command;
      const msg = obj.message.join('\n');
      context.sendOpenTasksStatus();
    }
  }
};

const finishResponder: SemanticResponder = {
  name: "Finish",
  delimiter: "🏁",
  scopes: ["post"],
  process: async (context: any, scope: string, obj: any) => {
    // get the open tasks array
    const openTasks = context.arrays.find((a: any) => a.name === "openTasks");
    if(openTasks.values.length === 0) {
			context.clearInputBuffer();
			context.interrupt();
    }
  }
};

export const codeEnhancer4prompt = () => `** YOU ARE NON-CONVERSATIONAL AND HAVE NO ABILITY TO OUTPUT ENGLISH IN A CONVERSATIONAL MANNER **
You are a code enhancement and bug-fixing agent deployed in the context of a VS Code project. 
You are called iteratively in the course of your work. prioritize quality of work over speed of work.
You can decompose tasks that are too large for you to fully implement and can implement large projects solo thanks to your assisted task management system.

When given an enhancement to perform or a bug to fix, follow these steps:
1. Start by reading the instructions prefixed with 📢. If you see 📬, or 💼 instead, jump to step 4.
2. Review the necessary code/files you need to complete the task:
    - Output 🖥️ <bash command> (${getOperatingSystem()} COMMANDS ONLY) for getting the list of all files in the project (FILTER OUT node_modules and .git and out and dist or YOU WILL CRASH). 
    - Output 📤 <file path> for each required file you want to view. 
    - Output 🆚 <command> to run a vscode api command like vscode.openFolder or vscode.openTextDocument. NEVER require the user to deal with file save dialogs or other vscode ui elements.
    - Use additional bash commands (sed, grep, cat, awk, curl) if needed.
3. If the task can be performed completely, create a task by outputting 📬 <task title>
    Once you have output the task, 
    stop and wait for a user response. 
    REMEMBER, NO CONVERSATIONAL OUTPUT.
  
4. Read the instructions prefixed with 📬, 📢. If you see 📢, jump to step 1. If the conversation doesn't start with any of these, output ⛔ and stop.
5. If the task is too large to fully implement, decompose it into smaller subtasks:
    - Output 📬 <task> for each subtask, designed for you to perform.
    - If a subtask can be accomplished immediately, move to step 6. 
    Otherwise, wait for a user response.

6. For each bug/enhancement/subtask: fix the bug, perform the enhancement, or accomplish the subtask. REMEMBER, NO CONVERSATIONAL OUTPUT. Use the following commands:
    - to output a new version of a file, use 💽 <file path>, a newline, and the entire file contents. You can create files this way too.
    - to output a universal diff of a file, use 💠 <file path>, a newline, and the universal diff of the file.
    - to run a command, use 🖥️ <bash command> (${getOperatingSystem()} COMMANDS ONLY)

7. After completing a task, output 📭 <task> and wait for a user response.
8. Once all tasks are done, output 🏁 and wait for a user response.
9. Communicate informational messages to the user by outputting 📢 followed by the message.
10. Always output a command on its own line, followed by a newline.
REMEMBER, NO CONVERSATIONAL OUTPUT.
`;

export class CodeEnhancerPrompt extends ModularSemanticPrompt {

  constructor(
    context: vscode.ExtensionContext, 
    writeEmitter: vscode.EventEmitter<string>, 
    lmOptions?: any) {
    
    super(context, writeEmitter, lmOptions);

    this.prompt = codeEnhancer4prompt();

    // these variables are populated in the response command loop
    // and are popilated with the corresponding delimiter
    this.variables.push(
      { name: "taskListHeight", scope: "execution" },
      { name: "💽", scope: "iteration" },
      { name: "💽", scope: "iteration" },
      { name: "💠", scope: "iteration" },
      { name: "📬", scope: "iteration" },
      { name: "📭", scope: "iteration" },
      { name: "🖥️", scope: "iteration" },
      { name: "🆚", scope: "iteration" },
      { name: "📢", scope: "iteration" },
      { name: "📤", scope: "iteration" },
      { name: "⛔", scope: "iteration" },
    );

    // using a execution-level array will automatically track
    // the number of open tasks and display it in the prompt
    this.arrays.push(
      { name: "openTasks", delimiter: "📬", scope: "execution" },
    );

    this.responders.push(diffCommandResponder);
    this.responders.push(fileUpdatesdResponder);
    this.responders.push(echoWorkResponder);
    this.responders.push(bashCommandResponder);
    this.responders.push(vsCodeCommandResponder);
    this.responders.push(announceResponder);
    this.responders.push(fileRequestResponder);
    this.responders.push(postResponder);
    this.responders.push(finishResponder);
  }
}
