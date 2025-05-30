import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as cp from "child_process";

export function activate(context: vscode.ExtensionContext) {
  const makefileProvider = new MakefileTreeProvider();

  vscode.window.registerTreeDataProvider("makefileScripts", makefileProvider);
  vscode.commands.registerCommand("makefileRunner.refresh", () =>
    makefileProvider.refresh()
  );
  vscode.commands.registerCommand(
    "makefileRunner.runTarget",
    (target: string | MakeTarget) => {
      // Handle both string and MakeTarget object
      const targetName = typeof target === "string" ? target : target.label;
      const terminal = vscode.window.createTerminal("Makefile Runner");
      terminal.sendText(`make ${targetName}`);
      terminal.show();
    }
  );
  vscode.commands.registerCommand(
    "makefileRunner.openTarget",
    async (target: MakeTarget) => {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) {
        return;
      }

      const makefilePath = path.join(
        workspaceFolders[0].uri.fsPath,
        "Makefile"
      );
      const makefileUri = vscode.Uri.file(makefilePath);

      try {
        const document = await vscode.workspace.openTextDocument(makefileUri);
        const editor = await vscode.window.showTextDocument(document);

        // Navigate to the specific line
        const position = new vscode.Position(target.lineNumber, 0);
        editor.selection = new vscode.Selection(position, position);
        editor.revealRange(new vscode.Range(position, position));
      } catch (error) {
        vscode.window.showErrorMessage(`Could not open Makefile: ${error}`);
      }
    }
  );

  // Function to check if Makefile exists and set context
  async function updateMakefileContext() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      await vscode.commands.executeCommand(
        "setContext",
        "makefileRunner.hasMakefile",
        false
      );
      return;
    }

    const makefilePath = path.join(workspaceFolders[0].uri.fsPath, "Makefile");
    const hasMakefile = fs.existsSync(makefilePath);

    console.log(`Makefile check: ${makefilePath} exists: ${hasMakefile}`);

    await vscode.commands.executeCommand(
      "setContext",
      "makefileRunner.hasMakefile",
      hasMakefile
    );

    if (hasMakefile) {
      makefileProvider.refresh();
    }
  }

  // Set up file watcher for Makefile changes
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders) {
    const makefilePattern = new vscode.RelativePattern(
      workspaceFolders[0],
      "Makefile"
    );
    const watcher = vscode.workspace.createFileSystemWatcher(makefilePattern);

    // Refresh when Makefile is created, changed, or deleted
    watcher.onDidCreate(() => {
      updateMakefileContext();
    });
    watcher.onDidChange(() => {
      makefileProvider.refresh();
    });
    watcher.onDidDelete(() => {
      updateMakefileContext();
    });

    // Clean up the watcher when extension is deactivated
    context.subscriptions.push(watcher);
  }

  // Also watch for workspace folder changes
  vscode.workspace.onDidChangeWorkspaceFolders(() => {
    updateMakefileContext();
  });

  // Initial check - delay it slightly to ensure VS Code is ready
  setTimeout(() => {
    updateMakefileContext();
  }, 100);
}

class MakefileTreeProvider implements vscode.TreeDataProvider<MakeTarget> {
  private _onDidChangeTreeData: vscode.EventEmitter<MakeTarget | undefined> =
    new vscode.EventEmitter<MakeTarget | undefined>();
  readonly onDidChangeTreeData: vscode.Event<MakeTarget | undefined> =
    this._onDidChangeTreeData.event;

  private targets: Array<{ name: string; line: number }> = [];

  refresh(): void {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      return;
    }

    const makefilePath = path.join(workspaceFolders[0].uri.fsPath, "Makefile");
    if (fs.existsSync(makefilePath)) {
      const content = fs.readFileSync(makefilePath, "utf-8");
      this.targets = this.extractTargets(content);
    } else {
      this.targets = [];
    }

    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: MakeTarget): vscode.TreeItem {
    return element;
  }

  getChildren(): Thenable<MakeTarget[]> {
    // If no Makefile exists, show a helpful message
    if (this.targets.length === 0) {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) {
        return Promise.resolve([]);
      }

      const makefilePath = path.join(
        workspaceFolders[0].uri.fsPath,
        "Makefile"
      );
      if (!fs.existsSync(makefilePath)) {
        // Return a placeholder item that shows "No Makefile found"
        const placeholder = new vscode.TreeItem(
          "No Makefile found",
          vscode.TreeItemCollapsibleState.None
        );
        placeholder.iconPath = new vscode.ThemeIcon("info");
        placeholder.tooltip = "Create a Makefile to see available targets";
        return Promise.resolve([placeholder as any]);
      }
    }

    return Promise.resolve(
      this.targets.map((t) => new MakeTarget(t.name, t.line))
    );
  }

  private extractTargets(
    content: string
  ): Array<{ name: string; line: number }> {
    const lines = content.split("\n");
    const targets: Array<{ name: string; line: number }> = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(/^([a-zA-Z0-9\-_]+):/);
      if (match) {
        targets.push({ name: match[1], line: i });
      }
    }

    return targets.filter(
      (target, index, self) =>
        index === self.findIndex((t) => t.name === target.name)
    );
  }
}

class MakeTarget extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly lineNumber: number
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);

    // Set command to open the target in Makefile when clicked
    this.command = {
      command: "makefileRunner.openTarget",
      title: "Open in Makefile",
      arguments: [this],
    };

    this.iconPath = new vscode.ThemeIcon("tools"); // 🔧 icon like npm scripts

    // IMPORTANT: Set contextValue to enable inline actions
    this.contextValue = "makeTarget";

    // Optional: Set tooltip
    this.tooltip = `Click to open in Makefile, or use play button to run make ${label}`;
  }
}

export function deactivate() {}
