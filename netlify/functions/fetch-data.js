// This is the simplified server-side function.
// It only processes text from uploaded files.

exports.handler = async (event) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: "API key is not configured on the server." }) };
  }

  try {
    const { text, firstPageText, fileName } = JSON.parse(event.body);

    if (!text) {
        return { statusCode: 400, body: JSON.stringify({ error: "No text content found to analyze." }) };
    }

    const prompt = `From the text provided, extract the following information and return it as a single JSON object.

1.  **companyName**: Determine the primary company name. To do this, ONLY consider the provided filename and the text from the first page of the document. Do NOT look for the company name in the rest of the document text.
2.  **rfpNumber**: The RFP Number (e.g., RFP_2502, RFP 2502, RFP-2502). Find this anywhere in the full document text.
3.  **itemNumber**: The Item Number (e.g., Item-18, Item 18, Item_18). Find this anywhere in the full document text.
4.  **people**: An array of objects, where each object represents a person mentioned anywhere in the full document text.

For each person in the 'people' array, extract the following fields:
- **name**: The person's full name.
- **company**: The company they work for. If it's the same as the main companyName you identified, use that.
- **is_pe**: A string, "Yes" if they have a "PE" designation, otherwise "No".
- **discipline**: Their engineering or professional discipline (e.g., "Roadway", "Hydraulics", "Pavement", "Bridge", "Project Management"). If not clear, use "N/A".
- **yoe**: The person's total years of professional experience as a number. If not found, use "N/A".
- **location**: Their office location (City, State) if mentioned. If not found, use "N/A".

If a top-level field (like rfpNumber) is not found, its value should be "N/A". If no people are found, the 'people' array should be empty.

**Context for Company Name:**
- Filename: "${fileName}"
- First Page Text: "${firstPageText}"

**Full Document Text for all other fields:**
---
${text}
---
`;
    const payload = { contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } };
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const geminiResponse = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!geminiResponse.ok) throw new Error(`Gemini API request failed with status ${geminiResponse.status}`);
    
    const result = await geminiResponse.json();

    if (result.candidates && result.candidates[0].content && result.candidates[0].content.parts[0]) {
        const jsonText = result.candidates[0].content.parts[0].text;
        let parsedJson = JSON.parse(jsonText);

        if (parsedJson.people && Array.isArray(parsedJson.people)) {
            parsedJson.people.forEach(person => {
                const yoe = parseInt(person.yoe, 10);

                if (isNaN(yoe) || person.yoe === 'N/A' || person.yoe === null) {
                    person.yoe = 'N/A';
                    person.role = 'N/A';
                } else {
                    person.yoe = yoe; // Ensure it's a number for consistency
                    if (yoe <= 1) person.role = 'entry';
                    else if (yoe <= 4) person.role = 'junior';
                    else if (yoe <= 8) person.role = 'mid';
                    else if (yoe <= 12) person.role = 'senior';
                    else if (yoe <= 15) person.role = 'lead';
                    else person.role = 'principle';
                }
            });
        }
        result.candidates[0].content.parts[0].text = JSON.stringify(parsedJson);
    }

    return { statusCode: 200, body: JSON.stringify(result) };

  } catch (error) {
    console.error("Function Error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
