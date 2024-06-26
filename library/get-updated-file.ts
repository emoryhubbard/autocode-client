import { compareTwoStrings, findBestMatch } from 'string-similarity';
import { Parser, Node, VariableDeclaration } from 'acorn';
import jsx from 'acorn-jsx';
const acorn = require("acorn");
const walk = require("acorn-walk");
const { extend } = require('acorn-jsx-walk');
import { simple as walkSimple, base as baseWalker } from 'acorn-walk';
const { ESLint } = require('eslint');
import glob from 'glob';
import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';
import DiffMatchPatch from 'diff-match-patch';
import { Diff } from 'diff-match-patch';
import { diffChars } from 'diff';

const readFile = util.promisify(fs.readFile);

export function isPlaceholder(line: string): boolean {
    // Check for placeholders starting with //, /*, or {/* followed by rest, ..., or snip
    const regex1 = /^(\s*)(\/\/|\/\*|\{\/\*)(.*)(rest|\.\.\.|\. \. \.|snip|placeholder)/i;

    // Check for placeholders starting with other characters followed by whitespace and rest, ..., or snip
    const regex2 = /[^'"](\s+)(rest|\.\.\.|\. \. \.|snip|placeholder)(\s+)/i;

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

export async function getUpdatedFile(existingFile: string, codeSnippet: string, filePath: string): Promise<string> {
    if (endsWithPlaceholder(codeSnippet)) 
        codeSnippet = closeWhenPlaceholder(codeSnippet);

    const missingPlaceholders = await getMissingPlaceholders(existingFile, codeSnippet);
    if (missingPlaceholders.length > 0) {
        let modifiedCodeSnippet = codeSnippet;
        let lineIndexOffset = 0;
    
        for (const lineIndex of missingPlaceholders) {
            const adjustedLineIndex = lineIndex + lineIndexOffset;
            modifiedCodeSnippet = insertPlaceholder(modifiedCodeSnippet, adjustedLineIndex);
            lineIndexOffset++;
        }
    
        console.log("Added placeholders: " + modifiedCodeSnippet);
        codeSnippet = modifiedCodeSnippet;
    }

    /*const missingPlaceholder = detectMissingPlaceholder(existingFile, codeSnippet);
    if (missingPlaceholder != null) {
        codeSnippet = insertPlaceholder(codeSnippet, missingPlaceholder.lineIndex);
        console.log("Added placeholder: " + codeSnippet);
    }*/

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
            || isUniqueClosingCurlyBrace(guessdexedSnipLines.indexOf(guessdexedSnipLine), existingFile, codeSnippet) )
        && ( !hasSimpleCall(guessdexedSnipLine.line) || isUnique(existingLines[guessdexedSnipLine.guessdex], existingLines, snippetLines) )
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
                    && ( !hasSimpleCall(guessdexedSnipLines[i].line) || isUnique(existingLines[guessdex], existingLines, snippetLines) )
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
                    && ( !hasSimpleCall(guessdexedSnipLines[i].line) || isUnique(existingLines[guessdex], existingLines, snippetLines) )
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
    if (process.env.KEEP_IMPORTS == "true") {
        newFile = stripUse(newFile);
        newFile = stripImports(newFile);
        newFile = ((process.env.CORRECT_IMPORTS == "true" ?
            await correctImports(joinImports(existingFile, codeSnippet), filePath):
            joinImports(existingFile, codeSnippet))) + '\n' + newFile;
        newFile = joinUse(existingFile, codeSnippet) + '\n' + newFile;
    }

    console.log("Updated file: " + newFile.trim());
    return newFile.trim(); // Remove trailing newline
}

function insertPlaceholder(codeSnippet: string, lineIndex: number): string {
    const lines = codeSnippet.split('\n');
    const placeholderLine = `// rest of code goes here`;

    lines.splice(lineIndex, 0, placeholderLine);
    return lines.join('\n');
}

/*export function insertPlaceholder(codeSnippet: string, index: number): string {
    const lines = codeSnippet.split('\n');
    
    // Ensure the index is within the valid range
    if (index < 0 || index > lines.length) {
        console.log("insertPlaceholder index: " + index);
        throw new Error('Index out of bounds');
    }
    
    // Insert the placeholder at the specified index
    lines.splice(index, 0, '// rest of code goes here');
    
    // Join the lines back into a single string
    return lines.join('\n');
}*/

export async function getMissingPlaceholders(existingFile: string, codeSnippet: string): Promise<number[]> {
    // Initialize the line tracker with the original line indices
    let lineTracker: number[] = Array.from(Array(codeSnippet.split('\n').length).keys());
    console.log("lineTracker at start: " + lineTracker);
    // Helper function to get the original line index from the line tracker
    function getOriginalIndex(lineIndex: number, lineTracker: number[]): number {
        return lineTracker.indexOf(lineIndex);
    }

    // Helper function to update the line tracker after removing a line
    function updateLineTracker(removedLineIndex: number, lineTracker: number[]): number[] {
        const originalIndex = getOriginalIndex(removedLineIndex, lineTracker);
        lineTracker[originalIndex] = -1;

        for (let i = originalIndex + 1; i < lineTracker.length; i++) {
            if (lineTracker[i] !== -1) {
                lineTracker[i]--;
            }
        }
        console.log("lineTracker modified: " + lineTracker);
        return lineTracker;
    }

    function stripBlankLines(input: string, lineTracker: number[]): string {
        console.log("Stripping blank lines");
        const lines = input.split('\n');
        const nonBlankLines = lines.filter((line, lineIndex) => {
            if (line.trim().length === 0) {
                lineTracker = updateLineTracker(lineIndex, lineTracker);
                return false;
            }
            return true;
        });
        return nonBlankLines.join('\n');
    }

    function stripWhitespace(input: string, lineTracker: number[]): string {
        const lines = input.split('\n');
        const trimmedLines = lines.map(line => line.trim());
        return trimmedLines.join('\n');
    }

    function stripUse(file: string, lineTracker: number[]): string {
        console.log("Strippping use lines");
        const lines = file.split('\n');
        let useDirectiveRemoved = false;

        const strippedLines = lines.filter((line, lineIndex) => {
            if (!useDirectiveRemoved) {
                const trimmedLine = line.trim();
                if (trimmedLine.startsWith("'use ") || trimmedLine.startsWith('"use ')) {
                    useDirectiveRemoved = true;
                    console.log("Found line that starts with use");
                    lineTracker = updateLineTracker(lineIndex, lineTracker);
                    return false;
                }
            }
            return true;
        });
        if (!useDirectiveRemoved)
            console.log("Didn't find line that starts with use");

        return strippedLines.join('\n');
    }

    function stripImports(file: string, lineTracker: number[]): string {
        console.log("Stripping imports");
        const lines = file.split('\n');
        let importSectionEnded = false;

        const strippedLines = lines.filter((line, lineIndex) => {
            // If the import section has already ended, keep the line
            if (importSectionEnded) {
                return true;
            }
            // Check if the line is an import statement
            if (line.trim().startsWith('import ')) {
                lineTracker = updateLineTracker(lineIndex, lineTracker);
                return false;
            }
            // If it's not an import statement and not a blank line, mark the end of the import section
            importSectionEnded = true;
            return true;
        });

        return strippedLines.join('\n');
    }

    // Pre-process the input strings by stripping use directives, imports, blank lines, and trimming whitespace
    const processedCodeSnippet = stripWhitespace(stripBlankLines(stripImports(stripUse(codeSnippet, lineTracker), lineTracker), lineTracker), lineTracker);
    console.log("Backing up lineTracker: " + lineTracker);
    let lineTrackerBackup = [...lineTracker];
    const processedExistingFile = stripWhitespace(stripBlankLines(stripImports(stripUse(existingFile, lineTracker), lineTracker), lineTracker), lineTracker);
    lineTracker = lineTrackerBackup

    // Get the largest matches
    const matches = await getLargestMatchesDiffLib(processedExistingFile, processedCodeSnippet, 6);

    console.log("Matches: ");
    for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        /*console.log("Match start1: " + match.start1 + " end1: " + match.end1 + " start2: "
            + match.start2 + " end2: " + match.end2);*/
        let loggedSnippet = processedCodeSnippet;
        loggedSnippet = loggedSnippet.slice(0, match.start2) + 'MATCH_' + i + '_START' + loggedSnippet.slice(match.start2);
        console.log("Match start relative to pre-processed codeSnippet: " + loggedSnippet);
        loggedSnippet = processedCodeSnippet;
        loggedSnippet = loggedSnippet.slice(0, match.end2) + 'MATCH_' + i + '_END'+ loggedSnippet.slice(match.end2);
        console.log("Match end relative to pre-processed codeSnippet: " + loggedSnippet);
    }

    function isClosingCurlyBrace(lineIndex: number, processedCodeSnippet: string): boolean {
        let lines = processedCodeSnippet.split('\n');
        return lines[lineIndex].trim() == '}';
    }

    function getLine(input: string, charIndex: number): number {
        if (charIndex < 0 || charIndex > input.length) {
            throw new Error("Character index out of bounds");
        }
        
        const lines = input.split('\n');
        let currentCharIndex = 0;
    
        for (let i = 0; i < lines.length; i++) {
            currentCharIndex += lines[i].length + 1; // +1 for the newline character
            if (charIndex < currentCharIndex) {
                return i;
            }
        }
    
        return -1; // Should not reach here if charIndex is valid
    }

    // Filter out matches that consist of a non-unique closing curly brace
    const filteredMatches = matches.filter(
        (match) =>
            isUniqueClosingCurlyBrace(
                getLine(processedCodeSnippet, match.start2),
                processedExistingFile,
                processedCodeSnippet
            ) || !isClosingCurlyBrace(getLine(processedCodeSnippet, match.start2), processedCodeSnippet)
    );

    const missingPlaceholders: number[] = [];

    console.log("Filtered matches: " + filteredMatches.length);
    console.log("Final lineTracker: " + lineTracker);

    // Check for missing placeholders between matches
    for (let i = 0; i < filteredMatches.length - 2; i++) {
        const currentMatch = filteredMatches[i];
        const nextMatch = filteredMatches[i + 1];

        const currentMatchEndLine = getLine(processedCodeSnippet, currentMatch.end2);
        const nextMatchStartLine = getLine(processedCodeSnippet, nextMatch.start2);

        console.log("CurrentMatchEndLine: " + currentMatchEndLine);
        console.log("NextMatchStartLine: " + nextMatchStartLine);

        let placeholderFound = false;
        for (let j = currentMatchEndLine + 1; j < nextMatchStartLine; j++) {
            console.log("Checking the following line for a placeholder: " + processedCodeSnippet.split('\n')[j]);
            if (isPlaceholder(processedCodeSnippet.split('\n')[j])) {
                placeholderFound = true;
                console.log("Placeholder found in line");
                break;
            } else {console.log("Placeholder not found in line");}
        }

        if (!placeholderFound) {
            //const lineDifference = lineDifferenceCodeSnippet - lineDifferenceExistingFile;
            console.log("Missing placeholder to be inserted at line " + nextMatchStartLine );
            const lineIndex = getOriginalIndex(nextMatchStartLine, lineTracker);
            //const lineIndex = getOriginalIndex((nextMatchStartLine - 1), lineTracker);
            console.log("Missing placeholder to be inserted at line " + lineIndex
                + " relative to original codeSnippet");
            console.log("Original codeSnippet: " + codeSnippet);
            console.log("Processed codeSnippet: " + processedCodeSnippet);
            missingPlaceholders.push(lineIndex);
        }

        /*if (!isPlaceholder(processedCodeSnippet.split('\n')[nextMatchStartLine - 1])) {
            //const lineDifference = lineDifferenceCodeSnippet - lineDifferenceExistingFile;
            console.log("Missing placeholder to be inserted at line " + nextMatchStartLine );
            const lineIndex = getOriginalIndex(nextMatchStartLine, lineTracker);
            //const lineIndex = getOriginalIndex((nextMatchStartLine - 1), lineTracker);
            console.log("Missing placeholder to be inserted at line " + lineIndex
                + " relative to original codeSnippet");
            console.log("Original codeSnippet: " + codeSnippet);
            console.log("Processed codeSnippet: " + processedCodeSnippet);
            missingPlaceholders.push(lineIndex);
        }*/
    }

    return missingPlaceholders;
}

export function getMissingPlaceholdersIntegrated(existingFile: string, codeSnippet: string): number[] {
    // Function to calculate the number of lines difference after stripping
    const calculateLineDifference = (original: string, stripped: string): number => {
        const originalLines = original.split('\n').length;
        const strippedLines = stripped.split('\n').length;
        return originalLines - strippedLines;
    };


    function stripBlankLines(input: string): string {
        const lines = input.split('\n');
        const nonBlankLines = lines.filter(line => line.trim().length > 0);
        return nonBlankLines.join('\n');
    }
    
    function stripWhitespace(input: string): string {
        const lines = input.split('\n');
        const trimmedLines = lines.map(line => line.trim());
        return trimmedLines.join('\n');
    }

    function stripUse(file: string) {
        const lines = file.split('\n');
        let useDirectiveRemoved = false;
    
        const strippedLines = lines.filter(line => {
            if (!useDirectiveRemoved) {
                const trimmedLine = line.trim();
                if (trimmedLine.startsWith("'use ") || trimmedLine.startsWith('"use ')) {
                    useDirectiveRemoved = true;
                    console.log("Found line that starts with use");
                    return false;
                }
            }
            return true;
        });
        if (!useDirectiveRemoved)
            console.log("Didn't find line that starts with use");
    
        return strippedLines.join('\n');
    }
    
    function stripImports(file: string) {
        const lines = file.split('\n');
        let importSectionEnded = false;
    
        const strippedLines = lines.filter(line => {
            // If the import section has already ended, keep the line
            if (importSectionEnded) {
                return true;
            }
            // Check if the line is an import statement
            if (line.trim().startsWith('import ')) {
                return false;
            }
            // Check if the line is a blank line
            if (line.trim() === '') {
                return false;
            }
            // If it's not an import statement and not a blank line, mark the end of the import section
            importSectionEnded = true;
            return true;
        });
    
        return strippedLines.join('\n');
    }

    // Pre-process the input strings by stripping use directives, imports, blank lines, and trimming whitespace
    const processedExistingFile = stripWhitespace(stripBlankLines(stripImports(stripUse(existingFile))));
    const processedCodeSnippet = stripWhitespace(stripBlankLines(stripImports(stripUse(codeSnippet))));

    // Calculate line differences
    const lineDifferenceExistingFile = calculateLineDifference(existingFile, processedExistingFile);
    const lineDifferenceCodeSnippet = calculateLineDifference(codeSnippet, processedCodeSnippet);

    // Get the largest matches
    const matches = getLargestMatches(processedExistingFile, processedCodeSnippet, 6);

    console.log("Matches: ");
    for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        /*console.log("Match start1: " + match.start1 + " end1: " + match.end1 + " start2: "
            + match.start2 + " end2: " + match.end2);*/
        let loggedSnippet = processedCodeSnippet;
        loggedSnippet = loggedSnippet.slice(0, match.start2) + 'MATCH_' + i + '_START' + loggedSnippet.slice(match.start2);
        console.log("Match start relative to pre-processed codeSnippet: " + loggedSnippet);
        loggedSnippet = processedCodeSnippet;
        loggedSnippet = loggedSnippet.slice(0, match.end2) + 'MATCH_' + i + '_END'+ loggedSnippet.slice(match.end2);
        console.log("Match end relative to pre-processed codeSnippet: " + loggedSnippet);
    }

    function isClosingCurlyBrace(lineIndex: number, processedCodeSnippet: string): boolean {
        let lines = processedCodeSnippet.split('\n');
        return lines[lineIndex].trim() == '}';
    }
    
    function getLine(input: string, charIndex: number): number {
        if (charIndex < 0 || charIndex > input.length) {
            throw new Error("Character index out of bounds");
        }
        
        const lines = input.split('\n');
        let currentCharIndex = 0;
    
        for (let i = 0; i < lines.length; i++) {
            currentCharIndex += lines[i].length + 1; // +1 for the newline character
            if (charIndex < currentCharIndex) {
                return i;
            }
        }
    
        return -1; // Should not reach here if charIndex is valid
    }

    // Filter out matches that consist of a non-unique closing curly brace
    const filteredMatches = matches.filter(
        (match) =>
            isUniqueClosingCurlyBrace(
                getLine(processedCodeSnippet, match.start2),
                processedExistingFile,
                processedCodeSnippet
            ) || !isClosingCurlyBrace(getLine(processedCodeSnippet, match.start2), processedCodeSnippet)
    );

    const missingPlaceholders: number[] = [];
    
    console.log("Filtered matches: " + filteredMatches.length);

    // Check for missing placeholders between matches
    for (let i = 0; i < filteredMatches.length - 2; i++) {
        const currentMatch = filteredMatches[i];
        const nextMatch = filteredMatches[i + 1];

        const currentMatchEndLine = getLine(processedCodeSnippet, currentMatch.end2);
        const nextMatchStartLine = getLine(processedCodeSnippet, nextMatch.start2);

        if (!isPlaceholder(processedCodeSnippet.split('\n')[nextMatchStartLine - 1])) {
            //const lineDifference = lineDifferenceCodeSnippet - lineDifferenceExistingFile;
            console.log("Missing placeholder to be inserted at line " + nextMatchStartLine );
            const lineIndex = nextMatchStartLine + lineDifferenceCodeSnippet;
            console.log("Missing placeholder to be inserted at line " + lineIndex
            + " relative to original codeSnippet");
            console.log("Original codeSnippet: " + codeSnippet);
            console.log("Processed codeSnippet: " + processedCodeSnippet);
            missingPlaceholders.push(lineIndex);
        }
    }

    return missingPlaceholders;
}

