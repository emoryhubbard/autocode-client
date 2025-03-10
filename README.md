# Overview

Built with TypeScript, React, and Python as a VS Code extension, this AI coding assistant is a self-testing and self-debugging code generator for React developers.

Instead of asking an LLM for code, running it and getting errors and asking it to fix them and repeat, Autocode does that work for you. It makes the desired code and embeds tests in it, runs it and verifies the results of the logs (and any errors), and if it's not running correctly it keeps trying to debug it until it works properly:

![Image of Autocode being used to generate and insert code](ComplexSnippetCropped.png)

## What Problem Does It Solve?

The Back-And-Forth Problem:

There is a constant back-and-forth between LLM and developer that can occur during a coding session, where the developer asks for code and runs it, and since both LLMs and humans are prone to generating code that doesn't run perfectly the first time without testing it, if there's a problem the developer then asks the LLM for a quick and fast fix (since it can often find errors quickly and effortlessly), changes the code and runs it, and does this repeatedly until it runs without errors, and console logs (or GUI output, or test cases) indicate it is working as intended.

This VS Code extension version does it by having the LLM insert console log statements into the code it generates, navigates to a URL of the user's locally-running React app where the file they were trying to modify will have its code executed, then feeds the results of the logs (and any errors) from loading that page with a headless browser (and there is also an option for doing it with a full browser so you can see it) to verify it is running correctly, and if not it tries again until it gets it working properly or gives up.

