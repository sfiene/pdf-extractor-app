// This is your secure, server-side function.
// It will run on Netlify's servers, not in the user's browser.

exports.handler = async (event) => {
  // 1. Get the secret API key from Netlify's environment variables.
  //    You will set this up in the Netlify UI.
  const apiKey = process.env.GEMINI_API_KEY;

  // 2. Check if the API key is available.
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "API key is not configured on the server." }),
    };
  }
  
  // 3. Get the text from the PDF that was sent from the frontend.
  const { text, firstPageText, fileName } = JSON.parse(event.body);

  if (!text) {
      return {
          statusCode: 400,
          body: JSON.stringify({ error: "No text provided to analyze." }),
      };
  }

  // 4. Prepare the request to the Google Gemini API.
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
- **role**: Their seniority level, categorized as "Senior", "Mid", or "Junior" based on their title (e.g., "Principal" is Senior, "Engineer" is Mid). If not clear, use "N/A".
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

  try {
    // 5. Make the secure API call from the server.
    const response = await fetch(apiUrl, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(payload) 
    });

    if (!response.ok) {
        const errorBody = await response.text();
        console.error("API Error:", errorBody);
        return {
            statusCode: response.status,
            body: JSON.stringify({ error: `API request failed with status ${response.status}` }),
        };
    }

    const result = await response.json();

    // 6. Send the result back to the frontend.
    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };

  } catch (error) {
    console.error("Function Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
