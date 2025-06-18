// 這是一個在 Vercel 伺服器上運行的 Node.js 後端函式。
// 它的主要工作是安全地代理您的請求到 Google API。

export default async function handler(request, response) {
  // 為了安全，我們只允許 POST 方法的請求
  if (request.method !== 'POST') {
    return response.status(405).json({ message: 'Only POST requests are allowed' });
  }

  // 從 Vercel 平台的「環境變數」中安全地讀取您的 API 金鑰。
  // 這個金鑰絕不會暴露給前端或使用者。
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    // 如果伺服器上沒有設定金鑰，回傳一個內部錯誤
    return response.status(500).json({ message: 'API key is not configured on the server.' });
  }

  // 從前端發來的請求中，讀取 'prompt' 的內容
  const { prompt } = request.body;

  if (!prompt) {
    // 如果請求中沒有包含 prompt，回傳一個客戶端錯誤
    return response.status(400).json({ message: 'Prompt is required in the request body.' });
  }

  // 這是真正的 Google Gemini API 端點
  const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro-latest:generateContent';

  // 這是要發送給 Google API 的請求主體 (payload)
  const payload = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
    }
  };

  try {
    // 使用 fetch API，從我們的後端伺服器向 Google API 發送請求
    const geminiResponse = await fetch(`${API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    // 如果 Google API 回傳了錯誤，我們將其轉發給前端
    if (!geminiResponse.ok) {
      const errorBody = await geminiResponse.text();
      console.error("Google API Error:", errorBody);
      return response.status(geminiResponse.status).json({ message: `Error from Google API: ${errorBody}` });
    }

    // 解析從 Google API 收到的 JSON 回應
    const data = await geminiResponse.json();

    // 從複雜的 API 回應結構中，提取出我們需要的純文字 JSON 計劃
    const generatedPlanText = data.candidates[0].content.parts[0].text;
    
    // 將純文字 JSON 格式的計劃回傳給我們的前端
    // 設定 'Content-Type' 為 'application/json'，讓瀏覽器知道這是一個 JSON 物件
    response.setHeader('Content-Type', 'application/json');
    return response.status(200).send(generatedPlanText);

  } catch (error) {
    // 如果過程中發生任何其他網路或伺服器錯誤，記錄下來並回傳一個通用錯誤
    console.error("Internal Server Error:", error);
    return response.status(500).json({ message: 'An internal server error occurred while contacting the AI service.' });
  }
}
