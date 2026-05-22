import React, { useEffect, useMemo, useState } from "react";
import "./QuizModule.css";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:5000";
const QUIZ_API_BASE = `${API_BASE}/api/quiz`;

const QUESTION_TYPES = [
  { value: "mcq", label: "MCQ" },
  { value: "definition", label: "Definition" },
  { value: "short_answer", label: "Short answer" },
  { value: "scenario_based", label: "Scenario based" },
  { value: "code_based", label: "Code based" },
  { value: "mixed", label: "Mixed" },
];

const DIFFICULTIES = ["Easy", "Medium", "Hard"];
const QUESTION_COUNTS = [5, 10, 15];

function QuizIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l2 2 4-4" />
      <path d="M20 6v14H4V4h10" />
      <path d="M14 4h6v6" />
    </svg>
  );
}

function getQuestionLabel(type) {
  return QUESTION_TYPES.find((item) => item.value === type)?.label || type;
}

export default function QuizModule({ userName }) {
  const [subjects, setSubjects] = useState([]);
  const [topics, setTopics] = useState([]);
  const [selectedSubtopics, setSelectedSubtopics] = useState([]);
  const [form, setForm] = useState({
    subject: "",
    topic: "",
    question_type: "mcq",
    difficulty: "Medium",
    num_questions: 5,
  });
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const activeTopic = useMemo(
    () => topics.find((topic) => topic.main_topic === form.topic),
    [topics, form.topic]
  );

  useEffect(() => {
    const loadSubjects = async () => {
      setLoadingSubjects(true);
      setError("");

      try {
        const res = await fetch(`${QUIZ_API_BASE}/subjects`, {
          credentials: "include",
        });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || data.reply || "Unable to load quiz subjects");
        }

        setSubjects(Array.isArray(data.subjects) ? data.subjects : []);
      } catch (err) {
        setError(err.message || "Unable to load quiz subjects");
      } finally {
        setLoadingSubjects(false);
      }
    };

    loadSubjects();
  }, []);

  useEffect(() => {
    if (!form.subject) {
      setTopics([]);
      return;
    }

    const loadTopics = async () => {
      setLoadingTopics(true);
      setError("");
      setTopics([]);
      setSelectedSubtopics([]);
      setForm((prev) => ({ ...prev, topic: "" }));

      try {
        const res = await fetch(
          `${QUIZ_API_BASE}/topics/${encodeURIComponent(form.subject)}`,
          { credentials: "include" }
        );
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || data.reply || "Unable to load topics");
        }

        setTopics(Array.isArray(data.topics) ? data.topics : []);
      } catch (err) {
        setError(err.message || "Unable to load topics");
      } finally {
        setLoadingTopics(false);
      }
    };

    loadTopics();
  }, [form.subject]);

  useEffect(() => {
    setSelectedSubtopics([]);
  }, [form.topic]);

  const updateForm = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError("");
  };

  const toggleSubtopic = (subtopic) => {
    setSelectedSubtopics((prev) =>
      prev.includes(subtopic)
        ? prev.filter((item) => item !== subtopic)
        : [...prev, subtopic]
    );
  };

  const generateQuiz = async () => {
    if (!form.subject || !form.topic) {
      setError("Choose a subject and topic before generating a quiz.");
      return;
    }

    setGenerating(true);
    setError("");
    setQuiz(null);
    setResult(null);
    setAnswers({});

    try {
      const res = await fetch(`${QUIZ_API_BASE}/generate-quiz`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...form,
          num_questions: Number(form.num_questions),
          selected_subtopics: selectedSubtopics,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || data.reply || "Unable to generate quiz");
      }

      setQuiz(data);
    } catch (err) {
      setError(err.message || "Unable to generate quiz");
    } finally {
      setGenerating(false);
    }
  };

  const updateAnswer = (questionId, value) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const submitQuiz = async () => {
    if (!quiz?.questions?.length) return;

    const unanswered = quiz.questions.filter(
      (question) => !String(answers[question.id] || "").trim()
    );

    if (unanswered.length > 0) {
      setError(`Answer all questions before submitting. ${unanswered.length} left.`);
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(`${QUIZ_API_BASE}/submit-quiz`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...quiz,
          username: userName || "Learner",
          answers: quiz.questions.map((question) => ({
            id: question.id,
            answer: answers[question.id],
          })),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || data.reply || "Unable to submit quiz");
      }

      setResult(data);
    } catch (err) {
      setError(err.message || "Unable to submit quiz");
    } finally {
      setSubmitting(false);
    }
  };

  const resetQuiz = () => {
    setQuiz(null);
    setAnswers({});
    setResult(null);
    setError("");
  };

  return (
    <div className="quiz-shell">
      <section className="card quiz-panel">
        <div className="quiz-panel-head">
          <div>
            <p className="card-eyebrow">Quiz Studio</p>
            <h3 className="card-title">Generate a focused practice quiz</h3>
            <p className="card-body">
              Choose a course topic, difficulty, and question style to create a fresh quiz.
            </p>
          </div>
          <div className="quiz-mark" aria-hidden="true">
            <QuizIcon />
          </div>
        </div>

        {error && <p className="msg err">{error}</p>}

        <div className="quiz-form-grid">
          <label className="quiz-field">
            <span className="lbl">Subject</span>
            <select
              className="lang-select"
              value={form.subject}
              onChange={(e) => updateForm("subject", e.target.value)}
              disabled={loadingSubjects || generating}
            >
              <option value="">
                {loadingSubjects ? "Loading subjects..." : "Select subject"}
              </option>
              {subjects.map((subject) => (
                <option key={subject} value={subject}>
                  {subject}
                </option>
              ))}
            </select>
          </label>

          <label className="quiz-field">
            <span className="lbl">Topic</span>
            <select
              className="lang-select"
              value={form.topic}
              onChange={(e) => updateForm("topic", e.target.value)}
              disabled={!form.subject || loadingTopics || generating}
            >
              <option value="">
                {loadingTopics ? "Loading topics..." : "Select topic"}
              </option>
              {topics.map((topic) => (
                <option key={topic.main_topic} value={topic.main_topic}>
                  {topic.main_topic}
                </option>
              ))}
            </select>
          </label>

          <label className="quiz-field">
            <span className="lbl">Question Type</span>
            <select
              className="lang-select"
              value={form.question_type}
              onChange={(e) => updateForm("question_type", e.target.value)}
              disabled={generating}
            >
              {QUESTION_TYPES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="quiz-field">
            <span className="lbl">Difficulty</span>
            <select
              className="lang-select"
              value={form.difficulty}
              onChange={(e) => updateForm("difficulty", e.target.value)}
              disabled={generating}
            >
              {DIFFICULTIES.map((difficulty) => (
                <option key={difficulty} value={difficulty}>
                  {difficulty}
                </option>
              ))}
            </select>
          </label>

          <label className="quiz-field">
            <span className="lbl">Questions</span>
            <select
              className="lang-select"
              value={form.num_questions}
              onChange={(e) => updateForm("num_questions", Number(e.target.value))}
              disabled={generating}
            >
              {QUESTION_COUNTS.map((count) => (
                <option key={count} value={count}>
                  {count}
                </option>
              ))}
            </select>
          </label>
        </div>

        {activeTopic?.subtopics?.length > 0 && (
          <div className="quiz-subtopics">
            <div className="quiz-subtopics-head">
              <p className="lbl">Subtopics</p>
              <button
                type="button"
                className="quiz-text-btn"
                onClick={() =>
                  setSelectedSubtopics(
                    selectedSubtopics.length === activeTopic.subtopics.length
                      ? []
                      : activeTopic.subtopics
                  )
                }
              >
                {selectedSubtopics.length === activeTopic.subtopics.length
                  ? "Clear all"
                  : "Select all"}
              </button>
            </div>
            <div className="quiz-chip-grid">
              {activeTopic.subtopics.map((subtopic) => (
                <button
                  key={subtopic}
                  type="button"
                  className={`quiz-chip${
                    selectedSubtopics.includes(subtopic) ? " active" : ""
                  }`}
                  onClick={() => toggleSubtopic(subtopic)}
                  disabled={generating}
                >
                  {subtopic}
                </button>
              ))}
            </div>
          </div>
        )}

        {!loadingSubjects && subjects.length === 0 && !error && (
          <p className="card-body">No quiz subjects are available yet.</p>
        )}

        <div className="quiz-actions">
          <button
            className="cta small"
            onClick={generateQuiz}
            disabled={generating || loadingSubjects || loadingTopics}
          >
            {generating ? (
              <>
                <span className="spin" />
                Generating...
              </>
            ) : (
              "Generate Quiz"
            )}
          </button>
          {(quiz || result) && (
            <button className="quiz-secondary-btn" onClick={resetQuiz} type="button">
              New setup
            </button>
          )}
        </div>
      </section>

      {quiz && (
        <section className="card quiz-paper">
          <div className="quiz-paper-head">
            <div>
              <p className="card-eyebrow">{quiz.subject}</p>
              <h3 className="card-title">{quiz.topic}</h3>
              <p className="card-body">
                {getQuestionLabel(quiz.question_type)} | {quiz.difficulty} |{" "}
                {quiz.questions?.length || 0} questions
              </p>
            </div>
            {result && (
              <div className="quiz-score">
                <span>{result.score}/{result.total}</span>
                <small>{result.percentage}%</small>
              </div>
            )}
          </div>

          <div className="quiz-question-list">
            {quiz.questions.map((question, index) => {
              const answerResult = result?.results?.find(
                (item) => String(item.id) === String(question.id)
              );

              return (
                <article
                  className={`quiz-question${
                    answerResult
                      ? answerResult.is_correct
                        ? " correct"
                        : " wrong"
                      : ""
                  }`}
                  key={question.id || index}
                >
                  <div className="quiz-question-top">
                    <span className="quiz-number">{String(index + 1).padStart(2, "0")}</span>
                    <span className="quiz-type">{getQuestionLabel(question.type)}</span>
                  </div>
                  {question.case_study && (
                    <p className="quiz-case">{question.case_study}</p>
                  )}
                  {question.code_snippet && (
                    <pre className="quiz-code">{question.code_snippet}</pre>
                  )}
                  <p className="quiz-question-text">{question.question}</p>

                  {question.type === "mcq" && Array.isArray(question.options) ? (
                    <div className="quiz-options">
                      {question.options.map((option) => (
                        <button
                          key={option.key}
                          type="button"
                          className={`quiz-option${
                            answers[question.id] === option.key ? " selected" : ""
                          }`}
                          onClick={() => updateAnswer(question.id, option.key)}
                          disabled={!!result}
                        >
                          <span>{option.key}</span>
                          {option.text}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <textarea
                      className="quiz-answer"
                      value={answers[question.id] || ""}
                      onChange={(e) => updateAnswer(question.id, e.target.value)}
                      placeholder="Type your answer..."
                      disabled={!!result}
                    />
                  )}

                  {answerResult && (
                    <div className="quiz-feedback">
                      <span className={answerResult.is_correct ? "ok" : "err"}>
                        {answerResult.is_correct ? "Correct" : "Needs review"}
                      </span>
                      <p>Correct answer: {answerResult.correct_answer}</p>
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          {!result ? (
            <button className="cta small quiz-submit" onClick={submitQuiz} disabled={submitting}>
              {submitting ? (
                <>
                  <span className="spin" />
                  Checking...
                </>
              ) : (
                "Submit Quiz"
              )}
            </button>
          ) : (
            <div className="result-strip">
              <span className="result-badge">Completed</span>
              <p className="card-body">
                You scored {result.score} out of {result.total}. Review answers above and
                generate a new setup whenever you are ready.
              </p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
