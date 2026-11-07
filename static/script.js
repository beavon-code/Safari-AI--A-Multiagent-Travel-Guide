
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");

const welcomeSection = document.getElementById("welcomeSection");
const conversation = document.getElementById("conversation");
const chatMessages = document.getElementById("chatMessages");

const loadingIndicator = document.getElementById("loadingIndicator");

const newChatBtn = document.getElementById("newChatBtn");

let threadId = localStorage.getItem("safari_thread_id") || null;
let isLoading = false;


// -----------------------------
// MESSAGE RENDERING
// -----------------------------

function addMessage(role, message) {

    welcomeSection.style.display = "none";
    conversation.classList.add("visible");

    const messageElement = document.createElement("div");

    messageElement.className = `message ${role}`;

    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.textContent = role === "user" ? "👤" : "🌍";

    const content = document.createElement("div");
    content.className = "message-content";

    const sender = document.createElement("strong");
    sender.textContent = role === "user" ? "You" : "Safari AI";

    const bubble = document.createElement("div");
    bubble.className = "message-bubble";

    // Use textContent to avoid rendering untrusted HTML.
    bubble.textContent = String(message ?? "");

    content.append(sender, bubble);
    messageElement.append(avatar, content);

    chatMessages.appendChild(messageElement);

    conversation.scrollTop = conversation.scrollHeight;
}


// -----------------------------
// LOADING STATE
// -----------------------------

function setLoading(value) {

    isLoading = value;

    loadingIndicator.classList.toggle("visible", value);

    sendBtn.disabled = value;
    sendBtn.innerHTML = value ? "..." : "➤";

    messageInput.disabled = value;
}


// -----------------------------
// SEND MESSAGE TO BACKEND
// -----------------------------

async function sendMessage(message) {

    message = message.trim();

    if (!message || isLoading) return;

    addMessage("user", message);

    messageInput.value = "";

    messageInput.style.height = "45px";

    setLoading(true);

    try {

        const response = await fetch("/api/travel", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                message: message,
                thread_id: threadId
            })

        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.error || "Something went wrong.");
        }

        // Preserve the conversation ID.
        if (data.thread_id) {

            threadId = data.thread_id;

            localStorage.setItem(
                "safari_thread_id",
                threadId
            );
        }

        // Display the agent response.
        addMessage(
            "assistant",
            data.answer || "Your travel plan is ready."
        );

        // Render structured results.
        renderFlights(data.flight_results);
        renderHotels(data.hotel_results);
        renderItinerary(data.itinerary);

        // Update trip summary.
        updateTripOverview(data);

        // Scroll to the latest message.
        conversation.scrollTop = conversation.scrollHeight;

    } catch (error) {

        console.error("Travel API error:", error);

        addMessage(
            "assistant",
            `I encountered an error while planning your trip: ${error.message}. Please try again.`
        );

    } finally {

        setLoading(false);

    }
}


// -----------------------------
// GENERIC RESULT RENDERING
// -----------------------------

function escapeHTML(value) {

    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);

}


function formatValue(value) {

    if (value === null || value === undefined) {
        return "";
    }

    if (typeof value === "object") {
        return JSON.stringify(value, null, 2);
    }

    return String(value);

}


function normalizeResults(data) {

    if (data === null || data === undefined || data === "") {
        return [];
    }

    if (typeof data === "string") {

        try {

            const parsed = JSON.parse(data);

            if (Array.isArray(parsed)) return parsed;

            if (typeof parsed === "object" && parsed !== null) {
                return parsed.results || parsed.items || [parsed];
            }

        } catch {
            return [data];
        }

        return [data];
    }

    if (Array.isArray(data)) {
        return data;
    }

    if (typeof data === "object") {

        if (Array.isArray(data.results)) return data.results;
        if (Array.isArray(data.items)) return data.items;

        return [data];
    }

    return [data];
}


function createResultCard(item, index, type) {

    const card = document.createElement("div");
    card.className = "result-card";

    if (typeof item === "string") {

        const title = document.createElement("h4");
        title.textContent = `${type} ${index + 1}`;

        const description = document.createElement("p");
        description.textContent = item;

        card.append(title, description);

        return card;
    }

    if (typeof item !== "object" || item === null) {

        const description = document.createElement("p");
        description.textContent = formatValue(item);

        card.appendChild(description);

        return card;
    }

    const entries = Object.entries(item);

    const titleEntry = entries.find(([key]) =>
        /name|title|airline|hotel|flight_number|destination|day/i.test(key)
    );

    const title = document.createElement("h4");

    title.textContent = titleEntry
        ? formatValue(titleEntry[1])
        : `${type} ${index + 1}`;

    card.appendChild(title);

    entries.forEach(([key, value]) => {

        if (value === null || value === undefined || value === "") {
            return;
        }

        const line = document.createElement("p");

        const label = document.createElement("strong");
        label.textContent = `${key.replace(/_/g, " ")}: `;

        const text = document.createTextNode(formatValue(value));

        line.append(label, text);

        card.appendChild(line);

    });

    return card;
}


