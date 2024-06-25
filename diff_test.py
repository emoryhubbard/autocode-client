import difflib

def read_file(filename):
    with open(filename, 'r') as file:
        return file.readlines()
    
def print_diffs(text1, text2):
    sequence_matcher = difflib.SequenceMatcher(None, text1, text2)
    for tag, i1, i2, j1, j2 in sequence_matcher.get_opcodes():
        if tag == 'replace':
            print(f"Replace text from text1[{i1}:{i2}] with text2[{j1}:{j2}]:")
            print(f"text1: {text1[i1:i2]}")
            print(f"text2: {text2[j1:j2]}")
        elif tag == 'delete':
            print(f"Delete text1[{i1}:{i2}]:")
            print(f"text1: {text1[i1:i2]}")
        elif tag == 'insert':
            print(f"Insert text2[{j1}:{j2}] at text1[{i1}]:")
            print(f"text2: {text2[j1:j2]}")
        elif tag == 'equal':
            print(f"Equal text1[{i1}:{i2}] and text2[{j1}:{j2}]:")
            print(f"text: {text1[i1:i2]}")

def print_single_line_diffs(text1_lines, text2_lines):
    differ = difflib.Differ()
    diffs = list(differ.compare(text1_lines, text2_lines))

    print("Differences:")
    for line in diffs:
        print(line)
        print("End of diff")

def main():
    # Read the contents of the text files
    text1_lines = read_file('text1.txt')
    text2_lines = read_file('text2.txt')

    # Print the diffs
    print_diffs(text1_lines, text2_lines)

if __name__ == "__main__":
    main()