export function getMissingPlaceholdersLineDiffAttempt(existingFile: string, codeSnippet: string): number[] {
    // Pre-process the input strings by stripping use directives, imports, blank lines, and trimming whitespace
    const processedExistingFile = stripWhitespace(stripBlankLines(stripImports(stripUse(existingFile))));
    const processedCodeSnippet = preProcessCodeSnippet(codeSnippet);

    // Get the largest matches
    const matches = getLargestMatches(processedExistingFile, processedCodeSnippet.code, 6);

    console.log("Matches: ");
    for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        /*console.log("Match start1: " + match.start1 + " end1: " + match.end1 + " start2: "
            + match.start2 + " end2: " + match.end2);*/
        let loggedSnippet = processedCodeSnippet.lines.join('\n');
        loggedSnippet = loggedSnippet.slice(0, match.start2) + 'MATCH_' + i + '_START' + loggedSnippet.slice(match.start2);
        console.log("Match start relative to pre-processed codeSnippet: " + loggedSnippet);
        loggedSnippet = processedCodeSnippet.lines.join('\n');
        loggedSnippet = loggedSnippet.slice(0, match.end2) + 'MATCH_' + i + '_END'+ loggedSnippet.slice(match.end2);
        console.log("Match end relative to pre-processed codeSnippet: " + loggedSnippet);
    }

    // Filter out matches that consist of a non-unique closing curly brace
    const filteredMatches = matches.filter(
        (match) =>
            isUniqueClosingCurlyBrace(
                getLine(processedCodeSnippet.code, match.start2),
                processedExistingFile,
                processedCodeSnippet.code
            ) || !isClosingCurlyBrace(getLine(processedCodeSnippet.code, match.start2), processedCodeSnippet.code)
    );

    const missingPlaceholders: number[] = [];
    console.log("Filtered matches: " + filteredMatches.length);

    // Check for missing placeholders between matches
    for (let i = 0; i < filteredMatches.length - 1; i++) {
        const currentMatch = filteredMatches[i];
        const nextMatch = filteredMatches[i + 1];

        const currentMatchEndLine = getLine(processedCodeSnippet.code, currentMatch.end2);
        const nextMatchStartLine = getLine(processedCodeSnippet.code, nextMatch.start2);

        if (!isPlaceholder(processedCodeSnippet.lines[nextMatchStartLine - 1])) {
            console.log("Missing placeholder to be inserted at line " + nextMatchStartLine );
            const lineIndex = processedCodeSnippet.lineIndices[nextMatchStartLine - 1];
            console.log("Missing placeholder to be inserted at line " + lineIndex
            + " relative to original codeSnippet");
            console.log("Original codeSnippet: " + codeSnippet);
            console.log("Processed codeSnippet: " + processedCodeSnippet.lines.join('\n'));
            missingPlaceholders.push(lineIndex);
        }
    }

    return missingPlaceholders;
}

