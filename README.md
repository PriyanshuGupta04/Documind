# 📄 Documind

An AI-powered web app that allows you to **upload PDFs or images**, extract the text, and generate **smart summaries** (short, medium, or long). Built with **React, Vite, TailwindCSS, and Lucide Icons**.

---

## 🚀 Features
- 📂 Upload **PDF or Image (JPG, PNG, WEBP)** files  
- 🔍 Automatic **text extraction** (using PDF.js or AI OCR)  
- ✨ Generate **summaries** (short, medium, long)  
- ⚡ Clean and responsive UI with TailwindCSS  
- 🔄 Drag & Drop file upload  
- 🪄 AI-powered summarization  

---

## 🛠️ Tech Stack
- **React 18** (Frontend Framework)  
- **Vite** (Build Tool)  
- **TailwindCSS** (Styling)  
- **Lucide-react** (Icons)  
- **PDF.js** (Extract text from PDFs)  
- **Gemini API / Any LLM API** (for AI summarization)  

---

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/document-summary-assistant.git
   cd document-summary-assistant

2. **Install dependencies**
   ```bash
   npm install



3. **Set up environment variables**  
Create a `.env` file in the root directory:

   ```env
   VITE_GEMINI_API_KEY=your_google_ai_api_key_here



4. **Run the development server**
   ```bash
   npm run dev

5. **Open your browser at**  
   👉 ```text
   http://localhost:5173

## ⚠️ Notes on API Usage

  - The project is configured for **Google Gemini API** by default.  
  - You must generate an API key at [AI Studio](https://aistudio.google.com/app/apikey).  
  - Free quota is limited — for unlimited usage, you can connect the app to:  
    - **Groq API** (free, runs LLaMA 3 fast)  
    - **Together.ai**  
    - **Local LLMs with Ollama**  



## 🤝 Contributing

   Contributions, issues, and feature requests are welcome!  
   Feel free to open an issue or submit a pull request.


## 📜 License  

   This project is licensed under the **MIT License**.  

   

