import React, { useState, useCallback, useEffect } from "react";
import {
  Loader2,
  FileUp,
  FileCheck2,
  X,
  Wand2,
  AlertTriangle,
  Sun,
  Moon,
  Copy,
  Check,
} from "lucide-react";

export default function App() {
  const [file, setFile] = useState(null);
  const [extractedText, setExtractedText] = useState("");
  const [summary, setSummary] = useState("");
  const [summaryLength, setSummaryLength] = useState("medium");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [activeTab, setActiveTab] = useState("summary");
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [copied, setCopied] = useState(""); // track copy status
  const [pdfJsLoaded, setPdfJsLoaded] = useState(false); // track PDF.js load

  // PDF.js worker setup
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.min.js';
    script.onload = () => {
      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.worker.min.js';
        setPdfJsLoaded(true);
      }
    };
    script.onerror = () => {
      setError("Failed to load PDF.js library. PDF extraction will not work.");
    };
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  // Helper: Convert file → base64
  const fileToBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result.split(",")[1]);
      reader.onerror = (error) => reject(error);
    });

  // Dark mode persistence
  useEffect(() => {
    const prefersDark =
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark" || (!savedTheme && prefersDark)) {
      setIsDarkMode(true);
    }
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDarkMode]);

  // API call
  const callGeminiApi = useCallback(
    async (payload, retryCount = 3, delay = 1000) => {
      setError("");
      const apiKey = "AIzaSyBjzep_YdFP-E2LjiTrgm7FQAtfNi2pQfs";
        
      if (!apiKey) {
        setError("API key is missing. Please add it to your code.");
        return null;
      }

      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

      try {
        const response = await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorBody = await response.json();
          throw new Error(
            `API Error: ${response.status} ${response.statusText} - ${
              errorBody.error?.message || "Unknown error"
            }`
          );
        }

        const result = await response.json();
        const candidate = result.candidates?.[0];

        if (!candidate || !candidate.content?.parts?.[0]?.text) {
          throw new Error("Invalid response structure from API.");
        }

        return candidate.content.parts[0].text;
      } catch (e) {
        console.error(e);
        if (retryCount > 0) {
          await new Promise((res) => setTimeout(res, delay));
          return callGeminiApi(payload, retryCount - 1, delay * 2);
        } else {
          setError(`Failed to process the document. ${e.message}`);
          return null;
        }
      }
    },
    []
  );

  // Summarization
  const generateSummary = useCallback(
    async (textToSummarize, length) => {
      if (!textToSummarize) {
        setError("No text available to summarize.");
        return;
      }

      setIsLoading(true);
      setLoadingMessage("Generating summary...");
      setSummary("");

      const prompt = `You are an expert summarizer. Based on the following document text, generate a concise and informative ${length} summary. Capture the key points, main arguments, and conclusions accurately.\n---\n${textToSummarize}\n---\nSummary:`;

      const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.4,
          topK: 32,
          topP: 1,
          maxOutputTokens: 8192,
        },
      };

      const result = await callGeminiApi(payload);
      if (result) {
        setSummary(result);
        setActiveTab("summary");
      }
      setIsLoading(false);
      setLoadingMessage("");
    },
    [callGeminiApi]
  );
  
  // Text extraction
  const extractTextFromFile = useCallback(
    async (fileToProcess) => {
      if (!fileToProcess) return;

      setIsLoading(true);
      setLoadingMessage("Extracting text...");
      setError("");
      setExtractedText("");
      setSummary("");
      setActiveTab("summary");

      try {
        let text = "";
        const fileType = fileToProcess.type;

        if (fileType.startsWith("image/")) {
          const base64Image = await fileToBase64(fileToProcess);
          const payload = {
            contents: [
              {
                parts: [
                  {
                    text: "Extract all text from this document image. Preserve formatting and layout as much as possible.",
                  },
                  { inlineData: { mimeType: fileType, data: base64Image } },
                ],
              },
            ],
          };
          text = await callGeminiApi(payload);
        } else if (fileType === "application/pdf") {
          if (!pdfJsLoaded || !window.pdfjsLib) {
            throw new Error("PDF.js library is not loaded yet. Please wait a moment and try again.");
          }
          const arrayBuffer = await fileToProcess.arrayBuffer();
          const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          const numPages = pdf.numPages;
          let fullText = "";

          for (let i = 1; i <= numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item) => item.str).join(" ");
            fullText += pageText + "\n\n";
          }
          text = fullText;
        } else {
          throw new Error(
            "Unsupported file type. Please upload a PDF or an image (JPG, PNG, WEBP)."
          );
        }

        if (text) {
          setExtractedText(text);
          generateSummary(text, "medium");
        } else {
          setError("Could not extract any text from the document.");
        }
      } catch (e) {
        console.error(e);
        setError(`An error occurred during text extraction: ${e.message}`);
      } finally {
        setIsLoading(false);
        setLoadingMessage("");
      }
    },
    [callGeminiApi, generateSummary, pdfJsLoaded]
  );

  // File handlers
  const handleFileChange = (selectedFile) => {
    if (selectedFile) {
      setFile(selectedFile);
      extractTextFromFile(selectedFile);
    }
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files && e.dataTransfer.files[0];
    if (droppedFile) handleFileChange(droppedFile);
  };

  const handleDragEvents = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setIsDragging(true);
    else if (e.type === "dragleave") setIsDragging(false);
  };

  const handleReset = () => {
    setFile(null);
    setExtractedText("");
    setSummary("");
    setError("");
    setIsLoading(false);
    setLoadingMessage("");
  };

  const handleCopy = (text, type) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(""), 2000);
  };

  // --- UI ---
  const renderCopyButton = (text, type) =>
    text && (
      <button
        onClick={() => handleCopy(text, type)}
        className="ml-3 inline-flex items-center px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-indigo-200 dark:hover:bg-indigo-600 active:scale-95 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        style={{ cursor: 'pointer' }}
      >
        {copied === type ? (
          <>
            <Check className="w-4 h-4 mr-1" /> Copied
          </>
        ) : (
          <>
            <Copy className="w-4 h-4 mr-1" /> Copy
          </>
        )}
      </button>
    );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 font-sans text-gray-800 dark:text-gray-200 antialiased overflow-hidden">
      {/* Floating study-related SVG icons background */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 w-full h-full"
        style={{ background: 'none' }}
      >
        <svg width="100%" height="100%" viewBox="0 0 1920 1080" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ position: 'absolute', width: '100%', height: '100%' }}>
          {/* Floating Pen */}
          <g opacity="0.13">
            <g style={{ transform: 'translateY(0px)', animation: 'float1 7s ease-in-out infinite alternate' }}>
              <path d="M220 120 l40 40 -80 80 -40 -40z" fill="#fbbf24"/>
              <rect x="200" y="100" width="60" height="20" rx="8" fill="#6366f1"/>
            </g>
            {/* Floating Paper */}
            <g style={{ transform: 'translateY(0px)', animation: 'float2 8s ease-in-out infinite alternate' }}>
              <rect x="600" y="320" width="70" height="90" rx="10" fill="#f3f4f6" stroke="#a5b4fc" strokeWidth="3"/>
              <rect x="615" y="340" width="40" height="8" rx="2" fill="#a5b4fc"/>
              <rect x="615" y="355" width="30" height="6" rx="2" fill="#a5b4fc"/>
            </g>
            {/* Floating Pencil */}
            <g style={{ transform: 'translateY(0px)', animation: 'float3 6s ease-in-out infinite alternate' }}>
              <rect x="1200" y="220" width="18" height="90" rx="9" fill="#f87171"/>
              <polygon points="1209,220 1209,210 1218,220" fill="#fbbf24"/>
            </g>
            {/* Floating PDF icon */}
            <g style={{ transform: 'translateY(0px)', animation: 'float4 9s ease-in-out infinite alternate' }}>
              <rect x="1600" y="520" width="60" height="80" rx="10" fill="#fca5a5"/>
              <rect x="1610" y="530" width="40" height="10" rx="2" fill="#fff"/>
              <text x="1630" y="570" fontSize="22" fontWeight="bold" fill="#ef4444" style={{ fontFamily: 'Arial, sans-serif' }}>PDF</text>
            </g>
            {/* Floating Notes icon */}
            <g style={{ transform: 'translateY(0px)', animation: 'float5 7.5s ease-in-out infinite alternate' }}>
              <rect x="900" y="720" width="80" height="60" rx="10" fill="#f9a8d4"/>
              <rect x="915" y="735" width="50" height="8" rx="2" fill="#fff"/>
              <rect x="915" y="750" width="30" height="6" rx="2" fill="#fff"/>
            </g>
          </g>
          <style>{`
            @keyframes float1 { 0%{transform:translateY(0);} 100%{transform:translateY(30px);} }
            @keyframes float2 { 0%{transform:translateY(0);} 100%{transform:translateY(25px);} }
            @keyframes float3 { 0%{transform:translateY(0);} 100%{transform:translateY(40px);} }
            @keyframes float4 { 0%{transform:translateY(0);} 100%{transform:translateY(20px);} }
            @keyframes float5 { 0%{transform:translateY(0);} 100%{transform:translateY(35px);} }
          `}</style>
        </svg>
      </div>
      <div className="relative container mx-auto px-4 py-8 sm:py-12 z-10">
        {/* Dark mode toggle */}
        <div className="absolute top-4 right-4 z-10">
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-2 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-indigo-200 dark:hover:bg-indigo-600 active:scale-95 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            style={{ cursor: 'pointer' }}
          >
            {isDarkMode ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />}
          </button>
        </div>

        {/* Header */}
        <header className="text-center mb-10 sm:mb-16">
          <h1
            className="text-4xl sm:text-5xl font-bold tracking-tight bg-gradient-to-r from-indigo-600 to-purple-500 text-transparent bg-clip-text transition-all duration-300 hover:scale-105 animated-gradient"
            style={{
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
              cursor: 'pointer',
            }}
          >
                Documind
          </h1>
      {/* Animated gradient keyframes */}
      <style>{`
        .animated-gradient {
          background-size: 200% 200%;
          animation: gradientMove 3s linear infinite;
        }
        @keyframes gradientMove {
          0% {
            background-position: 0% 50%;
            background-image: linear-gradient(270deg, #6366f1, #a21caf, #f59e42, #10b981, #6366f1);
          }
          25% {
            background-position: 50% 100%;
            background-image: linear-gradient(270deg, #a21caf, #f59e42, #10b981, #6366f1, #a21caf);
          }
          50% {
            background-position: 100% 50%;
            background-image: linear-gradient(270deg, #f59e42, #10b981, #6366f1, #a21caf, #f59e42);
          }
          75% {
            background-position: 50% 0%;
            background-image: linear-gradient(270deg, #10b981, #6366f1, #a21caf, #f59e42, #10b981);
          }
          100% {
            background-position: 0% 50%;
            background-image: linear-gradient(270deg, #6366f1, #a21caf, #f59e42, #10b981, #6366f1);
          }
        }
      `}</style>
          <p className="mt-3 max-w-2xl mx-auto text-lg text-gray-600 dark:text-gray-400">
            Effortlessly extract text from your documents and generate concise, intelligent summaries.
          </p>
        </header>

        {/* Error */}
        {error && (
          <div className="w-full max-w-3xl mb-6 p-4 flex items-start space-x-3 text-red-800 bg-red-100 border-red-200 dark:bg-red-900/20 dark:border-red-500/30 dark:text-red-300 rounded-lg shadow-sm">
            <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-semibold">An Error Occurred</h4>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* File Upload or Content */}
        {!file ? (
          <div
            className={`relative w-full max-w-3xl mx-auto p-8 sm:p-10 border-2 border-dashed rounded-3xl text-center transition-all duration-150 cursor-pointer ${
              isDragging
                ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 scale-105 shadow-lg"
                : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/10 hover:scale-[1.01]"
            }`}
            onDrop={handleFileDrop}
            onDragOver={handleDragEvents}
            onDragEnter={handleDragEvents}
            onDragLeave={handleDragEvents}
            tabIndex={0}
            role="button"
            aria-label="Upload document"
          >
            <div className="flex flex-col items-center justify-center space-y-4 text-gray-600 dark:text-gray-400">
              <FileUp className="w-16 h-16 text-gray-400 dark:text-gray-500" strokeWidth={1} />
              <p className="text-lg">
                <label
                  htmlFor="file-upload"
                  className={`font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 transition-all duration-150 cursor-pointer active:scale-95 focus:outline-none focus:ring-2 focus:ring-indigo-400 ${!pdfJsLoaded ? 'opacity-50 cursor-not-allowed' : ''}`}
                  style={!pdfJsLoaded ? { pointerEvents: 'none' } : { cursor: 'pointer' }}
                  tabIndex={pdfJsLoaded ? 0 : -1}
                >
                  Click to upload a document
                </label>
                <span className="hidden sm:inline"> or drag and drop</span>
              </p>
              <p className="text-sm text-gray-500">Supports PDF, JPG, PNG, WEBP</p>
              {!pdfJsLoaded && (
                <p className="text-xs text-red-500 mt-2">PDF.js is loading... PDF upload will be enabled soon.</p>
              )}
            </div>
            <input
              id="file-upload"
              type="file"
              className="sr-only"
              accept=".pdf,image/*"
              onChange={(e) => handleFileChange(e.target.files[0])}
              disabled={isLoading || !pdfJsLoaded}
            />
          </div>
        ) : (
          <div className="w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left controls */}
            <div className="lg:col-span-4 space-y-6">
              <div className="p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-sm">
                <h2 className="text-lg font-semibold mb-4">Uploaded Document</h2>
                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl flex items-center justify-between">
                  <FileCheck2 className="w-6 h-6 text-green-500" />
                  <span className="font-medium truncate">{file.name}</span>
                  <button onClick={handleReset} className="p-1.5 rounded-full hover:bg-red-100 dark:hover:bg-red-900 active:scale-95 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-red-400" style={{ cursor: 'pointer' }}>
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-sm">
                <h2 className="text-lg font-semibold mb-4">Summary Options</h2>
                <div className="flex items-center p-1 space-x-1 bg-gray-100 dark:bg-gray-900 rounded-xl">
                  {["short", "medium", "long"].map((len) => (
                    <button
                      key={len}
                      onClick={() => setSummaryLength(len)}
                      className={`w-full px-3 py-2 text-sm font-semibold rounded-lg transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-400 active:scale-95 ${
                        summaryLength === len
                          ? 'bg-white dark:bg-gray-700 text-indigo-600 shadow-md'
                          : 'text-gray-600 hover:bg-indigo-100 dark:hover:bg-indigo-900'
                      }`}
                      style={{ cursor: 'pointer' }}
                    >
                      {len}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => generateSummary(extractedText, summaryLength)}
                  disabled={!extractedText || isLoading}
                  className="w-full mt-5 flex items-center justify-center px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 active:scale-95 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  style={{ cursor: !extractedText || isLoading ? 'not-allowed' : 'pointer' }}
                >
                  <Wand2 className="w-5 h-5 mr-2" /> Regenerate Summary
                </button>
              </div>
            </div>

            {/* Right content */}
            <div className="lg:col-span-8">
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm h-full min-h-[500px]">
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center h-full">
                    <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
                    <p className="text-lg">{loadingMessage}</p>
                  </div>
                ) : (
                  (summary || extractedText) && (
                    <div className="flex flex-col h-full">
                      <div className="p-4 border-b flex space-x-2">
                        <button
                          onClick={() => setActiveTab("summary")}
                          className={`px-4 py-2 text-sm font-semibold rounded-md transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-400 active:scale-95 ${
                            activeTab === "summary"
                              ? "bg-indigo-100 dark:bg-indigo-700 text-indigo-900 dark:text-white shadow-md"
                              : "hover:bg-indigo-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
                          }`}
                          style={{ cursor: 'pointer' }}
                        >
                          Summary
                        </button>
                        <button
                          onClick={() => setActiveTab("text")}
                          className={`px-4 py-2 text-sm font-semibold rounded-md transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-400 active:scale-95 ${
                            activeTab === "text"
                              ? "bg-indigo-100 dark:bg-indigo-700 text-indigo-900 dark:text-white shadow-md"
                              : "hover:bg-indigo-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
                          }`}
                          style={{ cursor: 'pointer' }}
                        >
                          Extracted Text
                        </button>
                      </div>
                      <div className="p-6 overflow-y-auto flex-grow">
                        {activeTab === "summary" && (
                          <>
                            <div className="flex items-center mb-3">
                              <h3 className="text-xl font-semibold">Generated Summary</h3>
                              {renderCopyButton(summary, "summary")}
                            </div>
                            <p className="whitespace-pre-wrap">{summary}</p>
                          </>
                        )}
                        {activeTab === "text" && (
                          <>
                            <div className="flex items-center mb-3">
                              <h3 className="text-xl font-semibold">Extracted Text</h3>
                              {renderCopyButton(extractedText, "text")}
                            </div>
                            <p className="whitespace-pre-wrap">{extractedText}</p>
                          </>
                        )}
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