function preProcessCodeSnippet(codeSnippet: string) {
    const lines = codeSnippet.split('\n');
    const lineIndices: number[] = [];
    let currentIndex = 0;

    for (const line of lines) {
        lineIndices.push(currentIndex);
        currentIndex += line.length + 1; // Add 1 for the newline character
    }

    const processedLines = lines.map((line) => stripWhitespace(stripBlankLines(stripImports(stripUse(line)))));

    return {
        lines: processedLines,
        lineIndices,
        code: processedLines.join('\n'),
    };
}

function isClosingCurlyBrace(lineIndex: number, processedCodeSnippet: string): boolean {
    const lines = processedCodeSnippet.split('\n');
    return lines[lineIndex].trim() === '}';
}

export function getMissingPlaceholdersLineDiffProblem(existingFile: string, codeSnippet: string): number[] {
    // Function to calculate the number of lines difference after stripping
    const calculateLineDifference = (original: string, stripped: string): number => {
        const originalLines = original.split('\n').length;
        const strippedLines = stripped.split('\n').length;
        return originalLines - strippedLines;
    };

    // Pre-process the input strings by stripping use directives, imports, blank lines, and trimming whitespace
    const processedExistingFile = stripWhitespace(stripBlankLines(stripImports(stripUse(existingFile))));
    const processedCodeSnippet = stripWhitespace(stripBlankLines(stripImports(stripUse(codeSnippet))));

    // Calculate line differences
    const lineDifferenceExistingFile = calculateLineDifference(existingFile, processedExistingFile);
    const lineDifferenceCodeSnippet = calculateLineDifference(codeSnippet, processedCodeSnippet);

    // Get the largest matches
    const matches = getLargestMatches(processedExistingFile, processedCodeSnippet, 6);

    console.log("Matches: ");
    for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        /*console.log("Match start1: " + match.start1 + " end1: " + match.end1 + " start2: "
            + match.start2 + " end2: " + match.end2);*/
        let loggedSnippet = processedCodeSnippet;
        loggedSnippet = loggedSnippet.slice(0, match.start2) + 'MATCH_' + i + '_START' + loggedSnippet.slice(match.start2);
        console.log("Match start relative to pre-processed codeSnippet: " + loggedSnippet);
        loggedSnippet = processedCodeSnippet;
        loggedSnippet = loggedSnippet.slice(0, match.end2) + 'MATCH_' + i + '_END'+ loggedSnippet.slice(match.end2);
        console.log("Match end relative to pre-processed codeSnippet: " + loggedSnippet);
    }

    function isClosingCurlyBrace(lineIndex: number, processedCodeSnippet: string): boolean {
        let lines = processedCodeSnippet.split('\n');
        return lines[lineIndex].trim() == '}';
    }

    // Filter out matches that consist of a non-unique closing curly brace
    const filteredMatches = matches.filter(
        (match) =>
            isUniqueClosingCurlyBrace(
                getLine(processedCodeSnippet, match.start2),
                processedExistingFile,
                processedCodeSnippet
            ) || !isClosingCurlyBrace(getLine(processedCodeSnippet, match.start2), processedCodeSnippet)
    );

    const missingPlaceholders: number[] = [];
    
    console.log("Filtered matches: " + filteredMatches.length);

    // Check for missing placeholders between matches
    for (let i = 0; i < filteredMatches.length - 2; i++) {
        const currentMatch = filteredMatches[i];
        const nextMatch = filteredMatches[i + 1];

        const currentMatchEndLine = getLine(processedCodeSnippet, currentMatch.end2);
        const nextMatchStartLine = getLine(processedCodeSnippet, nextMatch.start2);

        if (!isPlaceholder(processedCodeSnippet.split('\n')[nextMatchStartLine - 1])) {
            //const lineDifference = lineDifferenceCodeSnippet - lineDifferenceExistingFile;
            console.log("Missing placeholder to be inserted at line " + nextMatchStartLine );
            const lineIndex = nextMatchStartLine + lineDifferenceCodeSnippet;
            console.log("Missing placeholder to be inserted at line " + lineIndex
            + " relative to original codeSnippet");
            console.log("Original codeSnippet: " + codeSnippet);
            console.log("Processed codeSnippet: " + processedCodeSnippet);
            missingPlaceholders.push(lineIndex);
        }
    }

    return missingPlaceholders;
}

export function detectMissingPlaceholder(existingFile: string, codeSnippet: string): { lineIndex: number, matchContent: string } | null {
    // Function to calculate the number of lines difference after stripping
    const calculateLineDifference = (original: string, stripped: string): number => {
        const originalLines = original.split('\n').length;
        const strippedLines = stripped.split('\n').length;
        return originalLines - strippedLines;
    };

    // Pre-process the input strings by stripping use directives, imports, blank lines, and trimming whitespace
    const processedExistingFile = stripWhitespace(stripBlankLines(stripImports(stripUse(existingFile))));
    const processedCodeSnippet = stripWhitespace(stripBlankLines(stripImports(stripUse(codeSnippet))));


    // Calculate line differences
    const lineDifferenceExistingFile = calculateLineDifference(existingFile, processedExistingFile);
    const lineDifferenceCodeSnippet = calculateLineDifference(codeSnippet, processedCodeSnippet);

    // Get the largest matches
    const matches = getLargestMatches(processedExistingFile, processedCodeSnippet, 20);

    console.log("Matches: ")
    for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        /*console.log("Match start1: " + match.start1 + " end1: " + match.end1 + " start2: "
            + match.start2 + " end2: " + match.end2);*/
        let loggedSnippet = processedCodeSnippet;
        loggedSnippet = loggedSnippet.slice(0, match.start2) + 'START' + i + loggedSnippet.slice(match.start2);
        console.log("Match start relative to pre-processed codeSnippet: " + loggedSnippet);
        loggedSnippet = processedCodeSnippet;
        loggedSnippet = loggedSnippet.slice(0, match.end2) + 'END' + i + loggedSnippet.slice(match.end2);
        console.log("Match end relative to pre-processed codeSnippet: " + loggedSnippet);
    }

    // Filter out matches that are only empty lines
    const nonEmptyLineMatches = matches.filter(match => {
        const lines = processedExistingFile.substring(match.start1, match.end1).split('\n');
        return lines.some(line => line.trim().length > 0);
    });

    // Filter out matches that consist of a closing curly brace that is not unique
    const validMatches = nonEmptyLineMatches.filter(match => {
        const snippetLines = processedCodeSnippet.substring(match.start2, match.end2).split('\n');
        return !snippetLines.some((line, index) => line.trim() === '}' &&
            !isUniqueClosingCurlyBrace(getLine(processedCodeSnippet, match.start2) + index,
            processedExistingFile, processedCodeSnippet));
    });

    // Check for missing placeholders between matches
    for (let i = 0; i < validMatches.length; i++) {
        for (let j = 0; j < validMatches.length; j++) {
            if (i !== j) {
                const match1 = validMatches[i];
                const match2 = validMatches[j];
                
                // Determine the range between match1 and match2
                const rangeStart = Math.min(match1.end2, match2.end2);
                const rangeEnd = Math.max(match1.start2, match2.start2);
                
                // Get the lines between the two matches in the codeSnippet
                const betweenLines = processedCodeSnippet.substring(rangeStart, rangeEnd).split('\n');

                // Check if there is a placeholder between the two matches
                const hasPlaceholder = betweenLines.some(line => isPlaceholder(line.trim()));
                
                if (!hasPlaceholder) {
                    // Calculate the line index where the placeholder should be
                    const snippetLines = processedCodeSnippet.split('\n');
                    const startLineIndex = snippetLines.slice(0, rangeStart).length - 1;
                    const originalLineIndex = startLineIndex + lineDifferenceCodeSnippet;
                    return { lineIndex: originalLineIndex, matchContent: processedCodeSnippet.substring(match1.start2, match1.end2) };
                }
            }
        }
    }

    // If no missing placeholder is detected, return null
    return null;
}

