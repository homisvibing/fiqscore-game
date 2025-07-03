// This Netlify Function provides static dummy questions for the FIQScore game.
// In Phase 3, this will be updated to fetch questions from a real database.

exports.handler = async (event, context) => {
    // This line is standard for Netlify Functions, ensuring the Lambda execution context
    // doesn't wait for the Node.js event loop to be empty before returning a response.
    context.callbackWaitsForEmptyEventLoop = false;

    console.log("getQuestions function activated.");

    // Extract query parameters for stage and difficulty.
    // 'difficulty' will be used specifically for extra time questions.
    const { stage, difficulty } = event.queryStringParameters || {};
    console.log(`getQuestions: Received request for stage: "${stage}", difficulty: "${difficulty}"`);

    // --- Define Static Dummy Questions ---
    // These arrays hold predefined questions for different difficulty levels.
    // In a real application (Phase 3), these would come from a database.
    const dummyEasyQuestions = [
        {
            id: "easy-q-1",
            type: "easy",
            question: "Which country won the FIFA World Cup in 2014?",
            options: ["Brazil", "Germany", "Argentina", "Spain"],
            correctAnswer: "Germany"
        },
        {
            id: "easy-q-2",
            type: "easy",
            question: "How many players are on a standard football team on the pitch?",
            options: ["9", "10", "11", "12"],
            correctAnswer: "11"
        },
        {
            id: "easy-q-3",
            type: "easy",
            question: "What is the primary color of Real Madrid's home kit?",
            options: ["Blue", "Red", "White", "Black"],
            correctAnswer: "White"
        },
        {
            id: "easy-q-4",
            type: "easy",
            question: "Which of these is NOT a position in football?",
            options: ["Goalkeeper", "Midfielder", "Pitcher", "Defender"],
            correctAnswer: "Pitcher"
        }
    ];

    const dummyNormalQuestions = [
        {
            id: "normal-q-1",
            type: "normal",
            question: "Which player has won the most Ballon d'Or awards?",
            options: ["Cristiano Ronaldo", "Lionel Messi", "Michel Platini", "Johan Cruyff"],
            correctAnswer: "Lionel Messi"
        },
        {
            id: "normal-q-2",
            type: "normal",
            question: "In which year did the Premier League officially begin?",
            options: ["1988", "1990", "1992", "1994"],
            correctAnswer: "1992"
        },
        {
            id: "normal-q-3",
            type: "normal",
            question: "Which club holds the record for the most UEFA Champions League titles?",
            options: ["FC Barcelona", "Bayern Munich", "AC Milan", "Real Madrid"],
            correctAnswer: "Real Madrid"
        },
        {
            id: "normal-q-4",
            type: "normal",
            question: "What is the maximum number of substitutions allowed in a standard football match?",
            options: ["2", "3", "4", "5"],
            correctAnswer: "5"
        }
    ];

    const dummyHardQuestions = [
        {
            id: "hard-q-1",
            type: "hard",
            question: "Which country hosted the first ever FIFA World Cup in 1930?",
            options: ["Brazil", "Italy", "Uruguay", "France"],
            correctAnswer: "Uruguay"
        },
        {
            id: "hard-q-2",
            type: "hard",
            question: "Name the only player to have scored in three different FIFA World Cup finals.",
            options: ["Pelé", "Gerd Müller", "Vavá", "Zinedine Zidane"],
            correctAnswer: "Pelé"
        },
        {
            id: "hard-q-3",
            type: "hard",
            question: "Which manager has won the Premier League title with two different clubs?",
            options: ["Arsène Wenger", "Sir Alex Ferguson", "José Mourinho", "Pep Guardiola"],
            correctAnswer: "José Mourinho"
        },
        {
            id: "hard-q-4",
            type: "hard",
            question: "The 'Panenka' penalty kick is named after a player from which country?",
            options: ["Germany", "Czechoslovakia", "Brazil", "Italy"],
            correctAnswer: "Czechoslovakia"
        }
    ];

    try {
        let questionsToReturn = [];

        // --- Logic to determine which questions to return based on parameters ---

        // Scenario 1: Request for a specific difficulty (primarily for Extra Time)
        if (difficulty === 'normal') {
            console.log("getQuestions: Handling EXTRA TIME - NORMAL difficulty request.");
            // Pick one random normal question. If no normal questions, use a specific fallback.
            if (dummyNormalQuestions.length > 0) {
                questionsToReturn = [dummyNormalQuestions[Math.floor(Math.random() * dummyNormalQuestions.length)]];
            } else {
                console.warn("getQuestions: No normal dummy questions available. Using generic normal fallback.");
                questionsToReturn.push({
                    id: "fallback-q-normal-extratime",
                    type: "fallback_normal",
                    question: "Extra Time (Normal): What is 5 + 5?",
                    options: ["8", "9", "10", "11"],
                    correctAnswer: "10"
                });
            }
        } else if (difficulty === 'hard') {
            console.log("getQuestions: Handling EXTRA TIME - HARD difficulty request.");
            // Pick one random hard question. If no hard questions, use a specific fallback.
            if (dummyHardQuestions.length > 0) {
                questionsToReturn = [dummyHardQuestions[Math.floor(Math.random() * dummyHardQuestions.length)]];
            } else {
                console.warn("getQuestions: No hard dummy questions available. Using generic hard fallback.");
                questionsToReturn.push({
                    id: "fallback-q-hard-extratime",
                    type: "fallback_hard",
                    question: "Extra Time (Hard): What year did WWII end?",
                    options: ["1942", "1945", "1950", "1939"],
                    correctAnswer: "1945"
                });
            }
        }
        // Scenario 2: Request for a standard stage (no specific difficulty, returns a mix)
        else {
            console.log("getQuestions: Handling STANDARD STAGE request (mixed difficulty).");
            // For standard stages, return a mix of 8 questions.
            // This simulates a full set of questions for a "match" or "round".
            const allDummyQuestions = [...dummyEasyQuestions, ...dummyNormalQuestions, ...dummyHardQuestions];
            
            // Shuffle all available dummy questions
            const shuffledQuestions = allDummyQuestions.sort(() => 0.5 - Math.random());

            // Take the first 8 questions, or fewer if not enough are available
            questionsToReturn = shuffledQuestions.slice(0, 8);

            // If still not enough questions (e.g., if dummy arrays were very small),
            // fill with generic fallbacks to ensure 8 questions are always returned for standard stages.
            while (questionsToReturn.length < 8) {
                console.warn(`getQuestions: Not enough questions for standard stage. Filling with fallback. Current count: ${questionsToReturn.length}`);
                questionsToReturn.push({
                    id: `fallback-std-${questionsToReturn.length}-${Math.random().toString(36).substring(7)}`,
                    type: 'fallback_standard',
                    question: `Fallback Question ${questionsToReturn.length + 1}: What is offside in football?`,
                    options: ['A player is nearer to the opponents’ goal line than both the ball and the second-last opponent.', 'When a player stands behind the goalkeeper.', 'When a player runs faster than the ball.'],
                    correctAnswer: 'A player is nearer to the opponents’ goal line than both the ball and the second-last opponent.'
                });
            }
        }

        // --- Final Safeguard (should ideally not be hit with the above logic) ---
        // This is a last resort to ensure the frontend *always* receives at least one question.
        if (questionsToReturn.length === 0) {
            console.error("getQuestions: CRITICAL FALLBACK - questionsToReturn is unexpectedly empty after all logic. Adding emergency question.");
            questionsToReturn.push({
                id: "emergency-fallback-q",
                type: "emergency_fallback",
                question: "Emergency Fallback: What is 1 + 1?",
                options: ["1", "2", "3", "4"],
                correctAnswer: "2"
            });
        }

        console.log(`getQuestions: Preparing response with ${questionsToReturn.length} question(s). First Q ID: ${questionsToReturn[0].id}`);

        // --- Return the HTTP response ---
        return {
            statusCode: 200,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*", // Crucial for CORS when frontend is on a different port/domain
                "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                "Access-Allow-Headers": "Content-Type"
            },
            body: JSON.stringify(questionsToReturn),
        };

    } catch (error) {
        // Catch any unexpected errors during function execution and return a 500 status.
        console.error('getQuestions_FUNCTION_ERROR_CATCH:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: "Failed to fetch questions from Netlify function due to internal error", error: error.message }),
        };
    }
};