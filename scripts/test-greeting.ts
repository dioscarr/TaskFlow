
(async () => {
    // Mock minimal actions module (since we can't easily import server actions in standalone script without Next.js context)
    // But we CAN copy the regex logic to verify it matches "Hi" and "Hello" correctly.

    const isApprovalMessage = (text: string) => {
        const normalized = text.trim().toLowerCase();
        return /^(approve|approved|ok|okay|yes|yep|go ahead|proceed|run it|do it|execute|start)(\b|\!|\.|,|$)/.test(normalized);
    };

    const isCasualGreeting = (text: string) => {
        if (!text) return false;
        const normalized = text.trim().toLowerCase();
        if (normalized.length > 50) return false; // too long to be a simple greeting
        // Common greetings (strict start match)
        return /^(hi|hello|hey|hiya|yo|sup|howdy|good\s(morning|afternoon|evening|day))([!.,\s]*(\?|!)?|$)/i.test(normalized) &&
            !normalized.includes("run") &&
            !normalized.includes("create") &&
            !normalized.includes("start");
    };

    const testCases = [
        { input: "Hi", expected: true, isApproval: false },
        { input: "hello", expected: true, isApproval: false },
        { input: "Hey there!", expected: true, isApproval: false },
        { input: "Good morning", expected: true, isApproval: false },
        { input: "Hi start the app", expected: false, isApproval: false }, // "start" is excluded in greeting, but check if it's approval?
        { input: "Hello create a file", expected: false, isApproval: false },
        { input: "Hi, can you run the server?", expected: false, isApproval: false },
        { input: "Yo", expected: true, isApproval: false },
        { input: "start", expected: false, isApproval: true },
        { input: "ok", expected: false, isApproval: true }
    ];

    let passed = 0;
    testCases.forEach(({ input, expected, isApproval }) => {
        const isGreeting = isCasualGreeting(input);
        const approval = isApprovalMessage(input);
        
        const greetingPass = isGreeting === expected;
        const approvalPass = approval === isApproval;

        if (greetingPass && approvalPass) {
            passed++;
        } else {
            console.error(`❌ Failed: "${input}"`);
            if (!greetingPass) console.error(`   Greeting: Expected ${expected}, got ${isGreeting}`);
            if (!approvalPass) console.error(`   Approval: Expected ${isApproval}, got ${approval}`);
        }
    });

    console.log(`Test Results: ${passed}/${testCases.length} passed.`);
})();