export function stripBlankLines(input: string): string {
    const lines = input.split('\n');
    const nonBlankLines = lines.filter(line => line.trim().length > 0);
    return nonBlankLines.join('\n');
}

export function stripWhitespace(input: string): string {
    const lines = input.split('\n');
    const trimmedLines = lines.map(line => line.trim());
    return trimmedLines.join('\n');
}

export function getLine(input: string, charIndex: number): number {
    if (charIndex < 0 || charIndex > input.length) {
        throw new Error("Character index out of bounds");
    }
    
    const lines = input.split('\n');
    let currentCharIndex = 0;

    for (let i = 0; i < lines.length; i++) {
        currentCharIndex += lines[i].length + 1; // +1 for the newline character
        if (charIndex < currentCharIndex) {
            return i;
        }
    }

    return -1; // Should not reach here if charIndex is valid
}

function getRawLargestMatches(text1: string, text2: string, matchNumber: number): { start1: number; end1: number; start2: number; end2: number }[] {
    const dmp = new DiffMatchPatch();
    const diffs: Diff[] = dmp.diff_main(text1, text2);
    const matches: { start1: number; end1: number; start2: number; end2: number; length: number }[] = [];

    let start1 = 0;
    let start2 = 0;
    for (const diff of diffs) {
        if (diff[0] === 0) { // DIFF_EQUAL
            const matchLength = diff[1].length;
            matches.push({
                start1: start1,
                end1: start1 + matchLength,
                start2: start2,
                end2: start2 + matchLength,
                length: matchLength,
            });
        }
        // Update the start positions for the next diff segment
        if (diff[0] !== 1) { // Not DIFF_INSERT
            start1 += diff[1].length;
        }
        if (diff[0] !== -1) { // Not DIFF_DELETE
            start2 += diff[1].length;
        }
    }

    // Sort matches by length in descending order and return the top N matches
    matches.sort((a, b) => (b.end1 - b.start1) - (a.end1 - a.start1));
    const largestMatches = matches.slice(0, matchNumber);

    return largestMatches;
}

export async function fastFetch(url: string, data: { [key: string]: any }, post: boolean = false): Promise<any> {
    let response;
    let requestOptions: RequestInit;

    if (post) {
        requestOptions = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        };
    } else {
        const params = new URLSearchParams(data);
        url += `?${params.toString()}`;
        requestOptions = {
            method: 'GET'
        };
    }

    try {
        response = await fetch(url, requestOptions);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const resultData = await response.json();
        return resultData;
    } catch (error) {
        console.error('Error fetching data:', error);
        throw error;
    }
}

export async function getLargestMatchesDiffLib(text1: string, text2: string, matchNumber: number): Promise<{ start1: number; end1: number; start2: number; end2: number; length: number; originalIndex: number; }[]> {
    console.log("text1: " + text1);
    console.log("text2: " + text2);
    const diffs = await fastFetch(`http://localhost:${process.env.FLASK_PORT}/get-diffs`,
        {text1: text1, text2: text2}, true);
    //console.log("Raw diffs: " + diffs);
    for (const diff of diffs.diffs) {
        console.log("Diff type: " + diff.type, "\nRaw diff: " + diff.text);
    }
    const matches: { start1: number; end1: number; start2: number; end2: number; length: number, originalIndex: number}[] = [];
    const emptyMatches: { start1: number; end1: number; start2: number; end2: number; length: number, originalIndex: number}[] = [];
    const newlineChar = '\n';

    let start1 = 0;
    let start2 = 0;
    let originalIndex = 0;
    for (const diff of diffs.diffs) {
        if (diff.type === 'equal') { // Equal diffs
            const matchLength = diff.text.length;
            let adjustedStart1 = start1;
            let adjustedEnd1 = start1 + matchLength;
            let adjustedStart2 = start2;
            let adjustedEnd2 = start2 + matchLength;
             // Check if the match already spans complete lines
            const isStart1Complete = text1[adjustedStart1 - 1] === newlineChar || adjustedStart1 === 0;
            const isEnd1Complete = text1[adjustedEnd1] === newlineChar || adjustedEnd1 === text1.length;
            const isStart2Complete = text2[adjustedStart2 - 1] === newlineChar || adjustedStart2 === 0;
            const isEnd2Complete = text2[adjustedEnd2] === newlineChar || adjustedEnd2 === text2.length;
            console.log("Checking if match spans complete lines: ");
            if (!(isStart1Complete && isEnd1Complete && isStart2Complete && isEnd2Complete)) {
                console.log("Match does not span complete lines. Adjusting...");
                // Adjust start and end positions if the match does not span complete lines
                adjustedStart1 = adjustToLineBreak(text1, adjustedStart1, true);
                adjustedEnd1 = adjustToLineBreak(text1, adjustedEnd1, false);
                adjustedStart2 = adjustToLineBreak(text2, adjustedStart2, true);
                adjustedEnd2 = adjustToLineBreak(text2, adjustedEnd2, false);
            }

            /*const matchLength = diff[1].length;
            const adjustedStart1 = adjustToLineBreak(text1, start1, true);
            const adjustedEnd1 = adjustToLineBreak(text1, start1 + matchLength, false);
            const adjustedStart2 = adjustToLineBreak(text2, start2, true);
            const adjustedEnd2 = adjustToLineBreak(text2, start2 + matchLength, false);*/

            /*matches.push({
                start1: adjustedStart1,
                end1: adjustedEnd1,
                start2: adjustedStart2,
                end2: adjustedEnd2,
                length: adjustedEnd1 - adjustedStart1,
            });*/

            const adjustedMatch1 = text1.substring(adjustedStart1, adjustedEnd1);
            const adjustedMatch2 = text2.substring(adjustedStart2, adjustedEnd2);
            /*if (text1.includes(adjustedMatch2) && text2.includes(adjustedMatch1)) {*/
            console.log("Check if should add one match to matches");
            console.log(`Checking: ${adjustedStart1}, ${adjustedEnd1},
                ${adjustedStart2}, ${adjustedEnd2}, ${adjustedMatch1}, ${adjustedMatch2}`);
            if (adjustedEnd1 !== adjustedStart1 && adjustedEnd2 !== adjustedStart2 && text1.includes(adjustedMatch2) && text2.includes(adjustedMatch1)) {
                console.log("Adding one match to matches");
                matches.push({
                    start1: adjustedStart1,
                    end1: adjustedEnd1,
                    start2: adjustedStart2,
                    end2: adjustedEnd2,
                    length: adjustedEnd1 - adjustedStart1,
                    originalIndex: originalIndex++,
                });
            }
            // Update the start positions for the next diff segment
            start1 += matchLength + 1;
            start2 += matchLength + 1;

        }
        // Update the start positions for the next diff segment
        if (diff.type == 'delete') {
            start1 += diff.text1.length + 1;
        }
        if (diff.type == 'insert') {
            start2 += diff.text2.length + 1
        }
        if (diff.type == 'replace') {
            start1 += diff.text1.length + 1;
            start2 += diff.text2.length + 1;
        }
    }
    

    // Sort matches by length in descending order and return the top N matches
    matches.sort((a, b) => b.length - a.length);
    const largestMatches = matches.slice(0, matchNumber);

    console.log("Logging matches if any: ");
    for (const match of largestMatches) {
        console.log(`match: ${match.start1}, ${match.end1}, ${match.start2}, ${match.end2}, 
        ${match.originalIndex}`)
    }
    if (largestMatches.length == 0) {
        console.log("No matches found");
        return emptyMatches;
    }

    // If largest match spans too few lines, return no matches
    if ( (getLine(text2, largestMatches[0].end2) - getLine(text2, largestMatches[0].start2) ) < 4) {
        console.log("No matches found");
        return emptyMatches;
    }

    // Sort matches by position
    largestMatches.sort((a, b) => a.originalIndex - b.originalIndex);

    return largestMatches;
}

