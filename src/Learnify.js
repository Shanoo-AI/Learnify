import { useState } from "react";
import "./App.css";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:5000";
const BATCH_SIZE = 3;

export default function Learnify() {
  const [topics, setTopics] = useState([]);
  const [videos, setVideos] = useState([]);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [backgroundLoading, setBackgroundLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [showLearning, setShowLearning] = useState(false);
  const [showTopicList, setShowTopicList] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "" });
  const [processedTopicsCount, setProcessedTopicsCount] = useState(0);

  const showToastMessage = (message) => {
    setToast({ show: true, message });
    setTimeout(() => setToast({ show: false, message: "" }), 3000);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    handleFiles(files);
  };

  const handleFiles = async (files) => {
    for (const file of files) {
      await uploadFile(file);
    }
  };

  const uploadFile = async (file) => {
    const formData = new FormData();
    formData.append("file", file);

    setLoading(true);
    setUploadProgress(0);

    try {
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 100);

      const response = await fetch(`${API_BASE}/api/upload`, {
        method: "POST",
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      const data = await response.json();

      if (data.success) {
        const extractedTopics = Array.isArray(data.topics) ? data.topics : [];

        setTopics(extractedTopics);
        setVideos([]);
        setCurrentVideoIndex(0);
        setShowTopicList(false);
        setShowLearning(false);
        setShowResults(true);

        if (extractedTopics.length > 0) {
          showToastMessage(`Found ${extractedTopics.length} topics.`);
        } else {
          showToastMessage("Uploaded, but no course topics were found.");
        }
      } else {
        throw new Error(data.error || "Upload failed");
      }
    } catch (error) {
      console.error("Upload error:", error);
      showToastMessage(`Upload failed: ${error.message}`);
    } finally {
      setLoading(false);
      setTimeout(() => setUploadProgress(0), 1000);
    }
  };

  const getBatchStartForIndex = (index) =>
    Math.floor(index / BATCH_SIZE) * BATCH_SIZE;

  const fetchVideosBatch = async (
    topicsBatch,
    isInitial = false,
    startIndex = 0
  ) => {
    if (topicsBatch.length === 0) return;

    if (isInitial) setLoadingVideos(true);
    else setBackgroundLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/get-youtube-videos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topics: topicsBatch }),
      });

      if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

      const data = await response.json();

      if (data.success && data.videos) {
        setVideos((prevVideos) => {
          const nextVideos =
            prevVideos.length === topics.length
              ? [...prevVideos]
              : Array(topics.length).fill(null);

          data.videos.forEach((video, offset) => {
            nextVideos[startIndex + offset] = video;
          });

          setProcessedTopicsCount(
            nextVideos.filter((video) => Boolean(video)).length
          );
          return nextVideos;
        });

        if (isInitial) {
          setCurrentVideoIndex(0);
          setShowLearning(true);
          setShowResults(false);
          showToastMessage("Playlist mode started. Loading more videos as you continue.");
        }
      }
    } catch (error) {
      console.error("Error fetching videos:", error);
      if (isInitial) showToastMessage(`Failed to fetch videos: ${error.message}`);
    } finally {
      setLoadingVideos(false);
      setBackgroundLoading(false);
    }
  };

  const fetchTopicBatchAtIndex = (index) => {
    const startIndex = getBatchStartForIndex(index);
    const topicsBatch = topics.slice(startIndex, startIndex + BATCH_SIZE);
    return fetchVideosBatch(topicsBatch, false, startIndex);
  };

  const handleStartLearning = async () => {
    if (topics.length === 0) {
      showToastMessage("No topics available.");
      return;
    }

    setProcessedTopicsCount(0);
    setVideos(Array(topics.length).fill(null));
    setShowTopicList(false);

    const firstBatch = topics.slice(0, BATCH_SIZE);
    await fetchVideosBatch(firstBatch, true, 0);
  };

  const handleNext = () => {
    const nextIndex = currentVideoIndex + 1;

    if (nextIndex < topics.length) {
      setCurrentVideoIndex(nextIndex);

      if (!videos[nextIndex]) {
        fetchTopicBatchAtIndex(nextIndex);
      }
    }
  };

  const handlePrevious = () => {
    if (currentVideoIndex > 0) {
      setCurrentVideoIndex(currentVideoIndex - 1);
    }
  };

  const handleTopicJump = (index) => {
    setCurrentVideoIndex(index);

    if (!videos[index]) {
      fetchTopicBatchAtIndex(index);
    }
  };

  const getCurrentVideo = () => videos[currentVideoIndex] || null;

  return (
    <div className="app-container">
      <div className="stars" />
      <div className="stars2" />
      <div className="stars3" />
      <div className="grid-overlay" />

      <div className="container">
        <header className="header">
          <div className="logo">
            <span className="logo-icon">YT</span>
            <span className="logo-text">
              <span className="logo-main">Learnify Module</span>
            </span>
          </div>
        </header>

        <main className="main-content">
          <section className="upload-section">
            <div className="upload-card">
              <div className="upload-header">
                <div className="upload-heading">
                  <h2 className="upload-title">File Upload</h2>
                  <p className="upload-tagline">
                    Upload documents and learn instantly with curated video recommendations.
                  </p>
                </div>
              </div>

              <div
                className={`drop-zone ${isDragging ? "drag-over" : ""}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => document.getElementById("fileInput")?.click()}
              >
                <div className="drop-zone-content">
                  <div className="upload-icon">Upload</div>
                  <h3 className="drop-title">Drag and drop files here</h3>
                  <p className="drop-subtitle">or click to browse</p>
                  <p className="drop-formats">
                    Supported: DOC, DOCX, PDF, TXT, JSON, CSV, Images
                  </p>
                </div>
                <input
                  type="file"
                  id="fileInput"
                  multiple
                  accept=".doc,.docx,.pdf,.txt,.json,.csv,.png,.jpg,.jpeg,.gif"
                  style={{ display: "none" }}
                  onChange={handleFileSelect}
                />
              </div>

              {loading && (
                <div className="upload-progress">
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className="progress-text">Processing...</p>
                </div>
              )}
            </div>
          </section>

          {showResults && !showLearning && (
            <section className="results-section">
              <div className="results-card">
                <div className="results-header">
                  <h2 className="results-title">Extracted Topics</h2>
                  <button
                    className="close-btn"
                    onClick={() => setShowResults(false)}
                  >
                    x
                  </button>
                </div>
                <div className="topics-container">
                  {topics.map((topic, index) => (
                    <div key={index} className="topic-item">
                      <div className="topic-text">{topic}</div>
                    </div>
                  ))}
                </div>
                <div className="start-learning-container">
                  {topics.length > 0 && (
                    <p className="topics-count">Found {topics.length} topics</p>
                  )}
                  <button
                    className="start-learning-btn"
                    onClick={(e) => {
                      e.preventDefault();
                      handleStartLearning();
                    }}
                    disabled={loadingVideos || topics.length === 0}
                    type="button"
                  >
                    {loadingVideos ? "Loading initial videos..." : "Start Learning"}
                  </button>
                  {topics.length === 0 && (
                    <p className="error-text">
                      No topics available. Please upload a supported file.
                    </p>
                  )}
                </div>
              </div>
            </section>
          )}

          {showLearning && videos.length > 0 && (
            <section className="learning-section">
              <div className="learning-card">
                <div className="learning-header">
                  <h2 className="learning-title">Playlist Mode</h2>
                  {backgroundLoading && (
                    <span
                      style={{
                        fontSize: "0.8rem",
                        color: "#86efac",
                        marginLeft: "10px",
                      }}
                    >
                      Fetching more videos...
                    </span>
                  )}
                  <span className="playlist-loaded-count">
                    {processedTopicsCount}/{topics.length} ready
                  </span>
                  <button
                    className="close-btn"
                    onClick={() => {
                      setShowLearning(false);
                      setShowResults(true);
                    }}
                  >
                    x
                  </button>
                </div>

                <div
                  className={`learning-body ${
                    showTopicList ? "topics-open" : "topics-collapsed"
                  }`}
                >
                  <aside
                    className={`playlist-topics ${
                      showTopicList ? "expanded" : "collapsed"
                    }`}
                    aria-label="Playlist topics"
                  >
                    <button
                      className="playlist-rail-toggle"
                      onClick={() => setShowTopicList((visible) => !visible)}
                      type="button"
                      aria-expanded={showTopicList}
                      title={showTopicList ? "Collapse topics" : "Expand topics"}
                    >
                      <span>{showTopicList ? "<" : ">"}</span>
                      {showTopicList && <span>Topics</span>}
                    </button>
                    {topics.map((topic, index) => (
                      <button
                        key={`${topic}-${index}`}
                        className={`playlist-topic-btn ${
                          index === currentVideoIndex ? "active" : ""
                        }`}
                        onClick={() => handleTopicJump(index)}
                        type="button"
                      >
                        <span className="playlist-topic-number">{index + 1}</span>
                        {showTopicList && (
                          <>
                            <span className="playlist-topic-text">{topic}</span>
                            <span className="playlist-topic-status">
                              {videos[index] ? "Ready" : "Load"}
                            </span>
                          </>
                        )}
                      </button>
                    ))}
                  </aside>

                  <div className="learning-player">
                    <div className="video-info">
                      <h3 className="current-topic">
                        Topic {currentVideoIndex + 1} of {topics.length}:{" "}
                        {getCurrentVideo()?.topic || topics[currentVideoIndex]}
                      </h3>
                      {getCurrentVideo()?.title && (
                        <p className="video-title">{getCurrentVideo().title}</p>
                      )}
                    </div>

                    <div className="video-container">
                      {!getCurrentVideo() ? (
                        <div className="no-video">
                          <p>Loading this topic...</p>
                        </div>
                      ) : getCurrentVideo().videoId ? (
                        <iframe
                          width="100%"
                          height="500"
                          src={`https://www.youtube.com/embed/${getCurrentVideo().videoId}`}
                          title={getCurrentVideo().title || getCurrentVideo().topic}
                          frameBorder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          className="youtube-player"
                        />
                      ) : (
                        <div className="no-video">
                          <p>No video found for this topic.</p>
                          {getCurrentVideo().url && (
                            <a
                              href={getCurrentVideo().url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="external-link-btn"
                            >
                              Open in YouTube
                            </a>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="video-navigation">
                      <button
                        className="nav-btn prev-btn"
                        onClick={handlePrevious}
                        disabled={currentVideoIndex === 0}
                      >
                        Previous
                      </button>
                      <div className="video-counter">
                        Video {currentVideoIndex + 1} / {topics.length}
                      </div>
                      <button
                        className="nav-btn next-btn"
                        onClick={handleNext}
                        disabled={currentVideoIndex === topics.length - 1}
                      >
                        {backgroundLoading && !videos[currentVideoIndex + 1]
                          ? "Loading..."
                          : "Next"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}
        </main>

        <footer className="footer">
          <div className="footer-content">
            <p className="footer-text">Powered by AI-assisted curation</p>
            <p className="footer-version">Version 2.0.1</p>
          </div>
        </footer>
      </div>

      {toast.show && (
        <div className="toast show">
          <span className="toast-message">{toast.message}</span>
        </div>
      )}

      {loadingVideos && (
        <div className="loading-overlay">
          <div className="loading-spinner">
            <div className="spinner-ring" />
            <div className="spinner-ring" />
            <div className="spinner-ring" />
          </div>
          <p className="loading-text">Curating playlist...</p>
        </div>
      )}
    </div>
  );
}
