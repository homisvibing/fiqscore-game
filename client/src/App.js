import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Play, RotateCcw, XCircle, ChevronRight, Trophy, Sparkles, Timer } from 'lucide-react';

// --- Game Configuration (Frontend Side) ---
const GAME_STAGES = [
    'Group Stage',
    'Play-off for Round of 16',
    'Round of 16',
    'Quarter-final',
    'Semi-final',
    'The Final'
];

// Passing thresholds for each stage (score for that stage)
const STAGE_PASS_THRESHOLDS = {
    // Group Stage is special, handled separately for total points across 4 matches
    'Play-off for Round of 16': 3, // Points for this specific 8-question stage
    'Round of 16': 4,
    'Quarter-final': 5,
    'Semi-final': 6,
    'The Final': 7
};

// Timer durations per stage in seconds
const STAGE_TIMERS = {
    'Group Stage': 90,
    'Play-off for Round of 16': 90,
    'Round of 16': 75,
    'Quarter-final': 75,
    'Semi-final': 75,
    'The Final': 60
};

const CHALLENGE_MESSAGES = [
    "Think you know ball? Prove it.",
    "Only real fans make it to the final. You in?",
    "Ready to flex your football IQ or just here for vibes?",
    "Legends answer. Casuals guess. Which one are you?",
    "Are you scared of the spotlight? The pitch is yours.",
    "Don’t tap Start unless you’re built different.",
    "If you fear the questions, the bench is over there.",
    "Quiz kicks off now. Miss one? You're subbed.",
    "World-class knowledge or weekend watcher? Let's see.",
    "Only Champions answer with confidence."
];

// --- IMPORTANT: This list must match the 'competition.name' values in your MongoDB ---
const AVAILABLE_TOURNAMENTS_LIST = [
    "FIFA World Cup",
    "Premier League"
];

// Helper for Y/N questions with exciting options
const YES_OPTIONS = ["Sí", "Of course!", "Hell yeah!", "For sure!", "Yup"];
const NO_OPTIONS = ["No", "No way", "No chance", "Nah Agh", "Nope!"];

// eslint-disable-next-line no-unused-vars
function getYNOptions(isCorrectYes) { // Added eslint-disable-next-line
    const options = new Set();
    const correctOption = isCorrectYes ? YES_OPTIONS[Math.floor(Math.random() * YES_OPTIONS.length)] : NO_OPTIONS[Math.floor(Math.random() * NO_OPTIONS.length)];
    options.add(correctOption);

    while (options.size < 2) { // Ensure two distinct options for Y/N
        // eslint-disable-next-line no-unused-vars
        const randomYes = YES_OPTIONS[Math.floor(Math.random() * YES_OPTIONS.length)]; // Added eslint-disable-next-line
        const randomNo = NO_OPTIONS[Math.floor(Math.random() * NO_OPTIONS.length)];
        if (isCorrectYes) {
            if (!options.has(randomNo)) options.add(randomNo);
        } else {
            if (!options.has(randomNo)) options.add(randomNo);
        }
    }
    return shuffleArray(Array.from(options));
}