export function getLargestMatchesDiff(text1: string, text2: string, matchNumber: number): { start1: number; end1: number; start2: number; end2: number, length: number, originalIndex: number }[] {
    const diffs = diffChars(text1, text2);
    console.log("text1: " + text1);
    console.log("text2: " + text2);
    for (const diff of diffs) {
        console.log("Raw diff: " + diff.value + "Removed: " + diff.removed + "Added: " + diff.added);
    }
    const matches: { start1: number; end1: number; start2: number; end2: number; length: number, originalIndex: number }[] = [];
    const emptyMatches: { start1: number; end1: number; start2: number; end2: number; length: number, originalIndex: number }[] = [];
    const newlineChar = '\n';

    let start1 = 0;
    let start2 = 0;
    let originalIndex = 0;

    for (const diff of diffs) {
        if (diff.added === undefined && diff.removed === undefined) { // DIFF_EQUAL
            const matchLength = diff.value.length;
            let adjustedStart1 = start1;
            let adjustedEnd1 = start1 + matchLength;
            let adjustedStart2 = start2;
            let adjustedEnd2 = start2 + matchLength;

            // Check if the match already spans complete lines
            const isStart1Complete = text1[adjustedStart1] === newlineChar || adjustedStart1 === 0;
            const isEnd1Complete = text1[adjustedEnd1 - 1] === newlineChar || adjustedEnd1 === text1.length;
            const isStart2Complete = text2[adjustedStart2] === newlineChar || adjustedStart2 === 0;
            const isEnd2Complete = text2[adjustedEnd2 - 1] === newlineChar || adjustedEnd2 === text2.length;

            if (!(isStart1Complete && isEnd1Complete && isStart2Complete && isEnd2Complete)) {
                // Adjust start and end positions if the match does not span complete lines
                adjustedStart1 = adjustToLineBreak(text1, adjustedStart1, true);
                adjustedEnd1 = adjustToLineBreak(text1, adjustedEnd1, false);
                adjustedStart2 = adjustToLineBreak(text2, adjustedStart2, true);
                adjustedEnd2 = adjustToLineBreak(text2, adjustedEnd2, false);
            }

            const adjustedMatch1 = text1.substring(adjustedStart1, adjustedEnd1);
            const adjustedMatch2 = text2.substring(adjustedStart2, adjustedEnd2);

            if (adjustedEnd1 !== adjustedStart1 && adjustedEnd2 !== adjustedStart2 && text1.includes(adjustedMatch2) && text2.includes(adjustedMatch1)) {
                matches.push({
                    start1: adjustedStart1,
                    end1: adjustedEnd1,
                    start2: adjustedStart2,
                    end2: adjustedEnd2,
                    length: adjustedEnd1 - adjustedStart1,
                    originalIndex: originalIndex++,
                });
            }
        }

        // Update the start positions for the next diff segment
        if (diff.removed === undefined) {
            start1 += diff.value.length;
        }
        if (diff.added === undefined) {
            start2 += diff.value.length;
        }
    }

    // Sort matches by length in descending order and return the top N matches
    matches.sort((a, b) => b.length - a.length);
    const largestMatches = matches.slice(0, matchNumber);

    // If largest match spans too few lines, return no matches
    if ((getLine(text2, largestMatches[0].end2) - getLine(text2, largestMatches[0].start2)) < 4)
        return emptyMatches;

    // Sort matches by position
    largestMatches.sort((a, b) => a.originalIndex - b.originalIndex);

    return largestMatches;
}

export function getLargestMatches(text1: string, text2: string, matchNumber: number): { start1: number; end1: number; start2: number; end2: number, length: number, originalIndex: number }[] {
    const dmp = new DiffMatchPatch();
    console.log("text1: " + text1);
    console.log("text2: " + text2);
    const diffs: Diff[] = dmp.diff_main(text1, text2);
    //console.log("Raw diffs: " + diffs);
    for (const diff of diffs) {
        console.log("Raw diff: " + diff);
    }
    const matches: { start1: number; end1: number; start2: number; end2: number; length: number, originalIndex: number}[] = [];
    const emptyMatches: { start1: number; end1: number; start2: number; end2: number; length: number, originalIndex: number}[] = [];
    const newlineChar = '\n';

    let start1 = 0;
    let start2 = 0;
    let originalIndex = 0;
    for (const diff of diffs) {
        if (diff[0] === 0) { // DIFF_EQUAL
            const matchLength = diff[1].length;
            let adjustedStart1 = start1;
            let adjustedEnd1 = start1 + matchLength;
            let adjustedStart2 = start2;
            let adjustedEnd2 = start2 + matchLength;
             // Check if the match already spans complete lines
            const isStart1Complete = text1[adjustedStart1] === newlineChar || adjustedStart1 === 0;
            const isEnd1Complete = text1[adjustedEnd1 - 1] === newlineChar || adjustedEnd1 === text1.length;
            const isStart2Complete = text2[adjustedStart2] === newlineChar || adjustedStart2 === 0;
            const isEnd2Complete = text2[adjustedEnd2 - 1] === newlineChar || adjustedEnd2 === text2.length;

            if (!(isStart1Complete && isEnd1Complete && isStart2Complete && isEnd2Complete)) {
                // Adjust start and end positions if the match does not span complete lines
                adjustedStart1 = adjustToLineBreak(text1, adjustedStart1, true);
                adjustedEnd1 = adjustToLineBreak(text1, adjustedEnd1, false);
                adjustedStart2 = adjustToLineBreak(text2, adjustedStart2, true);
                adjustedEnd2 = adjustToLineBreak(text2, adjustedEnd2, false);
            }

            /*const matchLength = diff[1].length;
            const adjustedStart1 = adjustToLineBreak(text1, start1, true);
            const adjustedEnd1 = adjustToLineBreak(text1, start1 + matchLength, false);
            const adjustedStart2 = adjustToLineBreak(text2, start2, true);
            const adjustedEnd2 = adjustToLineBreak(text2, start2 + matchLength, false);*/

            /*matches.push({
                start1: adjustedStart1,
                end1: adjustedEnd1,
                start2: adjustedStart2,
                end2: adjustedEnd2,
                length: adjustedEnd1 - adjustedStart1,
            });*/

            const adjustedMatch1 = text1.substring(adjustedStart1, adjustedEnd1);
            const adjustedMatch2 = text2.substring(adjustedStart2, adjustedEnd2);
            /*if (text1.includes(adjustedMatch2) && text2.includes(adjustedMatch1)) {*/
            if (adjustedEnd1 !== adjustedStart1 && adjustedEnd2 !== adjustedStart2 && text1.includes(adjustedMatch2) && text2.includes(adjustedMatch1)) {
                matches.push({
                    start1: adjustedStart1,
                    end1: adjustedEnd1,
                    start2: adjustedStart2,
                    end2: adjustedEnd2,
                    length: adjustedEnd1 - adjustedStart1,
                    originalIndex: originalIndex++,
                });
            }
        }
        // Update the start positions for the next diff segment
        if (diff[0] !== 1) { // Not DIFF_INSERT
            start1 += diff[1].length;
        }
        if (diff[0] !== -1) { // Not DIFF_DELETE
            start2 += diff[1].length;
        }
    }
    

    // Sort matches by length in descending order and return the top N matches
    matches.sort((a, b) => b.length - a.length);
    const largestMatches = matches.slice(0, matchNumber);

    // If largest match spans too few lines, return no matches
    if ( (getLine(text2, largestMatches[0].end2) - getLine(text2, largestMatches[0].start2) ) < 4)
        return emptyMatches;

    // Sort matches by position
    largestMatches.sort((a, b) => a.originalIndex - b.originalIndex);

    return largestMatches;
}

function adjustToLineBreak(text: string, index: number, isStart: boolean): number {
    const newlineChar = '\n';
    let adjustedIndex = index;

    if (isStart) {
        // Case 1: Move the start position to the beginning of the line
        while (adjustedIndex > 0 && text[adjustedIndex - 1] !== newlineChar) {
            adjustedIndex--;
        }
    } else {
        // Case 2: Move the end position to the end of the line above the current line
        let prevNewline = -1;
        for (let i = adjustedIndex - 1; i >= 0; i--) {
            if (text[i] === newlineChar) {
                prevNewline = i;
                break;
            }
        }
        adjustedIndex = prevNewline === -1 ? 0 : prevNewline + 1;
    }

    return adjustedIndex;
}

function adjustToLineBreakSameLine(text: string, index: number, isStart: boolean): number {
    const newlineChar = '\n';
    let adjustedIndex = index;

    if (isStart) {
        // Case 1: Move the start position to the beginning of the line
        while (adjustedIndex > 0 && text[adjustedIndex - 1] !== newlineChar) {
            adjustedIndex--;
        }
    } else {
        // Case 2: Move the end position to the end of the line
        while (adjustedIndex < text.length && text[adjustedIndex] !== newlineChar) {
            adjustedIndex++;
        }
    }

    return adjustedIndex;
}

function getLargestMatchesContainedBy(text1: string, text2: string, matchNumber: number): { start1: number; end1: number; start2: number; end2: number }[] {
    const dmp = new DiffMatchPatch();
    const diffs: Diff[] = dmp.diff_main(text1, text2);

    const matches: { start1: number; end1: number; start2: number; end2: number; length: number }[] = [];
    
    let start1 = 0;
    let start2 = 0;

    for (const diff of diffs) {
        if (diff[0] === 0) { // DIFF_EQUAL
            const matchLength = diff[1].length;
            matches.push({
                start1: start1,
                end1: start1 + matchLength,
                start2: start2,
                end2: start2 + matchLength,
                length: matchLength,
            });
        }

        // Update the start positions for the next diff segment
        if (diff[0] !== 1) { // Not DIFF_INSERT
            start1 += diff[1].length;
        }
        if (diff[0] !== -1) { // Not DIFF_DELETE
            start2 += diff[1].length;
        }
    }

    const adjustToLineBoundaries = (text: string, start: number, end: number) => {
        let adjustedStart = start;
        let adjustedEnd = end;

        // Determine the start and end lines
        const startLine = getLine(text, start);
        const endLine = getLine(text, end);

        // Case 1: Adjust the start to the beginning of the line if it's a partial match
        if (start > 0 && text[start - 1] !== '\n') {
            const lineStartIndex = text.lastIndexOf('\n', start - 1) + 1;
            adjustedStart = lineStartIndex;
        }

        // Case 2: Adjust the end to the end of the line above if it's a partial match
        if (end < text.length && text[end] !== '\n') {
            const lineEndIndex = text.indexOf('\n', end);
            adjustedEnd = lineEndIndex === -1 ? text.length : lineEndIndex;
        }

        return { adjustedStart, adjustedEnd };
    };

    const containedByMatch = (str: string, matches: { start1: number; end1: number; start2: number; end2: number }[], currentMatch: { start1: number; end1: number; start2: number; end2: number }) => {
        for (const match of matches) {
            if (match === currentMatch) continue;
            const matchText1 = text1.slice(match.start1, match.end1);
            const matchText2 = text2.slice(match.start2, match.end2);
            if (matchText1.includes(str) || matchText2.includes(str)) {
                const startLine = getLine(text1, match.start1);
                const strStartLine = getLine(text1, text1.indexOf(str, match.start1));
                if (startLine === strStartLine) return true;
            }
        }
        return false;
    };

    const adjustedMatches = matches.map(match => {
        const { adjustedStart: start1, adjustedEnd: end1 } = adjustToLineBoundaries(text1, match.start1, match.end1);
        const { adjustedStart: start2, adjustedEnd: end2 } = adjustToLineBoundaries(text2, match.start2, match.end2);

        // Ensure that adjusting doesn't make the match contain parts not in other matches
        if (containedByMatch(text1.slice(start1, end1), matches, match) || containedByMatch(text2.slice(start2, end2), matches, match)) {
            return match;
        }

        return { start1, end1, start2, end2 };
    });

    // Sort matches by length in descending order and return the top N matches
    adjustedMatches.sort((a, b) => (b.end1 - b.start1) - (a.end1 - a.start1));
    const largestMatches = adjustedMatches.slice(0, matchNumber);
    
    return largestMatches;
}

