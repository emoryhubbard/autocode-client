from flask import Flask, request, jsonify
import difflib

app = Flask(__name__)

def read_file(filename):
    with open(filename, 'r') as file:
        return file.readlines()
    
def write_file(text, filename):
    with open(filename, 'w') as file:
        file.write(text)

def replace_nbsp_with_space(text):
    """
    Replaces all occurrences of Non-Breaking Space (NBSP) with a regular space in the given text.

    :param text: The input string containing NBSP characters.
    :return: A new string with NBSP characters replaced by regular spaces.
    """
    # NBSP character in Unicode
    nbsp = '\u00A0'
    # Replace NBSP with regular space
    return text.replace(nbsp, ' ')

def get_diffs(text1, text2):
    text1 = replace_nbsp_with_space(text1).splitlines()
    text2 = replace_nbsp_with_space(text2).splitlines()
    sequence_matcher = difflib.SequenceMatcher(None, text1, text2)
    diffs = []
    text1_lines = read_file('text1.txt')
    text2_lines = read_file('text2.txt')
    newline_char = '\n'

    if text1 == text1_lines:
        print("text1 is equal to text1_lines")
    else:
        print("test1 is not equal to text1_lines")
        write_file("\n".join(text1), 'text1_actual.txt')
    
    if text2 == text2_lines:
        print("text2 is equal to text2_lines")
    else:
        print("test2 is not equal to text2_lines")
        write_file("\n".join(text2), 'text2_actual.txt')

    for tag, i1, i2, j1, j2 in sequence_matcher.get_opcodes():
        print(f'Raw diff: {tag}, {i1}, {i2}, {j1}, {j2}')
        '''diffs.append({
            'tag': tag,
            'i1': i1,
            'i2': i2,
            'j1': j1,
            'j2': j2
        })'''
        if tag == 'replace':
            print(f"Replace text from text1[{i1}:{i2}] with text2[{j1}:{j2}]:")
            print(f"text1: {newline_char.join(text1[i1:i2])}")
            print(f"text2: {newline_char.join(text2[j1:j2])}")
            diffs.append({
                'type': 'replace',
                'text1': '\n'.join(text1[i1:i2]),
                'text2': '\n'.join(text2[j1:j2]),
                'text1_range': [i1, i2],
                'text2_range': [j1, j2]
            })
        elif tag == 'delete':
            print(f"Delete text1[{i1}:{i2}]:")
            print(f"text1: {newline_char.join(text1[i1:i2])}")
            diffs.append({
                'type': 'delete',
                'text1': '\n'.join(text1[i1:i2]),
                'text1_range': [i1, i2]
            })
        elif tag == 'insert':
            print(f"Insert text2[{j1}:{j2}] at text1[{i1}]:")
            print(f"text2: {newline_char.join(text2[j1:j2])}")
            diffs.append({
                'type': 'insert',
                'text2': '\n'.join(text2[j1:j2]),
                'text2_range': [j1, j2]
            })
        elif tag == 'equal':
            print(f"Equal text1[{i1}:{i2}] and text2[{j1}:{j2}]:")
            print(f"text: {newline_char.join(text1[i1:i2])}")
            diffs.append({
                'type': 'equal',
                'text': '\n'.join(text1[i1:i2]),
                'text1_range': [i1, i2],
                'text2_range': [j1, j2]
            })

    return diffs

@app.route('/get-diffs', methods=['POST'])
def diff():
    data = request.get_json()
    text1 = data.get('text1')
    text2 = data.get('text2')

    if text1 is None or text2 is None:
        return jsonify({'error': 'Both text1 and text2 are required.'}), 400

    diffs = get_diffs(text1, text2)
    return jsonify({'diffs': diffs})

if __name__ == '__main__':
    app.run(debug=True, port=54787)
