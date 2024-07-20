import express, { Express, Request, Response, NextFunction } from "express";
import dotenv from "dotenv";
import fs from "fs";
import { promisify } from 'util';
import path, { join, resolve } from 'path';
import  dynamicImport from './library/dynamic-import';
import { ASTtest, compareNoCommon, correctImports, getLargestMatch, getUpdatedFile, hasSimpleCall, hasSimpleCallWithArrow, hasUniqueSimpleCallWithArrow, isPlaceholder, isUnique } from "./library/get-updated-file";
import { getUpdatedFileTest } from "./library/get-updated-file-test";
import { extractJSX } from "./library/extractjsx";
import { addFileContents, addFullPath, getPrompt } from "./library/execute-steps";

dotenv.config();
const app: Express = express();

app.use(express.json());

app.use((req: Request, res: Response, next: NextFunction) => {
    res.header('Access-Control-Allow-Origin', "*");
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

function setDotenv(feature: any) {
  if (feature["autocodeDotenv"]) {
    for (const [key, value] of Object.entries(feature["autocodeDotenv"])) {
        process.env[key] = value as string;
    }
  }
}

app.post("/api/execute-steps", async (req, res) => {
    console.log('Inside execute-steps endpoint');
    if (!req.body.feature) {
        return res.status(400).json({ error: 'Missing feature' });
    }
    setDotenv(req.body.feature);
    try {
        // Import and execute dynamic code
        const { executeSteps } = await dynamicImport(resolve(__dirname, 'library', 'execute-steps.ts'));
        const keyValues = await executeSteps(req.body.feature);

        res.status(200).json(keyValues);
    } catch (error) {
        console.log('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post("/api/auto-insert", async (req, res) => {
    console.log("Inside auto-insert endpoint");
    if (!req.body.existingFile || !req.body.codeSnippet || !req.body.filePath) {
        return res.status(400).json({ error: 'Check if request is missing existingFile, codeSnippet, or filePath.' });
    }
    let internalError;
    console.log("Incoming Request: ", req.body);
    try {
        fs.writeFileSync(req.body.filePath, await getUpdatedFile(req.body.existingFile, req.body.codeSnippet, req.body.filePath));
        res.status(200).json({ internalError });
    } catch (error) {
        internalError = "Internal server error: " + error;
        console.log(internalError);
        res.status(200).json({ internalError });
    }
});

app.post("/api/generate", async (req, res) => {
    console.log("Inside generate endpoint");
    let internalError;
    try {
        const feature = req.body.feature;
        let step = feature["steps"][0];
        const parentDir = path.resolve(__dirname, "..");
        console.log("Parent Dir: " + parentDir);
        let repoName;
        if (process.env.PROJECT_PATH)
            repoName = path.basename(process.env.PROJECT_PATH);
        if (!repoName) {
            throw new Error("Failed to extract repository name from repoURL or PROJECT_PATH");
        }

        const repoDir = path.join(parentDir, repoName);
        console.log("Repo Dir: " + repoDir);
        process.chdir(repoDir);     // very important to remember... should have been in addFileContents
        const files = step["files"];
        for (const file of files) {
            if (process.env.CLONING === "true") {
                addFullPath(file, repoDir);
            }
            addFileContents(file);
            console.log("fileConents: " + file["fileContents"]);
        }
         // very important to remember... dynamically import
        const { getPrompt } = await dynamicImport(resolve(join(__dirname, "library"), 'execute-steps.ts'));
        let currPrompt = await getPrompt(step);
        console.log("Prompt: " + currPrompt);
        const { prompt } = await dynamicImport(resolve(join(__dirname, "library"), 'prompt.ts'));
        const codeAttempt = await prompt(currPrompt, process.env.CHATGPT_APIKEY as string);
        console.log("Code Attempt: " + codeAttempt);
        const trimmedCode = extractJSX(codeAttempt);
        res.status(200).json({ trimmedCode, internalError });
    } catch (error) {
        internalError = "Internal server error: " + error;
        console.log(internalError);
        res.status(200).json({ internalError });
    }
});

// Start the server initially
const port = parseInt(process.env.PORT || "3000");

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

//getUpdatedFileTest();

/*const text1 = "Here is some sample text with a // rest of code goes here";
const text2 = "Here is some sample text with a placeholder and more text";

const match = getLargestMatch(text1, text2);
console.log(match);*/

//console.log("Testing if } is unique: " + isUnique("}", ["", "", "}"], ["", "}", "}"]));
//console.log("isPlaceholder: " + isPlaceholder("  // ..."));

// Run Autocode with the default feature setting if set
if (process.env.FEATURE) {
    fs.readFile(process.env.FEATURE, 'utf8', async (err, data) => {
        if (err) {
            console.error("Error reading file:", err);
            return;
        }
        try {
            const feature = JSON.parse(data);
            console.log("Feature loaded:", feature);
            // Call execute-steps endpoint with the feature
            const startTime = new Date().getTime(); // Get start time in milliseconds
            let response = await fetch(`http://localhost:${port}/api/execute-steps`, {method: 'POST', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ feature }) });
            console.log(await response.json());
            console.log("Time elapsed for execute-steps endpoint: "
                + (((new Date().getTime()) - startTime) / 1000) + " sec"); // Convert milliseconds to seconds
        } catch (error) {
            console.error("Error parsing JSON:", error);
        }
    });
}