export function getLargestMatchesDefaultProblem(text1: string, text2: string, matchNumber: number): { start1: number; end1: number; start2: number; end2: number }[] {
    const dmp = new DiffMatchPatch();
    const diffs: Diff[] = dmp.diff_main(text1, text2);

    const matches: { start1: number; end1: number; start2: number; end2: number; length: number }[] = [];
    
    let start1 = 0;
    let start2 = 0;

    for (const diff of diffs) {
        if (diff[0] === 0) { // DIFF_EQUAL
            const matchLength = diff[1].length;
            matches.push({
                start1: start1,
                end1: start1 + matchLength,
                start2: start2,
                end2: start2 + matchLength,
                length: matchLength,
            });
        }

        // Update the start positions for the next diff segment
        if (diff[0] !== 1) { // Not DIFF_INSERT
            start1 += diff[1].length;
        }
        if (diff[0] !== -1) { // Not DIFF_DELETE
            start2 += diff[1].length;
        }
    }

    // Adjust matches to start and end at line boundaries
    const adjustToLineBoundaries = (text: string, start: number, end: number) => {
        const lines = text.split('\n');
        let adjustedStart = start;
        let adjustedEnd = end;

        let charCount = 0;
        for (const line of lines) {
            const lineLength = line.length + 1; // +1 for newline character
            if (charCount <= start && start < charCount + lineLength) {
                adjustedStart = charCount;
            }
            if (charCount <= end && end <= charCount + lineLength) {
                adjustedEnd = charCount + lineLength - 1;
                break;
            }
            charCount += lineLength;
        }
        return { adjustedStart, adjustedEnd };
    };

    const adjustedMatches = matches.map(match => {
        const { adjustedStart: start1, adjustedEnd: end1 } = adjustToLineBoundaries(text1, match.start1, match.end1);
        const { adjustedStart: start2, adjustedEnd: end2 } = adjustToLineBoundaries(text2, match.start2, match.end2);
        return { start1, end1, start2, end2 };
    });

    // Sort matches by length in descending order and return the top N matches
    adjustedMatches.sort((a, b) => (b.end1 - b.start1) - (a.end1 - a.start1));
    const largestMatches = adjustedMatches.slice(0, matchNumber);
    
    return largestMatches;
}

export function getLargestNoPartialAttempt(text1: string, text2: string, matchNumber: number): { start1: number; end1: number; start2: number; end2: number }[] {
    const dmp = new DiffMatchPatch();
    const diffs: Diff[] = dmp.diff_main(text1, text2);

    const matches: { start1: number; end1: number; start2: number; end2: number; length: number }[] = [];
    
    let start1 = 0;
    let start2 = 0;

    for (const diff of diffs) {
        if (diff[0] === 0) { // DIFF_EQUAL
            const matchLength = diff[1].length;
            matches.push({
                start1: start1,
                end1: start1 + matchLength,
                start2: start2,
                end2: start2 + matchLength,
                length: matchLength,
            });
        }

        // Update the start positions for the next diff segment
        if (diff[0] !== 1) { // Not DIFF_INSERT
            start1 += diff[1].length;
        }
        if (diff[0] !== -1) { // Not DIFF_DELETE
            start2 += diff[1].length;
        }
    }

    // Adjust matches to start and end at line boundaries
    const adjustToLineBoundaries = (text: string, start: number, end: number) => {
        const lines = text.split('\n');
        let adjustedStart = start;
        let adjustedEnd = end;
        let startLine = -1;
        let endLine = -1;

        let charCount = 0;
        for (let i = 0; i < lines.length; i++) {
            const lineLength = lines[i].length + 1; // +1 for newline character
            if (charCount <= start && start < charCount + lineLength) {
                adjustedStart = charCount;
                startLine = i;
            }
            if (charCount < end && end <= charCount + lineLength) {
                adjustedEnd = charCount + lineLength - 1;
                endLine = i;
                break;
            }
            charCount += lineLength;
        }

        // Ignore matches that start and end on the same line but do not span the entire line
        if (startLine === endLine && (adjustedStart !== start || adjustedEnd !== end)) {
            return null;
        }

        return { adjustedStart, adjustedEnd };
    };

    const adjustedMatches = matches.map(match => {
        const adjusted1 = adjustToLineBoundaries(text1, match.start1, match.end1);
        const adjusted2 = adjustToLineBoundaries(text2, match.start2, match.end2);
        if (adjusted1 && adjusted2) {
            return { 
                start1: adjusted1.adjustedStart, 
                end1: adjusted1.adjustedEnd, 
                start2: adjusted2.adjustedStart, 
                end2: adjusted2.adjustedEnd 
            };
        }
        return null;
    }).filter(match => match !== null) as { start1: number; end1: number; start2: number; end2: number }[];

    // Sort matches by length in descending order and return the top N matches
    adjustedMatches.sort((a, b) => (b.end1 - b.start1) - (a.end1 - a.start1));
    const largestMatches = adjustedMatches.slice(0, matchNumber);
    
    return largestMatches;
}

export function getLargestMatchesAnywhere(text1: string, text2: string, matchNumber: number): { start1: number; end1: number; start2: number; end2: number }[] {
    const dmp = new DiffMatchPatch();
    const diffs: Diff[] = dmp.diff_main(text1, text2);

    const matches: { start1: number; end1: number; start2: number; end2: number; length: number }[] = [];
    
    let start1 = 0;
    let start2 = 0;

    for (const diff of diffs) {
        if (diff[0] === 0) { // DIFF_EQUAL
            const matchLength = diff[1].length;
            matches.push({
                start1: start1,
                end1: start1 + matchLength,
                start2: start2,
                end2: start2 + matchLength,
                length: matchLength,
            });
        }

        // Update the start positions for the next diff segment
        if (diff[0] !== 1) { // Not DIFF_INSERT
            start1 += diff[1].length;
        }
        if (diff[0] !== -1) { // Not DIFF_DELETE
            start2 += diff[1].length;
        }
    }

    // Sort matches by length in descending order and return the top N matches
    matches.sort((a, b) => b.length - a.length);
    const largestMatches = matches.slice(0, matchNumber);
    
    return largestMatches.map(match => ({
        start1: match.start1,
        end1: match.end1,
        start2: match.start2,
        end2: match.end2
    }));
}

export function getLargestMatch(text1: string, text2: string): { start1: number; end1: number; start2: number; end2: number } | null {
    const dmp = new DiffMatchPatch();
    const diffs: Diff[] = dmp.diff_main(text1, text2);
    
    let largestMatch = { start1: 0, end1: 0, start2: 0, end2: 0, length: 0 };
    
    let start1 = 0;
    let start2 = 0;

    for (const diff of diffs) {
        if (diff[0] === 0) { // DIFF_EQUAL
            const matchLength = diff[1].length;
            if (matchLength > largestMatch.length) {
                largestMatch = {
                    start1: start1,
                    end1: start1 + matchLength,
                    start2: start2,
                    end2: start2 + matchLength,
                    length: matchLength,
                };
            }
        }

        // Update the start positions for the next diff segment
        if (diff[0] !== 1) { // Not DIFF_INSERT
            start1 += diff[1].length;
        }
        if (diff[0] !== -1) { // Not DIFF_DELETE
            start2 += diff[1].length;
        }
    }
    
    return largestMatch.length > 0 ? { start1: largestMatch.start1, end1: largestMatch.end1, start2: largestMatch.start2, end2: largestMatch.end2 } : null;
}


/* Code test correctImports:
const testSnippet = `import Script from 'next/script';
import Header from './components/header';
import Footer from './components/footer';
import useState from 'react';
import useEffect from 'react';
import setLocalStorage from './components/utils.mjs';`;
correctImports(testSnippet, "src/app/page.jsx");
Correct code that should be output:
import Script from 'next/script';
import Header from './components/header';
import Footer from './components/footer';
import { useState } from 'react';
import { useEffect } from 'react';
import { setLocalStorage } from './components/utils.mjs';

*/

