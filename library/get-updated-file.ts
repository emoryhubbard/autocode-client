import { compareTwoStrings, findBestMatch } from 'string-similarity';
import { Parser, Node, VariableDeclaration } from 'acorn';
import jsx from 'acorn-jsx';
const acorn = require("acorn");
const walk = require("acorn-walk");
const { extend } = require('acorn-jsx-walk');
import { simple as walkSimple, base as baseWalker } from 'acorn-walk';
const { ESLint } = require('eslint');

export function isPlaceholder(line: string): boolean {
    // Check for placeholders starting with //, /*, or {/* followed by rest, ..., or snip
    const regex1 = /^(\s*)(\/\/|\/\*|\{\/\*)(.*)(rest|\.\.\.|\. \. \.|snip)/i;

    // Check for placeholders starting with other characters followed by whitespace and rest, ..., or snip
    const regex2 = /[^'"](\s+)(rest|\.\.\.|\. \. \.|snip)(\s+)/i;

    if (regex1.test(line)) {
        return true;
    } else if (regex2.test(line)) {
        // Check if rest, ..., or snip is not enclosed in quotes or backticks
        const match = line.match(regex2);
        if (match && match[2]) {
            const sequence = match[2];
            const before = line.slice(0, match.index!);
            const after = line.slice(match.index! + match[0].length);
            const quoteRegex = /(['"`])(.*?)\1/;
            if (!quoteRegex.test(before) && !quoteRegex.test(after)) {
                return true;
            }
        }
    }
    return false;
}

export function stripPlaceholders(file: string) {
    // Split the input file into lines
    const lines = file.split('\n');
    
    // Filter out lines that are placeholders
    const cleanedLines = lines.filter((line) => {
        if (isPlaceholder(line))
            console.log("Removed placeholder: " + line);
        return !isPlaceholder(line);
    });
    
    // Join the cleaned lines back into a single string
    return cleanedLines.join('\n');
}

export function endsWithPlaceholder(file: string) {
    // Split the input file into lines
    const lines = file.split('\n');
    
    // Get the last line
    const lastLine = lines[lines.length - 1];
    
    // Check if the last line is a placeholder
    return isPlaceholder(lastLine);
}

export function closeWhenPlaceholder(file: string) {
    // Split the input file into lines
    const lines = file.split('\n');
    
    // Get the last line
    const lastLine = lines[lines.length - 1];
    
    // Check if the last line is a placeholder
    if (isPlaceholder(lastLine)) {
        lines[lines.length] = '}';
    }
    
    // Join the lines back into a single string
    return lines.join('\n');
}

export function getUpdatedFile(existingFile: string, codeSnippet: string): string {
    if (endsWithPlaceholder(codeSnippet))
        codeSnippet = closeWhenPlaceholder(codeSnippet);
    // Splitting input strings into lines
    const snippetLines: string[] = codeSnippet.split('\n');
    const existingLines: string[] = existingFile.split('\n');

    // Initialize guessdexedSnipLines array
    const guessdexedSnipLines: { line: string, guessdex: number, score: number,
        aboveReferences: number[], belowReferences: number[], nextPlaceholder: any}[] = [];

    // Populate guessdexedSnipLines array
    snippetLines.forEach((line, index) => {
        if (isPlaceholder(line)) {
            guessdexedSnipLines.push({ line, guessdex: -1, score: 0, aboveReferences: [], belowReferences: [], nextPlaceholder: null});
        } else {
            //const guessdex = findBestMatch(line, existingLines).bestMatchIndex;
            const guessdex = findBestMatchWithAST(index, existingFile, codeSnippet).bestMatchIndex;
            const score = compareNoCommon(line, existingLines[guessdex]);
            guessdexedSnipLines.push({ line, guessdex, score, aboveReferences: [], belowReferences: [], nextPlaceholder: null});
        }
    });

    // Iterate through placeholder lines to find reference lines
    const LINE_MATCH_THRESHOLD = .66;

    /*const tempPlaceholders: { line: string, guessdex: number, score: number,
        aboveReferences: number[], belowReferences: number[]}[] = [];*/
    
    function validReferenceLine(guessdexedSnipLine: any): boolean {
        return guessdexedSnipLine.guessdex !== -1
        && ( hasChar(guessdexedSnipLine.line) ||
            isUnique(existingLines[guessdexedSnipLine.guessdex], existingLines, snippetLines)
            || isUniqueClosingCurlyBrace(guessdexedSnipLines.indexOf(guessdexedSnipLine), existingFile, codeSnippet))
        && !hasSimpleCall(guessdexedSnipLine.line)
        && ( !hasSimpleCallWithArrow(guessdexedSnipLine.line) || hasUniqueSimpleCallWithArrow(codeSnippet) )
        && ( !isCommonHookEnd(guessdexedSnipLine.line) || hasUniqueSimpleCallWithArrow(codeSnippet) )
        && guessdexedSnipLine.score >= LINE_MATCH_THRESHOLD;
    }

    let nextPlaceholder: any;
    for (let i = guessdexedSnipLines.length - 1; i >= 0; i--) {
        const placeholderLine = guessdexedSnipLines[i];
        const index = i;

        if (placeholderLine.guessdex === -1) {
            let aboveReference: number | null = null;
            let belowReference: number | null = null;

            // Search above placeholder for reference line
            for (let i = index - 1; i >= 0; i--) {
                // Don't search for a reference line beyond another placeholder
                if (guessdexedSnipLines[i].guessdex == -1)
                    break;
                const guessdex = guessdexedSnipLines[i].guessdex;

                console.log("Testing " + guessdexedSnipLines[i].line + " with guessdex that indicates it is " + existingLines[guessdex] + " to see if it is unique: " + isUnique(existingLines[guessdex], existingLines, snippetLines) + " and if isUniqueClosingCurlyBrace: " + isUniqueClosingCurlyBrace(i, existingFile, codeSnippet));
                if (guessdexedSnipLines[i].guessdex !== -1
                    && ( hasChar(guessdexedSnipLines[i].line) || isUnique(existingLines[guessdex], existingLines, snippetLines) || isUniqueClosingCurlyBrace(i, existingFile, codeSnippet))
                    && !hasSimpleCall(guessdexedSnipLines[i].line)
                    && ( !hasSimpleCallWithArrow(guessdexedSnipLines[i].line) || hasUniqueSimpleCallWithArrow(codeSnippet) )
                    && ( !isCommonHookEnd(guessdexedSnipLines[i].line) || hasUniqueSimpleCallWithArrow(codeSnippet) )
                    && guessdexedSnipLines[i].score >= LINE_MATCH_THRESHOLD) {
                    if (aboveReference === null
                        || guessdexedSnipLines[i].score > guessdexedSnipLines[aboveReference].score) {
                        aboveReference = i;
                    }
                }
            }

            // Search below placeholder for reference line
            for (let i = index + 1; i < guessdexedSnipLines.length; i++) {
                // Don't search for a reference line beyond another placeholder
                if (guessdexedSnipLines[i].guessdex == -1)
                    break;
                const guessdex = guessdexedSnipLines[i].guessdex;

                console.log("Testing " + guessdexedSnipLines[i].line + " with guessdex that indicates it is " + existingLines[guessdex] + " to see if it is unique: " + isUnique(existingLines[guessdex], existingLines, snippetLines) + " and if isUniqueClosingCurlyBrace: " + isUniqueClosingCurlyBrace(i, existingFile, codeSnippet));
                if (guessdexedSnipLines[i].guessdex !== -1
                    && ( hasChar(guessdexedSnipLines[i].line) || isUnique(existingLines[guessdex], existingLines, snippetLines) || isUniqueClosingCurlyBrace(i, existingFile, codeSnippet))
                    && !hasSimpleCall(guessdexedSnipLines[i].line)
                    && ( !hasSimpleCallWithArrow(guessdexedSnipLines[i].line) || hasUniqueSimpleCallWithArrow(codeSnippet) )
                    && ( !isCommonHookEnd(guessdexedSnipLines[i].line) || hasUniqueSimpleCallWithArrow(codeSnippet) )
                    && guessdexedSnipLines[i].score >= LINE_MATCH_THRESHOLD) {
                    if (belowReference === null
                        || guessdexedSnipLines[i].score > guessdexedSnipLines[belowReference].score) {
                        belowReference = i;
                    }
                }
            }

            if (aboveReference !== null) {
                placeholderLine.aboveReferences.push(aboveReference);
            }

            if (belowReference !== null) {
                placeholderLine.belowReferences.push(belowReference);
            }

            // Check if references are enough to avoid redundancy
            /*if (placeholderLine.references.length === 0) {
                guessdexedSnipLines.splice(index, 1);
            }*/
            //tempPlaceholders.push(placeholderLine);

            if (nextPlaceholder)
                placeholderLine.nextPlaceholder = nextPlaceholder;
            nextPlaceholder = placeholderLine;
        }
    }
    console.log(guessdexedSnipLines);

    /*for (let i = 0; i<tempPlaceholders.length; i++) {
        if (i > 0) {
            if (tempPlaceholders[i].aboveReferences.length == 0
                && tempPlaceholders[i-1].belowReferences.length == 0) {
                    tempPlaceholders[i].
                }
        }
    }*/

    // Build newFile string
    let newFile = '';
    for (let i = 0; i < guessdexedSnipLines.length; i++) {
        let guessdexedSnipLine = guessdexedSnipLines[i];
        let guessdexedSnipLineIndex = i;
        let { line, guessdex, aboveReferences, belowReferences, nextPlaceholder: nextPlaceholder} = guessdexedSnipLine;
        function containsReturn(line: string): boolean {
            // Regular expression to match the word "return" not enclosed in quotes
            const returnRegex = /(?:^|\s)return(?:\s|;|$)/;
        
            // Trim whitespace from the line and test against the regex
            return returnRegex.test(line.trim());
        }
        if (guessdex === -1) { // Placeholder
            if (nextPlaceholder && belowReferences.length == 0
                && nextPlaceholder.aboveReferences.length == 0) {
                let aboveLines = '';
                const aboveIndex = aboveReferences[0];
                const belowIndex = nextPlaceholder.belowReferences[0];

                let start = aboveIndex !== undefined ? guessdexedSnipLines[aboveIndex].guessdex + 1 : 0;
                let newSnipStart = aboveIndex !== undefined ? aboveIndex + 2 : 0; /* Note it
                was originally + 1, but you need to go down 2 because if you go down one, 
                you just hit the placeholder, whereas in the existingLines since there is no
                placeholder at all, in fact a useful code line there, you want just + 1 as the line
                of code above shows*/

                if (aboveIndex !== undefined) {
                    for (let j = aboveIndex; j < guessdexedSnipLineIndex; j++) {
                        if (compareTwoStrings(guessdexedSnipLines[j].line, existingLines[guessdexedSnipLines[aboveIndex].guessdex + (j - aboveIndex)])
                            >= LINE_MATCH_THRESHOLD) {
                            start = guessdexedSnipLines[aboveIndex].guessdex + (j - aboveIndex) + 1;
                            newSnipStart = j + 1;
                        } else {
                            break;
                        }
                    }
                }
                //console.log("start is " + start);
                for (let j = start; !containsReturn(existingLines[j]); j++) {
                    aboveLines += existingLines[j] + '\n';
                }
                
                let belowLines = '';
                let end = belowIndex !== undefined ? guessdexedSnipLines[belowIndex].guessdex : existingLines.length - 1;
                let newSnipEnd = belowIndex !== undefined ? belowIndex - 1 : existingLines.length - 1; /* Note it
                was originally not - 1, but you need to go down 1 more because if you don't, 
                you wind up including the placeholder, because the belowIndex is where the reference
                line is (which is just one below the placeholder), whereas in the existingLines since
                there is no placeholder at all, in fact a useful code line there, you don't want - 1, so you don't
                miss it, as the line of code before shows. */
                
                if (belowIndex !== undefined) {
                    for (let j = belowIndex; j > guessdexedSnipLines.indexOf(nextPlaceholder); j--) {
                        if (compareTwoStrings(guessdexedSnipLines[j].line, existingLines[guessdexedSnipLines[belowIndex].guessdex - (belowIndex - j)])
                        >= LINE_MATCH_THRESHOLD) {
                            end = guessdexedSnipLines[belowIndex].guessdex - (belowIndex - j);
                            newSnipEnd = j;
                        } else {
                            break;
                        }
                    }
                }
                for (let j = end; ; j--) {
                    belowLines = existingLines[j] + '\n' + belowLines;
                    if (containsReturn(existingLines[j])) {
                        break;
                    }
                }
                /*console.log("The aboveLines: " + aboveLines);
                console.log("The belowLines: " + belowLines);*/
                newFile += aboveLines;
                let miniSnipLines = guessdexedSnipLines.slice(newSnipStart, newSnipEnd);
                miniSnipLines.forEach( ({ line }) => {
                    newFile += line + '\n';
                    //console.log("NewSnipLine: " + line);
                });
                newFile += belowLines;

                i = guessdexedSnipLines.indexOf(nextPlaceholder) + 1;
            }
            else if (aboveReferences.length > 0 || belowReferences.length > 0) {
                const aboveIndex = aboveReferences[0];
                const belowIndex = belowReferences[0];

                let start = aboveIndex !== undefined ? guessdexedSnipLines[aboveIndex].guessdex + 1 : 0;
                
                if (aboveIndex !== undefined) {
                    console.log("aboveIndex: " + " guessdexedSnipLineIndex: "
                            + guessdexedSnipLineIndex + " j (equal to aboveIndex the next two logs): "
                            + aboveIndex + " guessdexedSnipLines[j]: "
                            + guessdexedSnipLines[aboveIndex].line + " guessdexedSnipLines[j].score: "
                            + guessdexedSnipLines[aboveIndex].score);
                    for (let j = aboveIndex; j < guessdexedSnipLineIndex; j++) {
                        console.log("aboveIndex: " + " guessdexedSnipLineIndex: "
                            + guessdexedSnipLineIndex + " j: " + j + " guessdexedSnipLines[j]: "
                            + guessdexedSnipLines[j].line + " guessdexedSnipLines[j].score: "
                            + guessdexedSnipLines[j].score + " new start guessdexedSnipLines[aboveIndex].guessdex + (j - aboveIndex) + 1: "
                            + (guessdexedSnipLines[aboveIndex].guessdex + (j - aboveIndex) + 1));
                        if (compareTwoStrings(guessdexedSnipLines[j].line, existingLines[guessdexedSnipLines[aboveIndex].guessdex + (j - aboveIndex)])
                        >= LINE_MATCH_THRESHOLD) {
                            start = guessdexedSnipLines[aboveIndex].guessdex + (j - aboveIndex) + 1;
                        } else {
                            break;
                        }
                            
                    }
                }

                let end = belowIndex !== undefined ? guessdexedSnipLines[belowIndex].guessdex : existingLines.length - 1;
                
                if (belowIndex !== undefined) {
                    for (let j = belowIndex; j > guessdexedSnipLineIndex; j--) {
                        if (compareTwoStrings(guessdexedSnipLines[j].line, existingLines[guessdexedSnipLines[belowIndex].guessdex - (belowIndex - j)])
                        >= LINE_MATCH_THRESHOLD) {
                            end = guessdexedSnipLines[belowIndex].guessdex - (belowIndex - j);
                        } else {
                            break;
                        }
                    }
                }
                console.log("start: " + start + " end: " + end);
                let expansionLines = existingLines.slice(start, end);
                expansionLines.forEach( (line) => {
                    newFile += line + '\n';
                });
            } else {
                // If no references found, remove placeholder
                console.log("Removed placeholder (no references found)");
                newFile += '';
            }
        } else { // Non-placeholder
            newFile += line + '\n';
        }
    }
    newFile = stripPlaceholders(newFile);
    console.log("Updated file: " + newFile.trim());
    return newFile.trim(); // Remove trailing newline
}

function getAST(code: string): any {

            // Extend Acorn parser with JSX
            const acorn = require('acorn')
            const jsx = require('acorn-jsx')
            const parser = acorn.Parser.extend(jsx())
    
            // Create AST from source containing JSX
            const source = `
            import jsx from 'acorn-jsx'
            const a = 2
            const fn = () => {
                const el = <div>Hello world!</div>
                return el
            }
            `
           return parser.parse(code, {sourceType: 'module'})
    /*const parser = Parser.extend(jsx());
    return parser.parse(code, {
        sourceType: 'module', // Assuming ES modules
        ecmaVersion: 'latest', // Use the latest ECMAScript version
    });*/
}

function getFunctionOrStatementName(node: any): string | null {
    switch (node.type) {
        case 'FunctionDeclaration':
            return node.id ? node.id.name : null;
        case 'VariableDeclaration':
            return node.declarations[0].id.name;
        case 'FunctionExpression':
            return node.id ? node.id.name : null;
        default:
            return null;
    }
}

function logAST(ast: any) {
    console.log(JSON.stringify(ast, null, 2));
}

function getLineOffsets(source: string): number[] {
    const lineOffsets: number[] = [];
    let currentOffset = 0;

    source.split('\n').forEach((line) => {
        lineOffsets.push(currentOffset);
        currentOffset += line.length + 1; // +1 for the newline character
    });

    return lineOffsets;
}

function getLineNumberFromOffset(lineOffsets: number[], offset: number): number {
    for (let i = 0; i < lineOffsets.length; i++) {
        if (offset < lineOffsets[i]) {
            return i;
        }
    }
    return lineOffsets.length;
}

export async function ASTtest(existingFile: string, codeSnippet: string) {
        const eslint = new ESLint({
          baseConfig: {
            env: {
              browser: true,
              es2021: true,
            },
            extends: [
              'eslint:recommended',
              'plugin:react/recommended',
              'plugin:jsx-a11y/recommended',
            ],
            parserOptions: {
              ecmaFeatures: {
                jsx: true,
              },
              ecmaVersion: 12,
              sourceType: 'module',
            },
            plugins: ['react', 'react-hooks', 'jsx-a11y'],
            rules: {
              // Add your custom rules here
            },
            settings: {
              react: {
                version: 'detect',
              },
            },
          },
        });
      
        // Lint the code string
        const results = await eslint.lintText(existingFile);
        // Format the results
        const formatter = await eslint.loadFormatter('stylish');
        const resultText = formatter.format(results);

        // Output the results
        console.log(resultText);

    
                // Extend Acorn parser with JSX
        const acorn = require('acorn')
        const jsx = require('acorn-jsx')
        const parser = acorn.Parser.extend(jsx())

        // Extend Acorn walk with JSX
        const walk = require('acorn-walk')
        const { extend } = require('acorn-jsx-walk')

        extend(walk.base)

        // Create AST from source containing JSX
        const source = `
        import jsx from 'acorn-jsx'
        const a = 2
        const fn = () => {
            const el = <div>Hello world!</div>
            return el
        }
        `
        const ast = parser.parse(existingFile, {sourceType: 'module'})

        // Finally...
        walk.simple(ast, {
        JSXElement(node: any) {
            console.log(`Found a ${node.type}!`)
        },
        ImportDeclaration(node: any) {
            console.log('ImportDeclaration')
        },
        VariableDeclaration(node: any) {
            console.log("Inside variable declaration and the declaration start and end is " + node.start + " " + node.end);
        }
        })

    /*let acorn = require("acorn")
    let walk = require("acorn-walk")
    let acornJsx = require("acorn-jsx")

    let acornJsxParser = acorn.Parser.extend(acornJsx())
    let parsedJsx = acornJsxParser.parse(existingFile, {sourceType: 'module'})

    walk.simple(parsedJsx, {
        ImportDeclaration(node: any) {
          console.log('ImportDeclaration')
        }
      }, {
        ...walk.base,
        JSXElement: () => {}
      })*/
      

    /*let parser = Parser.extend(jsx());
    let ast =  parser.parse(existingFile, {
        sourceType: 'module', // Assuming ES modules
        ecmaVersion: 'latest', // Use the latest ECMAScript version
    });

    walkSimple(ast, {}, {
        ...walk.base,
        JSXElement: () => {},
        VariableDeclaration(node: any) {
            console.log("Inside variable declaration and the declaration start and end is " + node.start + " " + node.end);
        },
    });*/

}

/*function findNodeForLine(ast: any, lineNumber: number, lineOffsets: number[]): any | null {
    let foundNode: any = null;
    let prevRange = 9999;

    const customVisitors = {
        JSXElement: () => {},
        FunctionDeclaration(node: any) {
            const startLine = getLineNumberFromOffset(lineOffsets, node.start);
            const endLine = getLineNumberFromOffset(lineOffsets, node.end);
            if (startLine <= lineNumber && endLine >= lineNumber
                && ((node.end - node.start) < prevRange)) {
                prevRange = node.end - node.start;
                foundNode = node;
            }
        },
        VariableDeclaration(node: any) {
            const startLine = getLineNumberFromOffset(lineOffsets, node.start);
            const endLine = getLineNumberFromOffset(lineOffsets, node.end);
            if (startLine <= lineNumber && endLine >= lineNumber
                && ((node.end - node.start) < prevRange)) {
                prevRange = node.end - node.start;
                foundNode = node;
            }
        },
        FunctionExpression(node: any) {
            const startLine = getLineNumberFromOffset(lineOffsets, node.start);
            const endLine = getLineNumberFromOffset(lineOffsets, node.end);
            if (startLine <= lineNumber && endLine >= lineNumber
                && ((node.end - node.start) < prevRange)) {
                prevRange = node.end - node.start;
                foundNode = node;
            }
        },
        ArrowFunctionExpression(node: any) {
            console.log("Inside arrow function expression, testing line number " + lineNumber + ", and the expression's start and end is " + node.start + " " + node.end);
            const startLine = getLineNumberFromOffset(lineOffsets, node.start);
            const endLine = getLineNumberFromOffset(lineOffsets, node.end);
            if (startLine <= lineNumber && endLine >= lineNumber
                && ((node.end - node.start) < prevRange)) {
                prevRange = node.end - node.start;
                foundNode = node;
            }
        },
    };

    // Call walkSimple with the AST, custom visitors, and the base visitors
    walkSimple(ast, customVisitors, walk.base);

    return foundNode;
}*/

function findNodeForLine(ast: any, lineNumber: number, lineOffsets: number[]): any | null {
    let foundNode: any = null;
    let prevRange = 9999;

    
    // Extend Acorn walk with JSX
    const walk = require('acorn-walk')
    const { extend } = require('acorn-jsx-walk')

    extend(walk.base)

    // Finally...
    walk.simple(ast, {
    JSXElement(node: any) {
    },
    VariableDeclaration(node: any) {
        console.log("Inside variable declaration, testing line number " + lineNumber + ", and the declaration start and end is " + node.start + " " + node.end);
        const startLine = getLineNumberFromOffset(lineOffsets, node.start);
        const endLine = getLineNumberFromOffset(lineOffsets, node.end);
        if (startLine <= lineNumber && endLine >= lineNumber
            && ((node.end - node.start) < prevRange)) {
            prevRange = node.end - node.start;
            foundNode = node;
        }
    },
    FunctionDeclaration(node: any) {
        console.log("Inside function declaration, testing line number " + lineNumber + ", and the declaration start and end is " + node.start + " " + node.end);
        const startLine = getLineNumberFromOffset(lineOffsets, node.start);
        const endLine = getLineNumberFromOffset(lineOffsets, node.end);
        if (startLine <= lineNumber && endLine >= lineNumber
            && ((node.end - node.start) < prevRange)) {
            prevRange = node.end - node.start;
            foundNode = node;
        }
    }
    })

    /*walkSimple(ast, {}, {
        ...walk.base,
        JSXElement: () => {},
        FunctionDeclaration(node: any) {
            console.log("Inside function declaration, testing line number " + lineNumber + ", and the declaration start and end is " + node.start + " " + node.end);
            const startLine = getLineNumberFromOffset(lineOffsets, node.start);
            const endLine = getLineNumberFromOffset(lineOffsets, node.end);
            if (startLine <= lineNumber && endLine >= lineNumber
                && ((node.end - node.start) < prevRange)) {
                prevRange = node.end - node.start;
                foundNode = node;
            }
        },
        VariableDeclaration(node: any) {
            console.log("Inside variable declaration, testing line number " + lineNumber + ", and the declaration start and end is " + node.start + " " + node.end);
            const startLine = getLineNumberFromOffset(lineOffsets, node.start);
            const endLine = getLineNumberFromOffset(lineOffsets, node.end);
            if (startLine <= lineNumber && endLine >= lineNumber
                && ((node.end - node.start) < prevRange)) {
                prevRange = node.end - node.start;
                foundNode = node;
            }
        },
        FunctionExpression(node: any) {
            const startLine = getLineNumberFromOffset(lineOffsets, node.start);
            const endLine = getLineNumberFromOffset(lineOffsets, node.end);
            if (startLine <= lineNumber && endLine >= lineNumber
                && ((node.end - node.start) < prevRange)) {
                prevRange = node.end - node.start;
                foundNode = node;
            }
        },
        ArrowFunctionExpression(node: any) {
            console.log("Inside arrow function expression, testing line number " + lineNumber + ", and the expressions start and end is " + node.start + " " + node.end);
            const startLine = getLineNumberFromOffset(lineOffsets, node.start);
            const endLine = getLineNumberFromOffset(lineOffsets, node.end);
            if (startLine <= lineNumber && endLine >= lineNumber
                && ((node.end - node.start) < prevRange)) {
                prevRange = node.end - node.start;
                foundNode = node;
            }
        },
    });*/

    /*walkSimple(ast, {}, {
        ...walk.base,
        JSXElement: () => {},
        ArrowFunctionExpression(node: any) {
            console.log("Inside arrow function expression, testing line number " + lineNumber + ", and the expressions start and end is " + node.start + " " + node.end);
            const startLine = getLineNumberFromOffset(lineOffsets, node.start);
            const endLine = getLineNumberFromOffset(lineOffsets, node.end);
            if (startLine <= lineNumber && endLine >= lineNumber
                && ((node.end - node.start) < prevRange)) {
                prevRange = node.end - node.start;
                foundNode = node;
            }
        },
    });*/

    return foundNode;
}

function findBestMatchWrapper(mainString: string, targetStrings: string[]): { bestMatchIndex: number } {
    const { bestMatchIndex, bestMatch } = findBestMatch(mainString, targetStrings);
    return { bestMatchIndex };
}

export function findBestMatchWithAST(codeSnippetLineIndex: number, existingFile: string, codeSnippet: string): { bestMatchIndex: number } {
    const snippetLines = codeSnippet.split('\n');
    const existingFileLines = existingFile.split('\n');
    const mainString = snippetLines[codeSnippetLineIndex];

    if (/*!mainString.includes('{') &&*/ !mainString.includes('}')) {
        // No curly brace, use regular findBestMatch
        return findBestMatchWrapper(mainString, existingFileLines);
    }

    const codeSnippetAST = getAST(codeSnippet);
    const existingFileAST = getAST(existingFile);

    /*console.log('Code Snippet AST:');
    logAST(codeSnippetAST);
    console.log('Existing File AST:');
    logAST(existingFileAST);
    let test = null;
    if (!test)
        process.exit(0);*/

    const snippetNode = findNodeForLine(codeSnippetAST, codeSnippetLineIndex + 1, getLineOffsets(codeSnippet)); // +1 because lines are 1-indexed in loc
    const snippetNodeName = snippetNode ? getFunctionOrStatementName(snippetNode) : null;

    if (!snippetNodeName) {
        console.log("Couldn't find snippet node for " + mainString);
        return findBestMatch(mainString, existingFileLines);
    }

    let bestMatchIndex = -1;
    let bestMatchScore = 0;

    for (let i = 0; i < existingFileLines.length; i++) {
        const existingNode = findNodeForLine(existingFileAST, i + 1, getLineOffsets(existingFile));
        const existingNodeName = existingNode ? getFunctionOrStatementName(existingNode) : null;

        if (snippetNodeName === existingNodeName) {
            const score = compareTwoStrings(mainString, existingFileLines[i]);
            if (score > bestMatchScore) {
                bestMatchScore = score;
                bestMatchIndex = i;
            }
        }
    }

    if (bestMatchIndex !== -1) {
        console.log("Returning bestMatchIndex for " + mainString);
        return { bestMatchIndex };
    }

    return findBestMatch(mainString, existingFileLines);
}

export function isUniqueClosingCurlyBrace(codeSnippetLineIndex: number, existingFile: string, codeSnippet: string): boolean {
    const snippetLines = codeSnippet.split('\n');
    const existingFileLines = existingFile.split('\n');
    const mainString = snippetLines[codeSnippetLineIndex];

    if (/*!mainString.includes('{') &&*/ !mainString.includes('}')) {
        // No curly brace, use regular findBestMatch
        return false;
    }

    const codeSnippetAST = getAST(codeSnippet);
    const existingFileAST = getAST(existingFile);

    /*console.log('Code Snippet AST:');
    logAST(codeSnippetAST);
    console.log('Existing File AST:');
    logAST(existingFileAST);
    let test = null;
    if (!test)
        process.exit(0);*/

    const snippetNode = findNodeForLine(codeSnippetAST, codeSnippetLineIndex + 1, getLineOffsets(codeSnippet)); // +1 because lines are 1-indexed in loc
    const snippetNodeName = snippetNode ? getFunctionOrStatementName(snippetNode) : null;
    console.log("SnippetNodeName for " + mainString + ": " + snippetNodeName);

    if (!snippetNodeName) {
        console.log("Couldn't find snippet node for " + mainString);
        return false;
    }

    for (let i = 0; i < existingFileLines.length; i++) {
        const existingNode = findNodeForLine(existingFileAST, i + 1, getLineOffsets(existingFile));
        const existingNodeName = existingNode ? getFunctionOrStatementName(existingNode) : null;

        if (snippetNodeName === existingNodeName) {
            return true;
        }
    }

    return false;
}

function hasPlaceholderCommentInside(node: any, comments: any[]): boolean {
    for (const comment of comments) {
        if (comment.start > node.start && comment.end < node.end) {
            if (isPlaceholder('// ' + comment.value)) {
                return true;
            }
        }
    }
    return false;
}

export function hasUniqueSimpleCallWithArrow(codeSnippet: string): boolean {
    // Initialize Acorn parser with JSX support
    const parser = Parser.extend(jsx());

    // Parse the file contents
    const comments: any[] = [];
    const ast = parser.parse(codeSnippet, {
        sourceType: 'module', // Assuming ES modules
        ecmaVersion: 'latest', // Use latest ECMAScript version
        onComment: comments
    });

    // Helper function to check if a node is a simple arrow function call
    function isSimpleCallWithArrow(node: any): boolean {
        return node.type === 'CallExpression' &&
               node.arguments.length > 0 &&
               node.arguments[0].type === 'ArrowFunctionExpression';
    }

    let found = false;

    // Traverse the AST to look for call expressions with arrow functions
    walk.simple(ast, {
        CallExpression(node: any) {
            if (isSimpleCallWithArrow(node) && hasPlaceholderCommentInside(node.arguments[0].body, comments)) {
                found = true;
            }
        }
    });

    return found;
}

function isCommonHookEnd(line: string): boolean {
    // Trim the input line to remove leading and trailing whitespace
    const trimmedLine = line.trim();

    // Check if the trimmed line contains the exact sequence "}, []);"
    return trimmedLine === '}, []);' || trimmedLine === '}, [])';
}

function hasChar(input: string): boolean { return /[a-zA-Z0-9]/.test(input); }

export function isUnique(line: string, lines: string[], otherLines: string[]): boolean {
    line = line.trim();

    if (line.trim() === '') {
        return false; // Treat empty or whitespace-only lines as not unique
    }
    const count = lines.filter(l => l.trim() == line).length;
    const count2 = otherLines.filter(l => l.trim() == line).length;
    return count === 1 && count2 === 1;
}
export function hasSimpleCall(codeLine: string): boolean {
    // Trim whitespace from the input line
    const trimmedLine = codeLine.trim();

    // Regular expression to match a simple function call pattern
    const simpleCallPattern = /^[a-zA-Z_$][a-zA-Z0-9_$]*\(\)\s*;?$/;

    return simpleCallPattern.test(trimmedLine);
}

export function hasSimpleCallWithArrow(codeLine: string): boolean {
    // Trim whitespace from the input line
    const trimmedLine = codeLine.trim();

    // Regular expression to match a function call with arrow function pattern
    const arrowCallPattern = /^[a-zA-Z_$][a-zA-Z0-9_$]*\(\s*\(\s*\)\s*=>\s*\{\s*$/;

    return arrowCallPattern.test(trimmedLine);
}

function stripCommonKeywords(line: string): string {
    // List of common keywords to remove
    const commonKeywords = ['const', 'let', 'if\\s*\\(', 'if', 'function', 'return'];

    // Combine keywords into a regex pattern
    const keywordsPattern = new RegExp(`\\b(${commonKeywords.join('|')})\\b`, 'g');

    // Remove common keywords
    line = line.replace(keywordsPattern, '');

    return line;
}

function cleanLine(line: string): string {
    // Trim whitespace at the beginning and end
    // line = line.trim();

    // Remove trailing semicolon
    line = line.replace(/;$/, '');

    // Remove comments that are not at the start
    if (!line.startsWith('//')) {
        line = line.replace(/\/\/.*$/, '');
    }

    return line;
}

export function stripInnerWhitespace(input: string): string {
    // Use regex to match and remove all inner whitespace
    const trimmedInput = input.trim();
    const innerStripped = trimmedInput.replace(/\s+/g, '');

    // Extract leading and trailing whitespace
    const leadingWhitespace = input.match(/^\s*/)?.[0] || '';
    const trailingWhitespace = input.match(/\s*$/)?.[0] || '';

    // Combine the preserved whitespace with the stripped inner content
    return `${leadingWhitespace}${innerStripped}${trailingWhitespace}`;
}

export function compareNoCommon(line1: string, line2: string): number {
    // Strip common keywords
    line1 = stripCommonKeywords(line1);
    line2 = stripCommonKeywords(line2);

    // Clean the lines
    line1 = cleanLine(line1);
    line2 = cleanLine(line2);

    line1 = stripInnerWhitespace(line1);
    line2 = stripInnerWhitespace(line2);

    // Compare the cleaned lines
    return compareTwoStrings(line1, line2);
}
