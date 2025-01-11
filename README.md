# Quick Start

The most up-to-date information for using Autocode:

- Clone this repository
- Clone https://github.com/emoryhubbard/autocode-extension
- Clone or copy your React repo you want AutocodeChat to modify or https://github.com/emoryhubbard/tailwindify (if you want a quick test you can instead first try modifying my React project called "tailwindify" instead of your own) into the parent folder of the cloned autocode-client. For example, if autocode-client was cloned into the Documents folder, then clone your React repo (or tailwindify) into the Documents folder.

Then:
- Create .env file in autocode-client and populate with example.env data, including your PROJECT_PATH to tailwindify, and your API keys
- Create .env file in autocode-extension and populate with example.env data (no need to add anything else)
- Create .env file in autocode-extension/web and populate with web/example.env data (no need to add anything else)

Then:
- Run "npm install" in your React repo (or tailwindify)
- Run "npm run dev" in your React repo (or tailwindify), and double check that it is watching any file changes so they are reflected upon page reloading
- Run "npm install" in autocode-client
- Run "npm install" in autocode-extension
- Run "npm install" in autocode-extension/web
- Run "npm run build" in autocode-extension/web

Then:
- Run "python3 app.py" in autocode-client
- Run "npm run dev" in autocode-client
- Navigate to Run and Debug tab in autocode-extension and choose Run VS Code extension option
- Open your React repo (or tailwindify) folder in new VS Code extension debug window that appears
- Open command pallete
- Run Autocode: Open Chat
- In the chat box type the change you want (or for tailwindify for example "Add a function called setLastVisit to page.jsx that uses the setLocalStorage function in utils.mjs to set lastVisit as the current time.")
- In Test URL type the local host URL for the page corresponding to the file in your React repo you are trying to modify (or http://localhost:3000 for tailwindify)
- Click Auto-Insert

Note: the Auto-Insert button isn't 100% reliable. The code snippet parser for Auto-Insert (essentially an Apply in Editor button) uses abstract syntax tree traversal and placheolder comments created by the LLM, but the LLM's placeholder comment oputput is not always consistent or complete enough for it to insert the code perfectly as intended, and it has been designed to anticipate several common LLM mistakes and be robust enough to sufficiently recover the intended meaning and insert accurately despite them.

More details on the parser and future work: it's about 3000 lines of code (it was written rather hastily, due to the scope of the problem and a large number of edge cases, and still needs to be refactored into smaller individual files) and resides in a file called get-updated-file.ts in autocode-client. I plan on comparing this Apply in Editor feature to the Continue AI coding assistant's feature, which was released shortly after I designed this one, since it may be more robust or use better prompt engineering to ensure more consistent placeholder comment output. Even if it doesn't handle my test cases perfectly, it is probably a better starting point to work with to improve sufficiently to be able to handle them, but if not, I left off on improving the code snippet parser by attempting to fix it to solve test case 15. In order to see the error test case 15 generates, and to see if you have solved it, go to server.ts in autocode-client and uncomment the line that says getUpdatedFileTest().

You can also test the program without using autocode-extension. Instead, you can change the .env variable FEATURENO in autocode-client to read FEATURE. This will cause it to automatically attempt to code the indicated feature when you run "npm run dev" in autocode-client, and allow you to discover new potential failures for new test cases more quickly than using the GUI.

The main debug and feedback loop logic is found in execute-steps.ts in autocode-client. Other tools are scattered around. 
