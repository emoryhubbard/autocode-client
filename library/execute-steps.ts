import { extractJSX } from "../library/extractjsx";
import { logAndRun } from "../library/log-and-run";
import { getUpdatedFunctions } from "./get-updated-functions";
import * as fs from "fs";
import * as dotenv from "dotenv";
import * as path from "path";
import * as child_process from "child_process";
import  dynamicImport from '../library/dynamic-import';
import { resolve } from 'path';
import { getUpdatedFile, isPlaceholder } from "./get-updated-file";
import { exec } from 'child_process';
import internal from "stream";

dotenv.config();

export async function executeSteps(feature: any) {
    let steps = feature["steps"];
    const parentDir = path.resolve(__dirname, "..");
    let repoName;
    if (feature["repoURL"]) {
        const repoURL = feature["repoURL"];
        repoName = repoURL.match(/\/([^/]+)\.git$/)?.[1];
    }
    if (!feature["repoURL"] && process.env.PROJECT_PATH)
        repoName = path.basename(process.env.PROJECT_PATH);
    if (!repoName) {
        throw new Error("Failed to extract repository name from repoURL or PROJECT_PATH");
    }

    const repoDir = path.join(parentDir, repoName);


    let passing = true;
    let internalError;
    let stepResponses = [];
    try {
        const firstStep = steps[0];
        await preliminaryRepoTest(repoName, feature["dotenvContents"], firstStep["testPath"]);
        if (process.env.REACT_STRICT_MODE == "false")
            await modifyNextConfig(repoName);
    }
    catch (err) {
        passing = false;
        internalError = "Internal error with firstStep access, preliminaryRepoTest, or modifyNextConfig: " + err;
        console.log(internalError);
    }
    for (const step of steps) {
        try {
            let stepResponse = await executeStep(step, repoDir);
            stepResponses.push(stepResponse);
            if (!stepResponse["passing"]) {
                passing = false;
                break;
            }
        } catch (err) {
            passing = false;
            internalError = "Internal error executing step: " + err;
            console.log(internalError);
            break;
        }
    }

    if (passing)
        console.log("Feature completed. Tests passed at each step.");
    if (!passing)
        console.log("Unable to get all tests to pass. See console logs for details.");
    return {passing, stepResponses, internalError}; // the last passing value is repeated here for convenience since stepResponses might be empty if an error occured, which could also be used to deduce the passing value
}

async function preliminaryRepoTest(repoName: string, dotenvContents: string, testPath: string) {
    const currentDir = process.cwd();
    const parentDir = path.resolve(currentDir, "..");
    const repoDir = path.join(parentDir, repoName);

    process.chdir(repoDir);
    if (dotenvContents)
        fs.writeFileSync(".env", dotenvContents);

    // Spawn the terminal process, but don't wait for it
    const terminalProcess = child_process.spawn("gnome-terminal", ["--", "npm", "run", "dev"], {
        detached: true, // Detach the child process
        stdio: "ignore" // Ignore stdio (standard I/O)
    });

    terminalProcess.unref(); // Unreference the child process to allow the parent to exit independently

    await new Promise(resolve => setTimeout(resolve, 6000));
    await logAndRun(testPath, "false");
}