It has solved this problem in principle but still needs some work--see [More Details on Apply Snippet and Future Work](https://github.com/emoryhubbard/autocode-client?tab=readme-ov-file#more-details-on-apply-snippet-and-future-work).

This problem is much harder than it looks, because it needs to run FAST--it can't just ask the LLM for a whole file, you have to ask it for snippets, and deal with all the edge cases to properly apply them (hence the elaborate abstract syntax tree [system for applying snippets](https://github.com/emoryhubbard/autocode-client?tab=readme-ov-file#more-details-on-apply-snippet-and-future-work) I developed), and prompt engineering, to keep the token count down so each LLM call takes only 2 or 3 seconds at most, since it might need to test and re-run 3 or 4 times to solve any problems with the initial LLM code or subsequent attempts. Not only that, but it required developing a system for extracting JSX code from the LLM's responses (which I originally [made a neural network](https://github.com/emoryhubbard/extractjs) for, then found a more robust way to do it here by an inventing an algorithm which uses a JSX parser, although another alternative would be to use an LLM API endpoint which responds with JSON for its output with a JSX property).

The Changes-In-Mutiple-Files Problem:

Even if you get the first problem above solved, that means the developer can avoid back-and-forth for the one file he is working on, but in the real world conditions are different--you will often need to edit multiple files to get a new feature in your app to work, so why not just in natural language tell it do a certain change in file x then a certain change in file y etc. in a single prompt, for as many steps as you can think of that would take to implement the new feature?

It has solved the back-and-forth problem in theory, but hasn't yet solved the "ask for multiple file changes in one prompt" problem. I believe it can with further refinement, considering that many previous refinements allowed it to get to this point and solve harder problems already, and most importantly that I've begun collaborating on this with a partner, [Nathan Spotten](https://github.com/spottenn) (another student from my university) who independently came up with a very similar idea, and that others are working on very similar tools or pieces of these problems, for example with the open-source AI coding assistant [Continue](https://github.com/continuedev/continue) which now has an Apply Code feature and which mentioned an agent loop system in its Y Combinator page (although I could not find any documentation or implementation of the agent loop yet, unlike most of the other features), and with [Swyx's smol dev](https://github.com/smol-ai/developer).

The Task Decomposition Problem:

If you can tell it to do certain code changes to certain files all in one natural language prompt for the purpose of implementing your feature, why not just tell it to implement your feature and decide how to do that on its own, so you don't have to describe precisely what code changes the new feature would need? Why not just have it generate its own list of code changes automatically and implement them in response to what feature you ask it to implement?

The two previous problems would need to be solved very well first, and just having those two problems solved would aid developer productivity significantly already. I still think task decomposition is possible based on the unprecedented recent advances in AI predictive power and multi-modality, but it would take a significant amount of engineering effort and collaboration (not just a side project of one or two developers) to get it to be capable of doing it reliably most of the time for simple features (where the focus is on function rather than form), and with multi-modal LLMs and complex visual feedback and debugging systems it could even be used to help solve the further problem of properly turning figmas into usable (maintainable, acceptable-quality) code.

## Current Status

After creating this VS Code extension version, it has since become a collaborative project (which we will soon create a new repository for due to the decision to build it into Continue): we are reworking the concept to be called AutoCodeChat and to instead have its GUI and functionality incorporated into a fork of an open-source AI coding assistant called [Continue](https://github.com/continuedev/continue), with our new tool's GUI being integrated and accessible through an action, and we are planning on making a PR when it is sufficiently robust. More details and updates will first be placed here until we publish the new repository.

## Quick Start

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

## More Details on Apply Snippet and Future Work

The Auto-Insert button isn't 100% reliable. The apply snippet system for Auto-Insert (essentially an Apply in Editor button) uses abstract syntax tree traversal and placheolder comments created by the LLM, but the LLM's placeholder comment oputput is not always consistent or complete enough for it to insert the code perfectly as intended, and it has been designed to anticipate several common LLM mistakes and be robust enough to sufficiently recover the intended meaning and insert accurately despite them.

It's about 3000 lines of code (it was written rather hastily, due to the scope of the problem and a large number of edge cases, and still needs to be refactored into smaller individual files) and resides in a file called get-updated-file.ts in autocode-client. I plan on comparing this Apply in Editor feature to, and likely replacing it with, the Continue AI coding assistant's feature, which was released shortly after I designed this one, since it may be more robust or use better prompt engineering to ensure more consistent placeholder comment output.

Even if Continue's [Apply in Editor](https://blog.continue.dev/instant-apply/) feature doesn't handle my test cases perfectly, it is probably a better starting point to work with to improve sufficiently to be able to handle them, but if not, I left off on improving the apply snippet system by attempting to fix it to solve test case 15. In order to see the error test case 15 generates, and to see if you have solved it, go to server.ts in autocode-client and uncomment the line that says getUpdatedFileTest().

You can also test the program without using autocode-extension. Instead, you can change the .env variable FEATURENO in autocode-client to read FEATURE. This will cause it to automatically attempt to code the indicated feature when you run "npm run dev" in autocode-client, and allow you to discover new potential failures for new test cases more quickly than using the GUI.

The main debug and feedback loop logic is found in execute-steps.ts in autocode-client. Other tools are scattered around.

## Older Prototype: Autocode Native Interface

Below, you will find the previous versions which functioned as web applications before the transition to VS Code extension.

The Autocode Native Interface was an expanded version of the original Autocode Classic web application, designed specifically for generating, testing, and debugging code for React applications. Unlike its predecessor, **[Autocode Classic](https://autocode-five.vercel.app/)**, the Autocode Native Interface runs on the user's machine for its back-end, while also continuing to use an Angular web app (running locally) for its front-end, which allows it to directly modifying and run the user's .js and .jsx files as part of its feedback loop, with the ultimate goal of helping React Developers automate implementation of app features through writing precise instructions.

**[Autocode Milestones Video](https://youtu.be/bgMEVYLi2w8)**

**[Example of Successful Feature](https://youtu.be/Yasyke__WGA)**

**[Autocode Native Interface Demo Video](https://youtu.be/k9advUWgDaE)**

### Purpose

The primary purpose of the Autocode Native Interface is to simplify the process of code generation and verification for React applications. It provides developers with a local development interface to interact with a local Autocode Native client, enabling them to incrementally add features to their applications through bite-sized steps.

### Usage

An **[Autocode Native Interface Preview](https://autocode-five.vercel.app/create-job)** is viewable on the web, but to experiment with it and generate code, you will need to run it locally instead.

Note: Autocode is still early in development. Usage is a complex operation due to non-predictive form fields, and the results are limited by only allowing a small number of steps to be run.

To use the Autocode Native Interface, developers must follow these steps:

1. Clone the following repositories to their local machine:
   - [Autocode](https://github.com/emoryhubbard/autocode)
   - [Autocode Native](https://github.com/emoryhubbard/autocode-native)
   - [Express Autocode API](https://github.com/emoryhubbard/express-autocode-api)
   - Their own repository that they desire to modify

2. Run `npm run dev` on their React application to enable automatic reloading of file changes.

3. Configure the `.env` file and other areas in each repository to use the correct URLs and ports for their local servers.

4. Provide their own `serviceAccountKey.json` file for their Firebase account in the Express Autocode API repository and create a "features" collection.

5. Run Autocode and the Express server, and navigate to the create-job page.

6. Follow the prompts to add a new feature to their application.

7. Run the Autocode Native client, which automatically modifies the files in their repository to include the new feature and performs testing.

8. If any errors occur during the testing or debugging process, detailed information will be displayed in the console.

This application is developed using the following technologies and tools:

- **Angular 17.0:** The front-end of "Autocode" is built using the latest version of Angular, which now includes Angular SSR (Server-Side Rendering) as a fundamental part of the official Angular engine, deployed with Vercel.
- **Express Server:** The back-end REST API is served through an Express server instance deployed with Render.
- **TypeScript:** The majority of the source code is written in TypeScript, enhancing code maintainability and scalability.
- **Pupeteer:** As a headless browser automation library, Puppeteer is responsible for running the generated code and capturing debug information to send to Autocode's automated testing and debugging system.
- **Visual Studio Code (VS Code):** The development environment is Visual Studio Code, a powerful and extensible code editor.
- **ChatGPT API:** Autocode utilizes the ChatGPT API for prompt-based code generation. An API key is required for accessing ChatGPT services.
- **Node.js:** Both the front-end and back-end leverage Node.js for seamless JavaScript development.

## Oldest, Original Prototype: Autocode Classic

This Angular 17.0 application is a self-testing and self-debugging code generator named **[Autocode](https://autocode-five.vercel.app/)**.

Its primary goal is to improve the quality of code generation by incorporating a ChatGPT API for prompt-based JavaScript code creation. The generated code undergoes an automatic testing and debugging loop from [Autocode's Express API](https://github.com/emoryhubbard/express-autocode-api), ensuring that the output is already tested and verified.

**[Autocode Version 2.0 Demo Video](https://youtu.be/zm6YHLV1Dag)**

**[Autocode Version 1.0 Demo Video](https://youtu.be/Iq5_HaKzL6Y)**