// Helper function to shuffle arrays (used by getYNOptions too)
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// --- App Component ---
function App() {
    // --- State Variables ---
    const [gameStarted, setGameStarted] = useState(false);
    const [currentStageIndex, setCurrentStageIndex] = useState(0);
    const [questionsForStage, setQuestionsForStage] = useState([]);
    const [currentQuestionIndexInStage, setCurrentQuestionIndexInStage] = useState(0);
    const [score, setScore] = useState(0); // Score for current stage (8 questions)
    const [totalGameScore, setTotalGameScore] = useState(0); // Overall game score across all stages
    const [groupStageMatchesPlayed, setGroupStageMatchesPlayed] = useState(0);
    const [groupStageTotalPoints, setGroupStageTotalPoints] = useState(0);

    const [feedback, setFeedback] = useState(null); // 'correct', 'incorrect', 'no_answer'
    const [selectedAnswer, setSelectedAnswer] = useState(null);
    const [gameOver, setGameOver] = useState(false);
    const [winState, setWinState] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const [selectedTournamentType, setSelectedTournamentType] = useState('');
    const [singleTournament, setSingleTournament] = useState('');
    const [customMix1, setCustomMix1] = useState('');
    const [customMix2, setCustomMix2] = useState('');
    const [challengeMessage, setChallengeMessage] = useState('');

    const [timeLeft, setTimeLeft] = useState(0);
    // Initialize timerRef.current to an object to store properties
    const timerRef = useRef({});

    const [inExtraTime, setInExtraTime] = useState(false); // New state for extra time
    const [extraTimeQuestion, setExtraTimeQuestion] = useState(null);

    // --- Derived State (explicitly dependent on extraTimeQuestion and inExtraTime) ---
    const currentStageName = GAME_STAGES[currentStageIndex];
    const passThreshold = STAGE_PASS_THRESHOLDS[currentStageName];
    // This derived state now explicitly checks if inExtraTime is true AND extraTimeQuestion is available
    const currentQuestion = inExtraTime && extraTimeQuestion ? extraTimeQuestion : questionsForStage[currentQuestionIndexInStage];

    // Diagnostic console logs for state changes
    useEffect(() => {
        console.log("App Render - Stage:", currentStageName, "| Q Index:", currentQuestionIndexInStage, "| Score:", score, "| Total Score:", totalGameScore, "| Extra Time:", inExtraTime, "| Current Question (derived):", currentQuestion ? currentQuestion.id : "null");
        if (inExtraTime) {
            console.log("   --> Specific Extra Time Question State:", extraTimeQuestion ? extraTimeQuestion.id : "null");
        }
    }, [currentStageName, currentQuestionIndexInStage, score, totalGameScore, inExtraTime, currentQuestion, extraTimeQuestion]);


    // --- fetchQuestions function (defined first as it's a core dependency) ---
    const fetchQuestions = useCallback(async (stage, tournamentParam1, tournamentParam2, difficulty = null) => {
        console.log(`FETCH_INIT: Starting fetch for stage: ${stage}, difficulty: ${difficulty || 'N/A'}`);
        setLoading(true);
        setError(null);
        setSelectedAnswer(null); // Clear selected answer for new question
        setFeedback(null); // Clear feedback for new question
        clearInterval(timerRef.current.intervalId); // Clear any active timer
        setTimeLeft(0); // Explicitly reset timeLeft to 0 to force re-initialization in timer useEffect

        let queryString = `?stage=${encodeURIComponent(stage)}`;

        if (tournamentParam1 && tournamentParam2) {
            queryString += `&tournament1=${encodeURIComponent(tournamentParam1)}&tournament2=${encodeURIComponent(tournamentParam2)}`;
        } else if (tournamentParam1) {
            queryString += `&tournament=${encodeURIComponent(tournamentParam1)}`;
        } else {
             setError("Tournament selection missing. Please choose a valid tournament.");
             setLoading(false);
             return;
        }

        // Add difficulty for extra time question if specified
        if (difficulty) {
            queryString += `&difficulty=${encodeURIComponent(difficulty)}`;
        }

        try {
            console.log(`FETCH_REQUEST: Requesting from Netlify function: /.netlify/functions/getQuestions${queryString}`);
            const response = await fetch(`/.netlify/functions/getQuestions${queryString}`);
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.message || `HTTP error! status: ${response.status}`);
            }
            const data = await response.json(); // This expects an array of questions
            console.log("FETCH_RESPONSE: Received data:", data); // THIS IS THE CRITICAL LOG for debugging

            if (data.length === 0) {
                setError("No questions found for this selection. Try a different tournament or stage.");
                setQuestionsForStage([]);
                if (inExtraTime) {
                    setExtraTimeQuestion(null);
                    console.log("FETCH_NO_DATA: No extra time question found. Setting extraTimeQuestion to null.");
                } else {
                    console.log("FETCH_NO_DATA: No standard questions found.");
                }
            } else {
                if (inExtraTime) {
                    // Ensure that if data is not empty, we are indeed getting an object at index 0
                    if (data[0] && typeof data[0] === 'object' && data[0].id) {
                        setExtraTimeQuestion(data[0]); // Only one question for extra time
                        console.log("FETCH_SUCCESS: Set extraTimeQuestion:", data[0].id);
                    } else {
                        // Fallback if data[0] is not a valid question object even if array is not empty
                        setError("Received invalid extra time question structure from server.");
                        setExtraTimeQuestion(null);
                        console.error("FETCH_ERROR: Invalid extra time question structure received:", data[0]);
                    }
                } else {
                    setQuestionsForStage(data);
                    setCurrentQuestionIndexInStage(0);
                    console.log("FETCH_SUCCESS: Set questionsForStage. First Q:", data[0].id);
                }
            }
        } catch (e) {
            console.error("FETCH_ERROR_CATCH:", e);
            setError(`Failed to load questions: ${e.message}. Ensure Netlify Dev server is running and MongoDB connection is active.`);
            setQuestionsForStage([]);
            if (inExtraTime) setExtraTimeQuestion(null);
        } finally {
            setLoading(false);
            console.log("FETCH_FINALLY: Loading set to false.");
        }
    }, [currentStageName, inExtraTime]); // Removed currentStageName as a direct dependency here, it's used indirectly via `stage` parameter.


    // --- moveToNextQuestion function ---
    const moveToNextQuestion = useCallback(async (isCorrectExtraTimeAnswer = false) => {
        setFeedback(null);
        setSelectedAnswer(null);

        if (inExtraTime) {
            console.log("MOVE: In Extra Time logic. Extra Time Answer Correct:", isCorrectExtraTimeAnswer);
            if (isCorrectExtraTimeAnswer) {
                setInExtraTime(false);
                setExtraTimeQuestion(null); // Clear the extra time question
                if (currentStageIndex === GAME_STAGES.length - 1) { // The Final is the last stage
                    setWinState(true);
                    setGameOver(true);
                    setError("You have won the WTFootball Tournament after extra time!");
                    console.log("MOVE: Game Won after Extra Time!");
                } else {
                    setCurrentStageIndex(prevIndex => prevIndex + 1);
                    setScore(0);
                    setGroupStageMatchesPlayed(0); // Reset for next Group Stage run or if coming from Play-off
                    setGroupStageTotalPoints(0); // Reset points for next Group Stage run
                    const currentTourney1 = selectedTournamentType === 'single' ? singleTournament : customMix1;
                    const currentTourney2 = selectedTournamentType === 'custom' ? customMix2 : null;
                    console.log("MOVE: Fetching questions for next stage after extra time win.");
                    await fetchQuestions(GAME_STAGES[currentStageIndex + 1], currentTourney1, currentTourney2);
                }
            } else {
                setGameOver(true);
                setWinState(false);
                setError(`You didn't pass the ${currentStageName} in extra time. Game Over.`);
                console.log("MOVE: Game Over - Failed Extra Time.");
            }
            return;
        }

        const nextQuestionIndexInStage = currentQuestionIndexInStage + 1;
        console.log(`MOVE: Evaluating next question in stage. Current Q index: ${currentQuestionIndexInStage}, Next: ${nextQuestionIndexInStage}, Total Qs: ${questionsForStage.length}`);

        if (nextQuestionIndexInStage < questionsForStage.length) {
            setCurrentQuestionIndexInStage(nextQuestionIndexInStage);
            console.log("MOVE: Moving to next question in current stage.");
        } else {
            console.log("MOVE: End of current question set for stage. Evaluating stage progression.");
            let advanceToNextStage = false;
            let gameOutcomeMessage = "";

            if (currentStageName === 'Group Stage') {
                setGroupStageMatchesPlayed(prevMatches => prevMatches + 1);

                const nextMatchesPlayed = groupStageMatchesPlayed + 1;
                console.log(`MOVE: Group Stage - Match ${nextMatchesPlayed} of 4 played.`);

                if (nextMatchesPlayed < 4) {
                    const currentTourney1 = selectedTournamentType === 'single' ? singleTournament : customMix1;
                    const currentTourney2 = selectedTournamentType === 'custom' ? customMix2 : null;
                    console.log("MOVE: Fetching next set of Group Stage questions.");
                    await fetchQuestions(currentStageName, currentTourney1, currentTourney2);
                    setScore(0); // Reset score for the new "match" set within Group Stage
                    return;
                } else {
                    console.log(`MOVE: Group Stage - All 4 matches finished. Total Points: ${groupStageTotalPoints}.`);
                    const requiredForRoundOf16 = 25;
                    const requiredForPlayoff = 18;

                    if (groupStageTotalPoints > requiredForRoundOf16) {
                        advanceToNextStage = true;
                        console.log("MOVE: Group Stage - Advanced directly to Round of 16.");
                    } else if (groupStageTotalPoints === requiredForRoundOf16) {
                        console.log("MOVE: Group Stage - Triggering Extra Time for Round of 16!");
                        setInExtraTime(true);
                        setScore(0); // Reset score for extra time question
                        const currentTourney1 = selectedTournamentType === 'single' ? singleTournament : customMix1;
                        const currentTourney2 = selectedTournamentType === 'custom' ? customMix2 : null;
                        const extraTimeDifficulty = Math.random() < 0.5 ? 'normal' : 'hard';
                        await fetchQuestions(currentStageName, currentTourney1, currentTourney2, extraTimeDifficulty);
                        return;
                    } else if (groupStageTotalPoints > requiredForPlayoff) { // Note: this covers 19-24 points
                        advanceToNextStage = true;
                        setCurrentStageIndex(GAME_STAGES.indexOf('Play-off for Round of 16')); // Force stage change
                        console.log("MOVE: Group Stage - Advanced directly to Play-off for Round of 16.");
                    } else if (groupStageTotalPoints === requiredForPlayoff) {
                         console.log("MOVE: Group Stage - Triggering Extra Time for Play-off!");
                         setInExtraTime(true);
                         setScore(0); // Reset score for extra time question
                         const currentTourney1 = selectedTournamentType === 'single' ? singleTournament : customMix1;
                         const currentTourney2 = selectedTournamentType === 'custom' ? customMix2 : null;
                         const extraTimeDifficulty = Math.random() < 0.5 ? 'normal' : 'hard';
                         await fetchQuestions(currentStageName, currentTourney1, currentTourney2, extraTimeDifficulty);
                         return;
                    }
                    else {
                        setGameOver(true);
                        setWinState(false);
                        gameOutcomeMessage = `You scored ${groupStageTotalPoints} points in the Group Stage. You needed ${requiredForPlayoff} to make the Play-off or ${requiredForRoundOf16} to pass directly to the Round of 16. Game Over.`;
                        setError(gameOutcomeMessage);
                        console.log("MOVE: Group Stage - Game Over.");
                        return;
                    }
                }
            } else {
                console.log(`MOVE: Knockout Stage - Evaluating Score ${score} vs Threshold ${passThreshold}`);
                if (score > passThreshold) {
                    advanceToNextStage = true;
                    console.log("MOVE: Knockout Stage - Advanced directly to next stage.");
                } else if (score === passThreshold) {
                    console.log("MOVE: Knockout Stage - Triggering Extra Time!");
                    setInExtraTime(true);
                    setScore(0);
                    const currentTourney1 = selectedTournamentType === 'single' ? singleTournament : customMix1;
                    const currentTourney2 = selectedTournamentType === 'custom' ? customMix2 : null;
                    const extraTimeDifficulty = Math.random() < 0.5 ? 'normal' : 'hard';
                    await fetchQuestions(currentStageName, currentTourney1, currentTourney2, extraTimeDifficulty);
                    return;
                } else {
                    setGameOver(true);
                    setWinState(false);
                    gameOutcomeMessage = `You didn't pass the ${currentStageName}. You needed ${passThreshold} correct answers, but only got ${score}. Game Over.`;
                    setError(gameOutcomeMessage);
                    console.log("MOVE: Knockout Stage - Game Over.");
                    return;
                }
            }

            if (advanceToNextStage) {
                if (currentStageIndex === GAME_STAGES.length - 1) {
                    setWinState(true);
                    setGameOver(true);
                    gameOutcomeMessage = "You have won the WTFootball Tournament!";
                    setError(gameOutcomeMessage);
                    console.log("MOVE: Game Won!");
                } else {
                    const nextStageIdx = (currentStageName === 'Group Stage' && groupStageTotalPoints < 25)
                        ? GAME_STAGES.indexOf('Play-off for Round of 16')
                        : currentStageIndex + 1;

                    setCurrentStageIndex(nextStageIdx);
                    setScore(0);
                    setGroupStageMatchesPlayed(0);
                    setGroupStageTotalPoints(0);
                    const currentTourney1 = selectedTournamentType === 'single' ? singleTournament : customMix1;
                    const currentTourney2 = selectedTournamentType === 'custom' ? customMix2 : null;
                    console.log(`MOVE: Advancing to stage: ${GAME_STAGES[nextStageIdx]}`);
                    await fetchQuestions(GAME_STAGES[nextStageIdx], currentTourney1, currentTourney2);
                }
            }
        }
    }, [currentQuestionIndexInStage, questionsForStage, currentStageName, groupStageMatchesPlayed, groupStageTotalPoints, score, passThreshold, currentStageIndex, selectedTournamentType, singleTournament, customMix1, customMix2, fetchQuestions, inExtraTime]);


    // --- handleSubmitAnswer function ---
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const handleSubmitAnswer = useCallback((answerToSubmit, fromTimer = false) => { // Added eslint-disable-next-line
        console.log(`SUBMIT: Answer submitted: ${answerToSubmit}, From Timer: ${fromTimer}, Feedback status: ${feedback}, In Extra Time: ${inExtraTime}`);

        if (feedback !== null && !inExtraTime) {
            // Prevent multiple submissions for main game questions if feedback already shown
            return;
        }

        clearInterval(timerRef.current.intervalId); // Clear by property

        let isCorrect = false;
        const questionToEvaluate = inExtraTime ? extraTimeQuestion : currentQuestion;

        if (answerToSubmit === null || fromTimer) {
            setFeedback('no_answer');
            isCorrect = false;
            console.log("SUBMIT: No answer or timer ran out. Incorrect.");
        } else if (questionToEvaluate && answerToSubmit === questionToEvaluate.correctAnswer) {
            setFeedback('correct');
            isCorrect = true;
            console.log("SUBMIT: Correct Answer!");
        } else {
            setFeedback('incorrect');
            isCorrect = false;
            console.log("SUBMIT: Incorrect Answer!");
        }

        if (isCorrect) {
            if (inExtraTime) {
                console.log("SUBMIT: Extra time question CORRECT. Calling moveToNextQuestion(true).");
                moveToNextQuestion(true);
                return;
            } else {
                setScore((prevScore) => prevScore + 1);
                setTotalGameScore((prevTotal) => prevTotal + 1);
                if (currentStageName === 'Group Stage') {
                    setGroupStageTotalPoints(prevPoints => prevPoints + 1);
                }
                console.log(`SUBMIT: Score updated. Current Stage Score: ${score + 1}, Total Game Score: ${totalGameScore + 1}`);
            }
        } else if (inExtraTime) {
            console.log("SUBMIT: Extra time question INCORRECT. Calling moveToNextQuestion(false). Game Over.");
            moveToNextQuestion(false);
            return;
        }

        setTimeout(() => {
            console.log("SUBMIT: Timeout finished. Calling moveToNextQuestion().");
            moveToNextQuestion();
        }, 1500);
    }, [feedback, currentQuestion, currentStageName, moveToNextQuestion, inExtraTime, extraTimeQuestion, selectedAnswer, score, totalGameScore]);


    // --- Timer Logic (useEffect) ---
    useEffect(() => {
        console.log("TIMER: useEffect triggered. Game Started:", gameStarted, "| Game Over:", gameOver, "| Current Q:", currentQuestion ? currentQuestion.id : "null", "| Loading:", loading, "| Feedback:", feedback);
        
        // This condition is critical to prevent timer logic from running when it shouldn't
        if (!gameStarted || gameOver || !currentQuestion || loading || feedback !== null) {
            clearInterval(timerRef.current.intervalId); // Clear by property
            console.log("TIMER: Cleared timer due to game state or no current question.");
            return;
        }

        const currentTimerDuration = inExtraTime ? (STAGE_TIMERS[currentStageName] / 2) : STAGE_TIMERS[currentStageName];
        
        // This condition tries to prevent premature timer resets.
        // Re-initialize if:
        // 1. timeLeft is 0 (first load or previous timer ran out)
        // 2. The current question has changed (e.g., new Q in stage, or transition to extra time Q)
        // 3. The inExtraTime state itself has changed (important for timer duration change)
        if (timeLeft <= 0 || 
            (currentQuestion && currentQuestion.id !== timerRef.current.questionId) || // Access properties safely
            (inExtraTime !== timerRef.current.inExtraTimeState)) // Access properties safely
        {
             console.log(`TIMER: Re-initializing timer. Duration: ${currentTimerDuration}s. Reason: timeLeft=${timeLeft}, Q_ID_changed=${currentQuestion?.id !== timerRef.current.questionId}, ExtraTime_state_changed=${inExtraTime !== timerRef.current.inExtraTimeState}`);
             setTimeLeft(currentTimerDuration);
             clearInterval(timerRef.current.intervalId); // Clear any old interval
             
             // Capture intervalId in a local variable for cleanup to avoid stale closure warning
             const id = setInterval(() => { 
                 setTimeLeft(prevTime => {
                     if (prevTime <= 1) {
                         console.log("TIMER: Countdown finished.");
                         clearInterval(id); // Clear using the local id
                         handleSubmitAnswer(selectedAnswer, true); // Automatically submit if time runs out
                         return 0;
                     }
                     return prevTime - 1;
                 });
             }, 1000);
             timerRef.current.intervalId = id; // Store interval ID in a property
             // Store current question ID and extra time state with the timer ref object
             timerRef.current.questionId = currentQuestion.id;
             timerRef.current.inExtraTimeState = inExtraTime;
        }


        // Cleanup on component unmount or dependencies change
        return () => {
            console.log("TIMER: Cleanup function running. Clearing interval.");
            // Use the stored intervalId for cleanup
            clearInterval(timerRef.current.intervalId);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gameStarted, gameOver, currentQuestion, loading, currentStageName, handleSubmitAnswer, selectedAnswer, feedback, inExtraTime]); // Removed timeLeft from here

    // Set a random challenge message on initial load and game reset
    useEffect(() => {
        setChallengeMessage(CHALLENGE_MESSAGES[Math.floor(Math.random() * CHALLENGE_MESSAGES.length)]);
    }, [gameStarted]);


    // --- Game Start/Reset Logic ---
    const handleStartGame = async () => {
        let tourney1 = null;
        let tourney2 = null;

        if (selectedTournamentType === 'single') {
            tourney1 = singleTournament;
            if (!tourney1) {
                setError("Please select a single tournament.");
                return;
            }
        } else if (selectedTournamentType === 'custom') {
            if (!customMix1 || !customMix2 || customMix1 === customMix2) {
                setError("Please select two *different* tournaments for custom mixing.");
                return;
            }
            tourney1 = customMix1;
            tourney2 = customMix2;
        } else {
             setError("Please select a tournament type (Single or Custom Mixing).");
             return;
        }

        setGameStarted(true);
        setGameOver(false);
        setWinState(false);
        setCurrentStageIndex(0);
        setScore(0); // Reset current stage score
        setTotalGameScore(0); // Reset overall score
        setGroupStageMatchesPlayed(0); // Reset Group Stage specific counters
        setGroupStageTotalPoints(0);
        setFeedback(null);
        setSelectedAnswer(null);
        setError(null); // Clear previous errors
        setInExtraTime(false); // Reset extra time state
        setExtraTimeQuestion(null); // Clear extra time question
        setChallengeMessage(CHALLENGE_MESSAGES[Math.floor(Math.random() * CHALLENGE_MESSAGES.length)]); // New message for new game
        console.log("START GAME: Initializing first stage questions.");
        await fetchQuestions(GAME_STAGES[0], tourney1, tourney2);
    };

    const handlePlayAgain = () => {
        console.log("PLAY AGAIN: Resetting game state.");
        setGameStarted(false);
        setGameOver(false);
        setWinState(false);
        setCurrentStageIndex(0);
        setQuestionsForStage([]);
        setCurrentQuestionIndexInStage(0);
        setScore(0);
        setTotalGameScore(0);
        setGroupStageMatchesPlayed(0);
        setGroupStageTotalPoints(0);
        setFeedback(null);
        setSelectedAnswer(null);
        // Reset tournament selections
        setSelectedTournamentType('');
        setSingleTournament('');
        setCustomMix1('');
        setCustomMix2('');
        setError(null); // Clear errors
        clearInterval(timerRef.current.intervalId); // Clear by property
        setTimeLeft(0); // Reset timer display
        setInExtraTime(false); // Reset extra time state
        setExtraTimeQuestion(null); // Clear extra time question
    };

    // --- Answer Selection (does NOT submit yet) ---
    const handleOptionClick = (option) => {
        if (feedback !== null && !inExtraTime) return; // Prevent changing answer after submission/timer end, allow if in extra time for specific logic
        setSelectedAnswer(option);
        console.log("CLICK: Selected answer:", option);
    };

    // --- Conditional Rendering of Game Screens ---
    if (!gameStarted) {
        const isStartButtonDisabled = loading || error ||
            (selectedTournamentType === 'single' && !singleTournament) ||
            (selectedTournamentType === 'custom' && (!customMix1 || !customMix2 || customMix1 === customMix2)) ||
            (!selectedTournamentType);

        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-br from-gray-900 to-gray-700 text-gray-100 font-inter">
                <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md text-center border border-gray-700 animate-fade-in">
                    <h1 className="text-6xl font-bold text-green-500 mb-4 tracking-tight drop-shadow-md">WTFootball</h1>
                    <p className="text-lg mb-8 italic text-gray-400">"{challengeMessage}"</p>

                    {error && (
                        <p className="text-red-500 mb-4 text-sm">{error}</p>
                    )}

                    <div className="mb-6 text-left">
                        <label htmlFor="tournamentType" className="block text-gray-300 text-sm font-medium mb-2">Choose Tournament Type:</label>
                        <select
                            id="tournamentType"
                            className="w-full p-3 rounded-md bg-gray-700 border border-gray-600 text-gray-200 focus:ring-green-500 focus:border-green-500 transition duration-200 ease-in-out appearance-none cursor-pointer"
                            value={selectedTournamentType}
                            onChange={(e) => {
                                setSelectedTournamentType(e.target.value);
                                setSingleTournament('');
                                setCustomMix1('');
                                setCustomMix2('');
                                setError(null);
                            }}
                        >
                            <option value="">Select Type</option>
                            <option value="single">Single Tournament</option>
                            <option value="custom">Custom Mixing</option>
                        </select>
                    </div>

                    {selectedTournamentType === 'single' && (
                        <div className="mb-6 text-left">
                            <label htmlFor="singleTournament" className="block text-gray-300 text-sm font-medium mb-2">Select Tournament:</label>
                            <select
                                id="singleTournament"
                                className="w-full p-3 rounded-md bg-gray-700 border border-gray-600 text-gray-200 focus:ring-green-500 focus:border-green-500 transition duration-200 ease-in-out appearance-none cursor-pointer"
                                value={singleTournament}
                                onChange={(e) => { setSingleTournament(e.target.value); setError(null); }}
                            >
                                <option value="">Select a tournament</option>
                                {AVAILABLE_TOURNAMENTS_LIST.map((tourney) => (
                                    <option key={tourney} value={tourney}>
                                        {tourney}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {selectedTournamentType === 'custom' && (
                        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                            <div>
                                <label htmlFor="customMix1" className="block text-gray-300 text-sm font-medium mb-2">Custom Mix 1:</label>
                                <select
                                    id="customMix1"
                                    className="w-full p-3 rounded-md bg-gray-700 border border-gray-600 text-gray-200 focus:ring-green-500 focus:border-green-500 transition duration-200 ease-in-out appearance-none cursor-pointer"
                                    value={customMix1}
                                    onChange={(e) => { setCustomMix1(e.target.value); setError(null); }}
                                >
                                    <option value="">Select Tournament 1</option>
                                    {AVAILABLE_TOURNAMENTS_LIST.map((tourney) => (
                                        <option key={tourney} value={tourney} disabled={tourney === customMix2}>
                                            {tourney}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label htmlFor="customMix2" className="block text-gray-300 text-sm font-medium mb-2">Custom Mix 2:</label>
                                <select
                                    id="customMix2"
                                    className="w-full p-3 rounded-md bg-gray-700 border border-gray-600 text-gray-200 focus:ring-green-500 focus:border-green-500 transition duration-200 ease-in-out appearance-none cursor-pointer"
                                    value={customMix2}
                                    onChange={(e) => { setCustomMix2(e.target.value); setError(null); }}
                                >
                                    <option value="">Select Tournament 2</option>
                                    {AVAILABLE_TOURNAMENTS_LIST.map((tourney) => (
                                        <option key={tourney} value={tourney} disabled={tourney === customMix1}>
                                            {tourney}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}

                    <button
                        onClick={handleStartGame}
                        disabled={isStartButtonDisabled}
                        className={`w-full py-3 px-6 rounded-md text-xl font-bold transition duration-300 ease-in-out flex items-center justify-center gap-2
                                    ${isStartButtonDisabled ? 'bg-gray-600 text-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 text-white shadow-lg transform hover:scale-105'}`}
                    >
                        <Play size={24} /> Start Game
                    </button>
                </div>
            </div>
        );
    }

    if (gameOver) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-br from-gray-900 to-gray-700 text-gray-100 font-inter">
                <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md text-center border border-gray-700 animate-fade-in">
                    {winState ? (
                        <>
                            <Trophy className="mx-auto text-yellow-400 mb-4" size={64} />
                            <h2 className="text-4xl font-bold text-yellow-400 mb-4">CONGRATULATIONS!</h2>
                            <p className="text-xl text-gray-200 mb-6">{error}</p>
                        </>
                    ) : (
                        <>
                            <XCircle className="mx-auto text-red-500 mb-4" size={64} />
                            <h2 className="text-4xl font-bold text-red-500 mb-4">GAME OVER!</h2>
                            <p className="text-xl text-gray-200 mb-6">{error}</p>
                        </>
                    )}
                    <p className="text-2xl font-semibold mb-6">Total Score: {totalGameScore}</p>
                    <button
                        onClick={handlePlayAgain}
                        className="w-full py-3 px-6 rounded-md text-xl font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-lg transition duration-300 ease-in-out transform hover:scale-105 flex items-center justify-center gap-2"
                    >
                        <RotateCcw size={24} /> Play Again
                    </button>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-br from-gray-900 to-gray-700 text-gray-100 font-inter">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-green-500 mb-4"></div>
                    <p className="text-xl">Loading Questions for {currentStageName}...</p>
                </div>
            </div>
        );
    }
    
    // Specifically for extra time loading
    // Only display this if inExtraTime is true, extraTimeQuestion is null, AND we are NOT currently fetching (loading is false)
    if (inExtraTime && !extraTimeQuestion && !loading) {
        console.log("RENDER: Displaying 'Loading Extra Time Question...' screen.");
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-br from-gray-900 to-gray-700 text-gray-100 font-inter">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-green-500 mb-4"></div>
                    <p className="text-xl">Loading Extra Time Question...</p>
                </div>
            </div>
        );
    }

    if (error && !gameStarted) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-br from-gray-900 to-gray-700 text-gray-100 font-inter">
                <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md text-center border border-gray-700 animate-fade-in">
                    <XCircle className="mx-auto text-red-500 mb-4" size={64} />
                    <h2 className="text-3xl font-bold text-red-500 mb-4">Error!</h2>
                    <p className="text-lg text-gray-200 mb-6">{error}</p>
                    <button
                        onClick={handlePlayAgain}
                        className="w-full py-3 px-6 rounded-md text-xl font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-lg transition duration-300 ease-in-out transform hover:scale-105 flex items-center justify-center gap-2"
                    >
                        <RotateCcw size={24} /> Try Again
                    </button>
                </div>
            </div>
        );
    }
    
    // Main Game Screen - This is the last check before displaying the question content
    if (!currentQuestion) {
        console.log("RENDER: No current question available for display. This should ideally not happen if fetches are successful.");
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-br from-gray-900 to-gray-700 text-gray-100 font-inter">
                <p className="text-xl">No questions loaded for this stage. Please try again or select different criteria.</p>
                <button
                    onClick={handlePlayAgain}
                    className="mt-4 py-2 px-4 rounded-md text-lg font-bold bg-blue-600 hover:bg-blue-700 text-white transition duration-300"
                >
                    Back to Start
                </button>
            </div>
        );
    }

    const isAnswerSubmitted = feedback !== null;

    return (
        <div className="flex flex-col items-center justify-between min-h-screen p-4 bg-gradient-to-br from-gray-900 to-gray-700 text-gray-100 font-inter">
            {/* Header / Dashboard */}
            <div className="w-full max-w-2xl bg-gray-800 p-4 rounded-lg shadow-md mb-6 border border-gray-700">
                <div className="flex justify-between items-center text-sm sm:text-lg font-semibold mb-2">
                    <span className="text-green-400 flex items-center gap-2">
                        <Sparkles size={18} />
                        {inExtraTime ? (
                            <span className="text-red-400 font-bold">EXTRA TIME - {currentStageName}</span>
                        ) : (
                            `${currentStageName} ${currentStageName === 'Group Stage' ? ` (Match ${groupStageMatchesPlayed + 1} of 4)` : ''}`
                        )}
                    </span>
                    <span className="text-blue-400 flex items-center gap-2">
                        <ChevronRight size={18} />
                        {inExtraTime ? "DO OR DIE!" : `Q${currentQuestionIndexInStage + 1} of ${questionsForStage.length}`}
                    </span>
                    <span className="text-yellow-400 flex items-center gap-2">
                        <Timer size={18} /> {timeLeft}s
                    </span>
                </div>
                 <div className="flex justify-between items-center text-sm sm:text-lg font-semibold text-gray-400">
                    <span>Score (Current Set): {score} / {currentStageName === 'Group Stage' ? '8' : passThreshold}</span>
                    <span>Overall Game Score: {totalGameScore}</span>
                    {currentStageName === 'Group Stage' && <span>Group Stage Points: {groupStageTotalPoints}</span>}
                 </div>
            </div>

            {/* Question Card */}
            <div className="w-full max-w-2xl bg-gray-800 p-6 rounded-lg shadow-xl border border-gray-700 animate-fade-in flex-grow flex flex-col justify-center">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-100 mb-6 text-center leading-relaxed">
                    {currentQuestion.question}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {currentQuestion.options.map((option, index) => {
                        // Determine button class based on selected answer and feedback
                        let buttonClass = 'bg-gray-700 hover:bg-gray-600 active:bg-gray-500 focus:ring-blue-500'; // Default

                        if (isAnswerSubmitted) {
                            if (option === currentQuestion.correctAnswer) {
                                buttonClass = 'bg-green-600 border border-green-700'; // Correct answer (green)
                            } else if (option === selectedAnswer) {
                                buttonClass = 'bg-red-600 border border-red-700'; // Incorrect answer chosen (red)
                            } else {
                                buttonClass = 'bg-gray-600 opacity-70 cursor-not-allowed'; // Unselected disabled
                            }
                        } else if (option === selectedAnswer) {
                            // Subtle highlight for selected answer before submission
                            buttonClass = 'bg-blue-700 border border-blue-500 scale-102';
                        }

                        return (
                            <button
                                key={index}
                                onClick={() => handleOptionClick(option)}
                                disabled={isAnswerSubmitted} // Disable once submitted or time ran out
                                className={`py-3 px-4 rounded-md text-base sm:text-lg font-semibold text-white transition duration-200 ease-in-out transform focus:outline-none focus:ring-2 focus:ring-offset-2
                                    ${buttonClass}`}
                            >
                                {option}
                            </button>
                        );
                    })}
                </div>
                {/* Submit Button */}
                <div className="mt-8 text-center">
                    <button
                        onClick={() => handleSubmitAnswer(selectedAnswer)}
                        disabled={selectedAnswer === null || isAnswerSubmitted} // Disabled if no answer selected or already submitted
                        className={`w-full py-3 px-6 rounded-md text-xl font-bold transition duration-300 ease-in-out flex items-center justify-center gap-2
                                    ${(selectedAnswer === null || isAnswerSubmitted)
                                        ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                        : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg transform hover:scale-105'
                                    }`}
                    >
                        Submit Answer
                    </button>
                </div>
            </div>

            {/* Footer / Spacer */}
            <div className="mt-6 w-full max-w-2xl text-center text-gray-500 text-sm">
                <p>&copy; {new Date().getFullYear()} WTFootball. All rights reserved.</p>
            </div>
        </div>
    );
}

export default App;