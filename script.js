const container = document.querySelector(".chats-container");
const chatContainer = document.querySelector(".chats-container");
const promptForm = document.querySelector(".prompt-form");
const promptInput = promptForm.querySelector(".prompt-input");
const fileInput = promptForm.querySelector("#file-input");
const fileUploadWrapper = promptForm.querySelector(".file-upload-wrapper");
const themeToggle = document.querySelector("#theme-toggle-btn");
const API_KEY = "AIzaSyBGsEs3D94DbQWwPU270K5-s9Qtu6-aKMk";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;

let typingInterval, controller;
const userData = { message: "", file: {} };
const chatHistory = [];

const createMsgElement = (content, ...classes) => {
    const div = document.createElement("div");
    div.classList.add("message", ...classes);
    div.innerHTML = content;
    return div;
};

const scrollToBottom = () => {
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
};

const typingEffect = (text, textElement, botMessageDiv) => {
    textElement.textContent = "";
    const words = text.split(" ");
    let wordIndex = 0;
    typingInterval = setInterval(() => {
        if (wordIndex < words.length) {
            textElement.textContent += (wordIndex === 0 ? "" : " ") + words[wordIndex++];
            scrollToBottom();
        } else {
            clearInterval(typingInterval);
            botMessageDiv.classList.remove("loading");
            document.body.classList.remove("bot-responding");
        }
    }, 50); 
};

const generateBotResponse = async (botMessageDiv) => {
    const textElement = botMessageDiv.querySelector(".message-text");
    controller = new AbortController();

    // Add user message to chat history
    chatHistory.push({
        role: "user",
        parts: [{ text: userData.message }, ...(userData.file.data ? [{ inline_data: (({ fileName, isImage, ...rest }) => rest)(userData.file) }] : [])]
    });

    try {
        // Send chat history to API to get response
        const response = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: chatHistory }),
            signal: controller.signal
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error.message);

        let responseText = data.candidates[0].content.parts[0].text.replace(/\*\*([^*]+)\*\*/g, "$1").trim();

        // Detect if the response contains code 
        const codeBlockRegex = /```([\s\S]*?)```/g;
        let formattedText = responseText;
        if (codeBlockRegex.test(responseText)) {
            formattedText = responseText.replace(codeBlockRegex, (match, code) => {
                return `<pre><code>${code.trim()}</code></pre>`;
            });
            textElement.innerHTML = "";
            botMessageDiv.classList.remove("loading");
            document.body.classList.remove("bot-responding");
            textElement.innerHTML = formattedText;
        } else {
            typingEffect(responseText, textElement, botMessageDiv);
        }

        chatHistory.push({
            role: "model",
            parts: [{ text: responseText }]
        });

    } catch (error) {
        textElement.style.color = "#d62939";
        textElement.textContent = error.name === "AbortError" ? "Response generation stopped" : error.message;
        botMessageDiv.classList.remove("loading");
        document.body.classList.remove("bot-responding");
    } finally {
        userData.file = {};
    }
};

const handleFormSubmit = (e) => {
    e.preventDefault();
    let userMessage = promptInput.value.trim();
    if (!userMessage) return;
    promptInput.value = "";
    userData.message = userMessage;
    document.body.classList.add("bot-responding", "chats-active");
    fileUploadWrapper.classList.remove("active", "img-attached", "file-attached");

    const userMessageHtml = `
        <p class="message-text"></p>
        ${userData.file.data ? (userData.file.isImage
            ? `<img src="data:${userData.file.mime_type};base64,${userData.file.data}" class="img-attachment" />`
            : `<p class="file-attachment"><span class="material-symbols-rounded">description</span> ${userData.file.fileName}</p>`)
        : ""}
    `;

    const userMessageDiv = createMsgElement(userMessageHtml, "user-message");
    userMessageDiv.querySelector(".message-text").textContent = userMessage;
    chatContainer.appendChild(userMessageDiv);
    scrollToBottom();

    setTimeout(() => {
        const botMessageHtml = `
            <div class="bot-message" style="margin:15px">
                <img src="gemini-chatbot-logo.svg" alt="" class="avatar">
                <p class="message-text">Just a sec...</p>
            </div>
        `;
        const botMessageDiv = createMsgElement(botMessageHtml, "bot-message", "loading");
        chatContainer.appendChild(botMessageDiv);
        scrollToBottom();
        generateBotResponse(botMessageDiv);
    }, 600);
};

// Handle file upload
fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (!file) return;

    const isImage = file.type.startsWith("image/");
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
        fileInput.value = "";
        const base64String = e.target.result.split(",")[1];
        fileUploadWrapper.querySelector(".file-preview").src = e.target.result;
        fileUploadWrapper.classList.add("active", isImage ? "img-attached" : "file-attached");
        userData.file = { fileName: file.name, data: base64String, mime_type: file.type, isImage };
    };
});

// Cancel upload
document.querySelector("#cancel-file-btn").addEventListener("click", () => {
    userData.file = {};
    fileUploadWrapper.classList.remove("active", "img-attached", "file-attached");
});

// Stop response
document.querySelector("#stop-response-btn").addEventListener("click", () => {
    userData.file = {};
    controller?.abort();
    clearInterval(typingInterval);
    chatContainer.querySelector(".bot-message.loading")?.classList.remove("loading");
    document.body.classList.remove("bot-responding");
});

document.querySelectorAll(".suggestions-item").forEach(item => {
    item.addEventListener("click", () => {
        promptInput.value = item.querySelector(".text").textContent;
        promptForm.dispatchEvent(new Event("submit"));
    });
});

// Toggle theme
themeToggle.addEventListener("click", () => {
    const isLight = document.body.classList.toggle("light-theme");
    localStorage.setItem("themeColor", isLight ? "light_mode" : "dark_mode");
    themeToggle.textContent = isLight ? "dark_mode" : "light_mode";
});

// Initialize theme
const isLight = localStorage.getItem("themeColor") === "light_mode";
document.body.classList.toggle("light-theme", isLight);
themeToggle.textContent = isLight ? "dark_mode" : "light_mode";

promptForm.addEventListener("submit", handleFormSubmit);
promptForm.querySelector("#add-file-btn").addEventListener("click", () => fileInput.click());