export async function correctImports(codeSnippet: string, filePathInProject: string): Promise<string> {
    const newAST = getAST(codeSnippet);
    const projectPath = process.env.PROJECT_PATH || '';
    const importStatements: string[] = [];
    const importDeclarations: any[] = [];

    // Collect import declarations
    walk.simple(newAST, {
        ImportDeclaration(node: any) {
            importDeclarations.push(node);
        }
    });
    for (const node of importDeclarations) {
        const importPath = node.source.value;
        //const absoluteImportPath = path.resolve(path.dirname(filePathInProject), importPath);
        let newImportStatement = '';
        const originalAbsoluteImportPath = getAbsoluteImportPath(process.env.PROJECT_PATH as string,
            filePathInProject, importPath);
        console.log("originalAbsoluteImportPath: " + originalAbsoluteImportPath);
        if ((importPath.startsWith('.') || path.isAbsolute(importPath)) // indicates it is NOT a node module
            && !existsSyncWithExtensions(originalAbsoluteImportPath)) { // indicates the path doesn't exist in proj
            
            function getFileName(importPath: string): string {
                // Split the path by '/' or '\' and return the last part
                const parts = importPath.split(/[/\\]/);
                return parts[parts.length - 1];
            }

            async function getFiles(projectPath: string, fileName: string, excludedDirectories: string[]): Promise<string[]> {
                const filePaths: string[] = [];
            
                async function searchDirectory(directory: string) {
                    const items = await fs.promises.readdir(directory, { withFileTypes: true });
            
                    for (const item of items) {
                        const fullPath = path.join(directory, item.name);
            
                        if (item.isDirectory()) {
                            if (!excludedDirectories.includes(item.name + '/')) { // since each exclude dir has a trailing /
                                await searchDirectory(fullPath);
                            }
                        } else if (item.isFile() && item.name === fileName) {
                            filePaths.push(fullPath);
                        }
                    }
                }
            
                await searchDirectory(projectPath);
            
                return filePaths;
            }

            function getExcludeDirs(): string[] {
                return process.env.EXCLUDE_DIR ? process.env.EXCLUDE_DIR.split(" "): []
            }

            const files = await getFiles(process.env.PROJECT_PATH as string, getFileName(importPath),
                getExcludeDirs());

            for (const file of files) {
                //console.log("Found file: " + file);
                const absoluteImportPath = file;
                console.log("absoluteImportPath: " + absoluteImportPath);
                const fileContent = readFileWithExtensions(absoluteImportPath);
                const fileAST = getAST(fileContent);
                const namedExports = getNamedExportsRecursively(absoluteImportPath, fileAST);
                console.log("namedExports from " + absoluteImportPath + ": " + namedExports.join('\n'));

                node.specifiers.forEach((specifier: any) => {
                    if (specifier.type === 'ImportDefaultSpecifier') {
                        const importName = specifier.local.name;

                        /*const absoluteFilePathInProject = getAbsoluteImportPath(process.env.PROJECT_PATH as string,
                            filePathInProject, filePathInProject); // not really intended for this but I guess now it is getAbsoluteFilePath()
                        console.log("absoluteFilePathInProject: " + absoluteFilePathInProject);*/
                        console.log("PROJECT_PATH: " + process.env.PROJECT_PATH as string);
                        console.log("filePathInProject: " + filePathInProject);
                        const absoluteFilePathInProject = path.join(process.env.PROJECT_PATH as string, filePathInProject);
                        const absoluteFilePathInProjectDir = path.dirname(absoluteFilePathInProject);
                        let relativePath = path.relative(absoluteFilePathInProjectDir, absoluteImportPath);
                        if (!relativePath.startsWith('.') && !relativePath.startsWith('/')) {
                            relativePath = './' + relativePath;
                        }
                        console.log("relativePath and more: " + relativePath + " " + absoluteFilePathInProject + " " + absoluteImportPath);
                        //console.log("relativePath and more: " + relativePath + " " + absoluteFilePathInProject + " " + absoluteImportPath);
                        if (namedExports.includes(importName)) {
                            newImportStatement = `import { ${importName} } from '${relativePath}';`;
                            console.log("Adding named import statement: " + newImportStatement);
                        } else {
                            newImportStatement = `import ${importName} from '${relativePath}';`;
                            console.log("Adding default import statement: " + newImportStatement);
                        }
                        importStatements.push(newImportStatement);
                    }
                });
            }
            if (newImportStatement == '') {
                newImportStatement = generateOriginalImport(node)
                console.log("No file could be found with the specified file name");
                console.log("so adding original import statement: " + newImportStatement);
                importStatements.push(generateOriginalImport(node));
            }
        }
        else {
            if (importPath.startsWith('.') && existsSyncWithExtensions(getAbsoluteImportPath(process.env.PROJECT_PATH as string,
                filePathInProject, importPath))) {
                console.log("Trying the . relative case: ");
                const absoluteImportPath = getAbsoluteImportPath(process.env.PROJECT_PATH as string,
                filePathInProject, importPath);
                console.log("absoluteImportPath: " + absoluteImportPath);
                const fileContent = readFileWithExtensions(absoluteImportPath);
                const fileAST = getAST(fileContent);
                const namedExports = getNamedExportsRecursively(absoluteImportPath, fileAST);
                console.log("namedExports from " + absoluteImportPath + ": " + namedExports.join('\n'));

                node.specifiers.forEach((specifier: any) => {
                    if (specifier.type === 'ImportDefaultSpecifier') {
                        const importName = specifier.local.name;
                        if (namedExports.includes(importName)) {
                            newImportStatement = `import { ${importName} } from '${importPath}';`;
                            console.log("Adding named import statement: " + newImportStatement);
                        } else {
                            newImportStatement = `import ${importName} from '${importPath}';`;
                            console.log("Adding default import statement: " + newImportStatement);
                        }
                        importStatements.push(newImportStatement);
                    } else {
                        newImportStatement = generateOriginalImport(node);
                        console.log("Adding original import statement: " + newImportStatement);
                        importStatements.push(generateOriginalImport(node));
                    }
                });
            }
            if (importPath.startsWith('..') && existsSyncWithExtensions(getAbsoluteImportPath(process.env.PROJECT_PATH as string,
                filePathInProject, importPath.slice(1)))) {
                console.log("Trying the .. relative case: ");
                const absoluteImportPath = getAbsoluteImportPath(process.env.PROJECT_PATH as string,
                    filePathInProject, importPath.slice(1));
                console.log("absoluteImportPath: " + absoluteImportPath);
                const fileContent = readFileWithExtensions(absoluteImportPath);
                const fileAST = getAST(fileContent);
                const namedExports = getNamedExportsRecursively(absoluteImportPath, fileAST);
                console.log("namedExports from " + absoluteImportPath + ": " + namedExports.join('\n'));

                node.specifiers.forEach((specifier: any) => {
                    if (specifier.type === 'ImportDefaultSpecifier') {
                        const importName = specifier.local.name;
                        if (namedExports.includes(importName)) {
                            newImportStatement = `import { ${importName} } from '${importPath.slice(1)}';`;
                            console.log("Adding named import statement: " + newImportStatement);
                        } else {
                            newImportStatement = `import ${importName} from '${importPath.slice(1)}';`;
                            console.log("Adding default import statement: " + newImportStatement);
                        }
                        importStatements.push(newImportStatement);
                    } else {
                        newImportStatement = generateOriginalImport(node);
                        console.log("Adding original import statement: " + newImportStatement);
                        importStatements.push(generateOriginalImport(node));
                    }
                });
            }
            if (!importPath.startsWith('.') && !path.isAbsolute(importPath)) { // indicates it is a node module
                console.log("Trying the node module case: ");
                const modulePath = path.join(projectPath, 'node_modules', importPath);
                const resolvedModulePaths = resolveModulePaths(modulePath);
                console.log("resolvedModulePaths: " + resolvedModulePaths.join('\n'));
                for (const resolvedModulePath of resolvedModulePaths) {
                    const fileContent = readFileWithExtensions(resolvedModulePath);
                    const fileAST = getAST(fileContent);
                    /*logAST(fileAST);
                    process.exit(0);*/
                    const namedExports = getNamedExportsRecursively(resolvedModulePath, fileAST);
                    console.log("namedExports from " + resolvedModulePath + ": " + namedExports.join('\n'));

                    node.specifiers.forEach((specifier: any) => {
                        if (specifier.type === 'ImportDefaultSpecifier') {
                            const importName = specifier.local.name;
                            if (namedExports.includes(importName)) {
                                newImportStatement = `import { ${importName} } from '${importPath}';`;
                                console.log("Adding named import statement: " + newImportStatement);
                            } else {
                                newImportStatement = `import ${importName} from '${importPath}';`;
                                console.log("Adding default import statement: " + newImportStatement);
                            }
                            importStatements.push(newImportStatement);
                        } else {
                            newImportStatement = generateOriginalImport(node);
                            console.log("Adding original import statement: " + newImportStatement);
                            importStatements.push(generateOriginalImport(node));
                        }
                    });
                }
            }
            if (newImportStatement == '') {
                newImportStatement = generateOriginalImport(node)
                console.log("None of the three common cases were successful: relative, .. relative, and module,");
                console.log("so adding original import statement: " + newImportStatement);
                importStatements.push(generateOriginalImport(node));
            }
        }
        
    }
    console.log("Corrected imports: " + importStatements.join('\n'))
    return importStatements.join('\n');
}

function getLastDir(filePath: string): string {
    // Normalize the path to handle different OS path separators
    const normalizedPath = filePath.replace(/\\/g, '/');
    
    // Split the path by '/' and filter out any empty strings
    const pathParts = normalizedPath.split('/').filter(part => part !== '');
    
    // Get the last directory
    // If the path ends with a slash or it does not have a file extension, the last element is the last directory
    // Otherwise, the second last element is the last directory (as the last part is the file)
    const lastPart = pathParts.pop();
    return lastPart && !lastPart.includes('.') ? lastPart : pathParts.pop() || '';
}

