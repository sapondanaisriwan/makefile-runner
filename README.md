# Makefile Runner

A Visual Studio Code extension that adds a **Makefile Scripts** panel to the Explorer.
It automatically detects targets in a `Makefile` and lets you click to run them — just like the NPM Scripts panel.

![Preview](https://github.com/user-attachments/assets/43b72ad3-c10a-44f5-a686-3b89a64e0ae0)

## Features

- 🛠 Detects all top-level Makefile targets
- ▶️ One-click to run `make <target>`
- 🧠 No configuration required

## How It Works

1. Opens `Makefile` in your workspace
2. Parses lines like: `build:`, `test:`, `run:`
3. Adds clickable entries in the **Makefile** panel

## Limitations
- Doesn’t support .PHONY, dependencies, or multi-line targets (yet)