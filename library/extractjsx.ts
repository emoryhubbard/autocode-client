const acorn = require('acorn');
const jsx = require('acorn-jsx');

export function extractJSX(inputString: string): string {
    let code = '';
    let success = false;
    inputString = removeTripleBacktickLines(inputString);
    const lines = inputString.split('\n');
    for (let i=0; i<lines.length && !success; i++) {
        const lineIndex = getIndexOfLine(inputString, i+1);
        code = inputString.substring(lineIndex, inputString.length).trim();
        try {
            acorn.Parser.extend(jsx()).parse(code, {ecmaVersion: 'latest', sourceType: 'module'});
            success = true;
        } catch (e: any) {
            /*console.log("Line number: ", i+1);
            console.log("e.loc.line: ", e.loc.line);
            console.log("Line content: ", lines[i]);
            console.log("Value of E: ");
            console.log(e);*/
            if (e.message.includes("Unexpected token") && e.loc.line!=1
            && !lines[i].includes('```') && !isEmpty(lines[i])) {
                success = true;
                code = code.substring(0, e.pos);
                code = removeLastLine(code);
                code = removeTripleBackticks(code);
                code = code.trim();
            }
        }
    }
    if (success==false) {
        let internalError = "Error: there was no valid JSX found in the following text: " + inputString;
        console.log(internalError);
        throw new Error(internalError);
    }
    return code;
}
function isEmpty(inputString: string): boolean {
    // Use the trim method to remove leading and trailing whitespace characters
    const trimmedString = inputString.trim();

    // Return true if the trimmedString is empty
    return trimmedString === '';
}
function getIndexOfLine(inputString: string, lineNumber: number): number {
    const lines = inputString.split(/\r?\n/);
    let index = 0;
    
    for (let i = 0; i < lineNumber - 1; i++) {
        // Add the length of the current line plus 1 (for the newline character) to the index
        index += lines[i].length + 1;
    }
    
    return index;
}
function removeLastLine(str: string) {
    return str.replace(/\n[^\n]*$/, '');
}
function removeTripleBackticks(inputString: string): string {
    return inputString.replace(/```/g, '');
}

function removeTripleBacktickLines(inputString: string) {
    const lines = inputString.split('\n');
    for (let line of lines)
        if (line.includes('```'))
            lines.splice(lines.indexOf(line), 1)
    return lines.join('\n');
}
  
/*function needsTrimming(inputString: string) {
    return inputString.toLowerCase().includes('```javascript');
}
function trimToJS(inputString: string): string {
    const startMarker = '```javascript';
    const endMarker = '```';

    const startIndex = inputString.indexOf(startMarker);
    const endIndex = inputString.indexOf(endMarker, startIndex + startMarker.length);
    
    let code = '';
    if (startIndex !== -1 && endIndex !== -1) {
        code = inputString.substring(startIndex + startMarker.length, endIndex).trim();
    }
    return code;
}*/