function resolveModulePaths(modulePath: string): string[] {
    let resolvedModulePaths = [];
    const packageJsonPath = path.join(modulePath, 'package.json');

    if (fs.existsSync(packageJsonPath)) {
        console.log("packageJsonPath: " + packageJsonPath)
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        if (packageJson.module && fs.existsSync(path.join(modulePath, packageJson.module))) {
            console.log("packageJson.module path: " + path.join(modulePath, packageJson.module))
            resolvedModulePaths.push(path.join(modulePath, packageJson.module))
        }
        if (packageJson.main && fs.existsSync(path.join(modulePath, packageJson.main))) {
            console.log("packageJson.main path: " + path.join(modulePath, packageJson.main))
            resolvedModulePaths.push(path.join(modulePath, packageJson.main))
        }
    }
    const indexJsPath = path.join(modulePath, 'index.js');
    const modulePathJs = `${modulePath}.js`;
    const moduleLastDirJs = path.join(modulePath, `${getLastDir(modulePath)}.js`);

    console.log("package's index.js path: " + indexJsPath);
    if (fs.existsSync(indexJsPath) && !resolvedModulePaths.includes(indexJsPath)) {
        console.log("confirmed existence");
        resolvedModulePaths.push(indexJsPath);
    }

    console.log("package's other root js path (no added .js): " + modulePath);
    if (fs.existsSync(modulePath) && !isDirectory(modulePath) && !resolvedModulePaths.includes(modulePath)) {
        console.log("confirmed existence");
        resolvedModulePaths.push(modulePath);
    }

    console.log("package's other root js path (added .js): " + modulePathJs);
    if (fs.existsSync(modulePathJs) && !resolvedModulePaths.includes(modulePathJs)) {
        console.log("confirmed existence");
        resolvedModulePaths.push(modulePathJs);
    }

    console.log("package's other root lastdir path (added .js): " + moduleLastDirJs);
    if (fs.existsSync(moduleLastDirJs) && !resolvedModulePaths.includes(moduleLastDirJs)) {
        console.log("confirmed existence");
        resolvedModulePaths.push(moduleLastDirJs);
    }
    return resolvedModulePaths;
}

function getNamedExportsRecursively(filePath: string, fileAST: any): string[] {
    let namedExports: string[] = [];
    let exportResolved = false;
  
    const visitNode = (node: any) => {
      if (node.type === 'ExportNamedDeclaration') {
        exportResolved = true;
        if (node.declaration) {
          if (node.declaration.declarations) {
            node.declaration.declarations.forEach((declaration: any) => {
              namedExports.push(declaration.id.name);
            });
          } else if (node.declaration.id) {
            namedExports.push(node.declaration.id.name);
          }
        } else if (node.specifiers) {
          node.specifiers.forEach((specifier: any) => {
            namedExports.push(specifier.exported.name);
          });
        }
      } else if (node.type === 'AssignmentExpression' && node.left.type === 'MemberExpression' && node.left.object.name === 'exports') {
        exportResolved = true;
        namedExports.push(node.left.property.name);
      } else if (node.type === 'CallExpression' && node.callee.name === 'require' && !exportResolved) {
        console.log("Found require");
        const requiredPath = node.arguments[0].value;
        const absoluteRequiredPath = path.resolve(path.dirname(filePath), requiredPath);
        try {
          const requiredContent = fs.readFileSync(absoluteRequiredPath, 'utf-8');
          const requiredAST = getAST(requiredContent);
          const nestedNamedExports = getNamedExportsRecursively(absoluteRequiredPath, requiredAST);
          namedExports = [...namedExports, ...nestedNamedExports];
        } catch (err) {
          // Handle potential error in reading required file
        }
      }
  
      // Recursively visit child nodes
      for (const key in node) {
        if (node[key] && typeof node[key] === 'object') {
          visitNode(node[key]);
        }
      }
    };
  
    for (const node of fileAST.body) {
      visitNode(node);
    }
  
    return namedExports;
  }

function isDirectory(path: string) {
    try {
      const stats = fs.lstatSync(path);
      return stats.isDirectory();
    } catch (err) {
      console.error(err);
      return false;
    }
  }

function getAbsoluteImportPath(projectPath: string, filePathInProject: string, importPath: string): string {
    // Resolve the directory of the file within the project
    const fileDir = path.dirname(path.join(projectPath, filePathInProject));
    
    // Resolve the absolute import path
    const absoluteImportPath = path.resolve(fileDir, importPath);
    
    return absoluteImportPath;
}

function existsSyncWithExtensions(filePathWithoutExtension: string): boolean {
    return fs.existsSync(filePathWithoutExtension) || fs.existsSync(`${filePathWithoutExtension}.js`)
        || fs.existsSync(`${filePathWithoutExtension}.jsx`) || fs.existsSync(`${filePathWithoutExtension}.ts`)
        || fs.existsSync(`${filePathWithoutExtension}.ts`) || fs.existsSync(`${filePathWithoutExtension}.tsx`)
}

function readFileWithExtensions(filePathWithoutExtension: string): string {
    const extensions = ['', '.js', '.jsx', '.ts', '.tsx'];

    for (const ext of extensions) {
        const fullPath = `${filePathWithoutExtension}${ext}`;
        try {
            const data = fs.readFileSync(fullPath, 'utf-8');
            return data;
        } catch (err: any) {
            if (err.code !== 'ENOENT') {
                throw err; // rethrow if it's an error other than file not found
            }
        }
    }

    throw new Error(`File not found: ${filePathWithoutExtension} with any of the extensions ${extensions.join(', ')}`);
}

function getNamedExports(fileAST: any): string[] {
    const namedExports: string[] = [];

    walk.simple(fileAST, {
        ExportNamedDeclaration(node: any) {
            if (node.declaration) {
                if (node.declaration.declarations) {
                    node.declaration.declarations.forEach((declaration: any) => {
                        namedExports.push(declaration.id.name);
                    });
                } else if (node.declaration.id) {
                    namedExports.push(node.declaration.id.name);
                }
            } else if (node.specifiers) {
                node.specifiers.forEach((specifier: any) => {
                    namedExports.push(specifier.exported.name);
                });
            }
        }
    });

    return namedExports;
}

function generateOriginalImport(node: any): string {
    const importNames = node.specifiers.map((specifier: any) => {
        if (specifier.type === 'ImportDefaultSpecifier') {
            return specifier.local.name;
        } else if (specifier.type === 'ImportSpecifier') {
            return specifier.imported.name;
        } else if (specifier.type === 'ImportNamespaceSpecifier') {
            return `* as ${specifier.local.name}`;
        }
    }).join(', ');

    return `import ${importNames} from '${node.source.value}';`;
}

function stripUse(file: string) {
    const lines = file.split('\n');
    let useDirectiveRemoved = false;

    const strippedLines = lines.filter(line => {
        if (!useDirectiveRemoved) {
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith("'use ") || trimmedLine.startsWith('"use ')) {
                useDirectiveRemoved = true;
                console.log("Found line that starts with use");
                return false;
            }
        }
        return true;
    });
    if (!useDirectiveRemoved)
        console.log("Didn't find line that starts with use");

    return strippedLines.join('\n');
}

function stripImports(file: string) {
    const lines = file.split('\n');
    let importSectionEnded = false;

    const strippedLines = lines.filter(line => {
        // If the import section has already ended, keep the line
        if (importSectionEnded) {
            return true;
        }
        // Check if the line is an import statement
        if (line.trim().startsWith('import ')) {
            return false;
        }
        // Check if the line is a blank line
        if (line.trim() === '') {
            return false;
        }
        // If it's not an import statement and not a blank line, mark the end of the import section
        importSectionEnded = true;
        return true;
    });

    return strippedLines.join('\n');
}

function joinUse(oldFile: string, newFile: string) {
    function extractUseDirective(fileContent: string) {
        const lines = fileContent.split('\n');
        for (const line of lines) {
            const trimmedLine = line.trim();
            const match = trimmedLine.match(/^['"]use \w+['"][;]?/);
            if (match) {
                return match[0];
            }
            if (trimmedLine.length > 0) {
                break;
            }
        }
        return '';
    }

    const newUseDirective = extractUseDirective(newFile);
    if (newUseDirective) {
        return newUseDirective;
    }

    const oldUseDirective = extractUseDirective(oldFile);
    return oldUseDirective || '';
}

function joinImports(existingFile: string, codeSnippet: string) {
    const newAST = getAST(codeSnippet);
    const oldAST = getAST(existingFile);
    const oldImports = new Map();
    const newImports = new Map();

    function collectImports(ast: any, importsMap: any) {
        walkSimple(ast, {
            ImportDeclaration(node) {
                node.specifiers.forEach(specifier => {
                    let importedName;
                    if (specifier.type === 'ImportSpecifier') {
                        importedName = specifier.imported.type === 'Identifier' 
                            ? specifier.imported.name 
                            : specifier.local.name;
                    } else {
                        importedName = specifier.local.name;
                    }
                    importsMap.set(importedName, node.source.value);
                });
            }
        });
    }

    collectImports(oldAST, oldImports);
    collectImports(newAST, newImports);

    // Combine the imports, preferring newImports if there's a conflict
    const combinedImports = new Map(oldImports);
    for (const [importedName, source] of newImports.entries()) {
        combinedImports.set(importedName, source);
    }

    // Format the combined imports into a string
    const joinedImports = Array.from(combinedImports.entries())
        .map(([importedName, source]) => {
            return `import ${importedName} from '${source}';`;
        })
        .join('\n');

    return joinedImports;
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
