# Autocode Client

The Autocode Client is the Node successor to the Autocode Native application. Autocode Native was refactored from Rust to TypeScript to allow for more rapid prototyping in this stage of development.

# Quick Start

The most up-to-date information for using Autocode is as follows:

Clone this repository (the non-public code)
Clone https://github.com/emoryhubbard/autocode-extension (the public extension)
Clone https://github.com/emoryhubbard/tailwindify (for quick testing) into the parent folder of the cloned autocode-client. For example, if autocode-client was cloned into the Documents folder, then clone tailwindify into the Documents folder.

Then:
Create .env file in autocode-client and populate with example.env data, including your PROJECT_PATH to tailwindify, and your API keys
Create .env file in autocode-extension and populate with example.env data (no need to add anything else)
Create .env file in autocode-extension/web and populate with web/example.env data (no need to add anything else)

Then:
Run "npm install" in tailwindify
Run "npm install" in autocode-client
Run "npm install" in autocode-extension
Run "npm install" in autocode-extension/web
Run "npm run build" in autocode-extension/web

Then:
Run "python3 app.py" in autocode-client
Run "npm run dev" in autocode-client
Navigate to Run and Debug tab in autocode-extension and choose Run VS Code extension option
Open tailwindify folder in new VS Code extension debug window that appears
Open command pallete
Run Autocode: Open Chat
In the chat box type "Add a function called setLastVisit to page.jsx that uses the setLocalStorage function in utils.mjs to set lastVisit as the current time."
In Test URL type http://localhost:3000
Click Auto-Insert

The code snippet parser has problems. This parser is about 3000 lines of code and resides in a file called get-updated-file.ts in autocode-client. The main debug and feedback loop logic is found in execute-steps.ts in autocode-client. Other tools are scattered around.

I left off on improving the code snippet parser by attempting to fix it to solve test case 15. In order to see the error test case 15 generates, and to see if you have solved it, go to server.ts in autocode-client and uncomment the line that says getUpdatedFileTest().

You can also test the program without using autocode-extension. Instead, you can change the .env variable FEATURENO in autocode-client to read FEATURE. This will cause it to automatically attempt to code the indicated feature when you run "npm run dev" in autocode-client, and allow you to discover new potential failures for new test cases more quickly than using the GUI.

# Autocode Native (Older Version)

Autocode Native is a Rust-based application developed to run natively on Ubuntu. It is designed to improve upon the [Autocode Classic](https://github.com/emoryhubbard/Autocode?tab=readme-ov-file#autocode-classic) web app by helping React developers automate adding features to their apps, with the goal of leveraging task decomposition and a task management algorithm to create incremental, tested changes before moving on to the next step of the job.

**[First Autocode Native Demo Video](https://youtu.be/eV3pdysg3aE)** (see the [Autocode repo](https://github.com/emoryhubbard/Autocode) for the current status of the project)

# Development Environment

Autocode Native is developed using the following technologies and tools:

- **Rust:** Autocode Native is primarily developed using Rust programming language, providing high performance and memory safety.
- **Ubuntu:** The application was developed with and designed to run on the current LTS version of Ubuntu (Jammy Jellyfish).
- **ChatGPT API:** Autocode Native utilizes the ChatGPT API for prompt-based code generation and interaction. An API key is required for accessing ChatGPT services.
- **serde_json:** The serde_json crate is used for parsing and generating JSON data.
- **dotenvy:** Autocode Native uses the actively-maintained dotenvy fork of dotenv for loading environment variables from a `.env` file during development.
- **tokio:** Asynchronous runtime for Rust, used for asynchronous task management.
- **reqwest:** The reqwest crate is used for making HTTP requests to external APIs.
- **Visual Studio Code (VS Code):** The development environment is Visual Studio Code, a powerful and extensible code editor.

# Useful Rust Libraries

- [serde_json](https://crates.io/crates/serde_json)
- [dotenvy](https://crates.io/crates/dotenvy)
- [tokio](https://crates.io/crates/tokio)
- [reqwest](https://crates.io/crates/reqwest)

# Future Work

Note: Some of this work has already been completed. See the [Autocode repo](https://github.com/emoryhubbard/Autocode) for the current status of the project.

- Implement an Extract API endpoint to enable Autocode Native to extract JSX code, based on similar work with [ExtractJS](https://github.com/emoryhubbard/ExtractJS).
- Implement file modification using the ChatGPT responses, using the Extract endpoint.
- Implement automated running and testing of generated code based on job descriptions. Currently the Rust crate chromiumoxide is the top candidate for testing.
- Enhance user experience by adding additional customization options for generated code.