async function modifyNextConfig(repoName: string) {
    const currentDir = process.cwd();
    const parentDir = path.resolve(currentDir, "..");
    const repoDir = path.join(parentDir, repoName);
    const nextConfigPath = path.join(repoDir, "next.config.js");

    try {
        // Read the content of next.config.js
        let nextConfigContent = fs.readFileSync(nextConfigPath, "utf-8");

        // Regex to find reactStrictMode: false
        const reactStrictModeFalseRegex = /reactStrictMode:\s*false/;
        // Regex to find reactStrictMode: true
        const reactStrictModeTrueRegex = /reactStrictMode:\s*true/;
        // Regex to find const nextConfig = {
        const nextConfigStartRegex = /const\s+nextConfig\s*=\s*{/;

        // Check if reactStrictMode: false is present
        if (!reactStrictModeFalseRegex.test(nextConfigContent)) {
            // If reactStrictMode: true is present, replace it with reactStrictMode: false
            if (reactStrictModeTrueRegex.test(nextConfigContent)) {
                nextConfigContent = nextConfigContent.replace(reactStrictModeTrueRegex, "reactStrictMode: false");
            } else {
                // If neither reactStrictMode: true nor reactStrictMode: false is present,
                // add reactStrictMode: false after const nextConfig = {
                nextConfigContent = nextConfigContent.replace(nextConfigStartRegex, "const nextConfig = { reactStrictMode: false ");
            }

            // Write the modified content back to next.config.js
            fs.writeFileSync(nextConfigPath, nextConfigContent);
            console.log("next.config.js modified successfully.");
        } else {
            console.log("reactStrictMode: false already exists in next.config.js. No modification needed.");
        }
    } catch (err) {
        console.error("Error modifying next.config.js:", err);
    }
}

async function executeStep(step: any, repoDir: string) {
    const files = step["files"];
    for (const file of files) {
        if (process.env.CLONING === "true") {
            addFullPath(file, repoDir);
        }
        addFileContents(file);
    }

    let passing = false;
    const codeAttempts: string[] = [];
    const logs: string[] = [];
    const passingResponses: string[] = [];
    let currPrompt = await getPrompt(step);
    let trimmedCode = "";

    console.log("\ncurr_prompt:", currPrompt);
    const { prompt } = await dynamicImport(resolve(__dirname, 'prompt.ts'));
    let codeAttempt = await prompt(currPrompt, process.env.CHATGPT_APIKEY as string);

    console.log("\ncode_attempt:", codeAttempt);

    const maxAttempts = 3;
    for (let i = 0; i < maxAttempts; i++) {
        codeAttempts.push(codeAttempt);
        trimmedCode = extractJSX(codeAttempt);
        console.log("\ntrimmed_code:", trimmedCode);
        await createOrModify(step, trimmedCode);
        await new Promise(resolve => setTimeout(resolve, 3000));
        const testPath = step["testPath"];
        const currLogs = await logAndRun(testPath, step["showHTML"].toLowerCase());
        console.log("\ncurr_logs:", currLogs);
        logs.push(currLogs);
        codeAttempt = await getPassingResponse(trimmedCode, logs[i], currPrompt, step["target"]);
        passingResponses.push(codeAttempt);
        passing = isPassing(passingResponses[i]);
        console.log("\ncode_attempt:", codeAttempt);
        if (passing) {
            break;
        }
    }
    if (!passing) {
        console.log("Debugging attempts failed. Aborting execution.");
    }
    return { codeAttempts, logs, passingResponses, passing, lastTrimmedCode: trimmedCode };
}

export function addFullPath(file: any, repoDir: string) {
    const filePath = file["filePath"];
    const updatedFilePath = path.join(repoDir, filePath);
    file["filePath"] = updatedFilePath;
    console.log("Updated filePath:", file["filePath"]);
}

export function addFileContents(file: any) {
    const filePath = file["filePath"];
    try {
        const contents = fs.readFileSync(filePath, "utf-8");
        file["fileContents"] = contents;
    } catch (err) {
        console.log("Error reading file:", filePath);
    }
}

interface TreeOptions {
    base: string;
    fullpath?: boolean;
    noreport?: boolean;
    exclude?: string[];
    maxdepth?: number;
}

function generateTree(options: TreeOptions): Promise<string> {
    return new Promise((resolve, reject) => {
        const excludePattern = options.exclude ? options.exclude.join(', ') : '';
        const cmd = `tree ${options.base} ${excludePattern ? `--ignore '${excludePattern}'` : ''} ${options.maxdepth ? `-l ${options.maxdepth}` : ''}`;
        console.log(cmd);

        exec(cmd, (error, stdout, stderr) => {
            if (error) {
                reject(error);
            } else if (stderr) {
                reject(new Error(stderr));
            } else {
                resolve(stdout);
            }
        });
    });
}

export async function getPrompt(step: any) {
    const PROMPT = '';
    let prompt = PROMPT;

    const tree = require('tree-cli');

    console.log(process.env.PROJECT_PATH);
    // Set the options for generating the tree
    const options: TreeOptions = {
        base: process.env.PROJECT_PATH || '', // Replace with your directory path
        fullpath: true,                  // Show full paths in the tree
        noreport: true,                   // Do not show file and directory count
        exclude: process.env.EXCLUDE_DIR ? process.env.EXCLUDE_DIR.split(" "): [''], // Exclude 'node_modules' directory
        maxdepth: 5                       // Limit the depth of the tree
    };



    let dirTree = '';
    // Generate the tree
    tree(options, (err: Error | null, res: string) => {
        if (err) {
            console.error(err);
        } else {
            dirTree = res;
        }
    });
    try {
        dirTree = await generateTree(options);
    } catch (error) {console.log(error)}

    if (process.env.SHOW_DIR == "true")
        prompt += "\nTo help with import statements, this is the directory structure: " + dirTree + '\n';

    const files = step["files"];
    for (const file of files) {
        const fileName = file["fileName"];
        const filePath = file["filePath"];
        const fileContents = file["fileContents"] ?? "No file contents";
        prompt += ` Here is the current ${fileName} located at ${filePath}: "${fileContents}"\n`;
    }
  
    return prompt;
}

async function createOrModify(step: any, newContents: string) {
    const targetFileName = step["target"];
    const files = step["files"];
    const targetFile = files.find((file: any) => file["isTarget"]);

    if (!targetFile) {
        throw new Error("Target file not found in step");
    }

    const targetFilePath = targetFile["filePath"];
    let existingContents = "";

    try {
        existingContents = fs.readFileSync(targetFilePath, "utf-8");
    } catch (err) {
        // File doesn't exist yet
    }

    const newLines = newContents.split("\n").length;
    const existingLines = existingContents.split("\n").length;
    if (containsPlaceholder(newContents.split("\n"))) {
        console.log("Detected placeholder");
        fs.writeFileSync(targetFilePath, await getUpdatedFile(existingContents, newContents, targetFilePath))
    }
    else if (newLines < existingLines / 2) {
        console.log("Detected snippet without placeholder")
        fs.writeFileSync(targetFilePath, getUpdatedFunctions(existingContents, newContents));
    } else {
        console.log("Detected full file")
        fs.writeFileSync(targetFilePath, newContents);
    }

    console.log(`File ${targetFileName} ${existingContents ? "modified" : "created"}.`);
}

function containsPlaceholder(lines: string[]): boolean {
    for (const line of lines) {
        if (isPlaceholder(line)) {
            return true;
        }
    }
    return false;
}

async function getPassingResponse(code: string, logs: string, userPrompt: string, target: string) {
    logs = logs || "[no console log output was produced]";

    const responsePrompt = `Here is the code: ${code}\n\nNote that it should be doing exactly what the user wanted, which was '${userPrompt}'. Based on the following logs, does this code look like it ran properly? Console logs:\n${logs}\n[end of logs]\n\nIMPORTANT: Please include the word yes, or no, in your response for clarity, explain why, and provide a corrected "${target}", if necessary (include any missing function calls, especially if the logs are empty yet functions are defined, in your corrected "${target}").`;

    const { prompt } = await dynamicImport(resolve(__dirname, 'prompt.ts'));
    const response = await prompt(responsePrompt, process.env.CHATGPT_APIKEY as string);

    return response;
}

function isPassing(response: string) {
    return response.toLowerCase().includes("yes");
}