// -----------------------------
// FLIGHT RESULTS
// -----------------------------

function renderFlights(data) {

    const container = document.getElementById("flightResults");

    container.replaceChildren();

    const flights = normalizeResults(data);

    document.getElementById("flightCount").textContent = flights.length;
    document.getElementById("flightBadge").textContent = flights.length;

    if (!flights.length) {

        container.className = "result-list empty-state";
        container.textContent = "No flight recommendations returned yet.";

        return;
    }

    container.className = "result-list";

    flights.forEach((flight, index) => {

        container.appendChild(
            createResultCard(flight, index, "Flight")
        );

    });

}


// -----------------------------
// HOTEL RESULTS
// -----------------------------

function renderHotels(data) {

    const container = document.getElementById("hotelResults");

    container.replaceChildren();

    const hotels = normalizeResults(data);

    document.getElementById("hotelCount").textContent = hotels.length;
    document.getElementById("hotelBadge").textContent = hotels.length;

    if (!hotels.length) {

        container.className = "result-list empty-state";
        container.textContent = "No hotel recommendations returned yet.";

        return;
    }

    container.className = "result-list";

    hotels.forEach((hotel, index) => {

        container.appendChild(
            createResultCard(hotel, index, "Hotel")
        );

    });

}


// -----------------------------
// ITINERARY
// -----------------------------

function renderItinerary(data) {

    const container = document.getElementById("itineraryResults");

    container.replaceChildren();

    const itinerary = normalizeResults(data);

    document.getElementById("dayCount").textContent = itinerary.length;

    if (!itinerary.length) {

        container.className = "itinerary-list empty-state";
        container.textContent = "No itinerary available yet.";

        return;
    }

    container.className = "itinerary-list";

    itinerary.forEach((day, index) => {

        const element = document.createElement("div");

        element.className = "itinerary-day";

        if (typeof day === "string") {

            const title = document.createElement("h4");
            title.textContent = `Day ${index + 1}`;

            const description = document.createElement("p");
            description.textContent = day;

            element.append(title, description);

        } else if (typeof day === "object" && day !== null) {

            const title = document.createElement("h4");

            title.textContent =
                day.day || day.title || `Day ${index + 1}`;

            const description = document.createElement("p");

            description.textContent = Object.entries(day)
                .filter(([key]) => !["day", "title"].includes(key))
                .map(([key, value]) =>
                    `${key.replace(/_/g, " ")}: ${formatValue(value)}`
                )
                .join("\n");

            element.append(title, description);

        } else {

            element.textContent = formatValue(day);

        }

        container.appendChild(element);

    });

}


// -----------------------------
// TRIP OVERVIEW
// -----------------------------

function updateTripOverview(data) {

    document.getElementById("tripStatus").textContent = "Planned";

    const answer = String(data.answer || "");

    const firstSentence = answer
        .split(/[.!?]/)[0]
        .trim();

    document.getElementById("tripDescription").textContent =
        firstSentence || "Your travel recommendations are ready.";

    // Try to extract a destination from the AI response.
    const destinationMatch = answer.match(
        /(?:to|in|visit|explore)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,2})/
    );

    if (destinationMatch) {

        document.getElementById("tripDestination").textContent =
            destinationMatch[1];

    } else {

        document.getElementById("tripDestination").textContent =
            "Your travel adventure";

    }

}


// -----------------------------
// INPUT EVENTS
// -----------------------------

sendBtn.addEventListener("click", () => {

    sendMessage(messageInput.value);

});


messageInput.addEventListener("keydown", event => {

    if (event.key === "Enter" && !event.shiftKey) {

        event.preventDefault();

        sendMessage(messageInput.value);

    }

});


messageInput.addEventListener("input", () => {

    messageInput.style.height = "45px";

    messageInput.style.height =
        Math.min(messageInput.scrollHeight, 140) + "px";

});


// -----------------------------
// SUGGESTED PROMPTS
// -----------------------------

document.querySelectorAll(".suggestion-card").forEach(button => {

    button.addEventListener("click", () => {

        const prompt = button.dataset.prompt;

        sendMessage(prompt);

    });

});


// -----------------------------
// NEW CONVERSATION
// -----------------------------

newChatBtn.addEventListener("click", () => {

    threadId = null;

    localStorage.removeItem("safari_thread_id");

    chatMessages.replaceChildren();

    welcomeSection.style.display = "";

    conversation.classList.remove("visible");

    document.getElementById("tripStatus").textContent = "Not started";

    document.getElementById("tripDestination").textContent =
        "Your next adventure";

    document.getElementById("tripDescription").textContent =
        "Your travel recommendations will appear here.";

    renderFlights(null);
    renderHotels(null);
    renderItinerary(null);

});


// -----------------------------
// MOBILE SIDEBAR
// -----------------------------

document.getElementById("menuBtn").addEventListener("click", () => {

    document.getElementById("sidebar").classList.toggle("open");

});
