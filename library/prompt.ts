
export async function prompt(prompt: string, apiKey: string): Promise<string> {
    let retries = 3; // Retry up to 3 times
    while (retries > 0) {
        try {
            const startTime = new Date().getTime(); // Get start time in milliseconds
            const MODEL = {} as any;
            console.log("Time elapsed for API call: "
                + (((new Date().getTime()) - startTime) / 1000) + " sec"
                + ", estimated total for all API calls for 5-step feature is " + (((new Date().getTime()) - startTime) / 1000) * 3 * 5 + " sec"); // Convert milliseconds to seconds
            /* You can encode API call expressions for .env variables using
            http://coderstoolbox.net/string/#!encoding=js&action=encode&charset=utf_8 
            You may need to backspace the escape characters for the single quotes if
            you need to use double quotes for the .env delimiters*/

            /*const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [{ role: 'user', content: prompt}],
                    temperature: 0.7,
                }),
                });*/

            /*const response = await fetch('https://api.groq.com/openai/v1', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer GROQ_APIKEY`,
                },
                body: JSON.stringify({
                    model: 'llama3-70b-8192',
                    messages: [{ role: 'user', content: prompt}],
                    temperature: 0.7,
                }),
                });*/
            
            let code = '';
            if (MODEL.ok) {
                const responseData = await MODEL.json();
                code = responseData.choices[0].message.content;
            } else {
                console.error('Failed to fetch data:', MODEL.status, MODEL.statusText);
                code = "Failed to fetch data: " + MODEL.status + " " + MODEL.statusText;
            }
            return code;
        } catch (error) {
            console.error('Error fetching data:', error);
            retries--;
        }
    }
    throw new Error('Failed to fetch data after multiple retries');
}
