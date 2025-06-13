import React from 'react';

// CSS for the loader is embedded within the component using a <style> tag.
// This makes the component fully self-contained.
const styles = `
.loading-wrapper {
  display: flex;
  flex-direction: column; /* Stack dots and text vertically */
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  min-height: 150px; /* Ensures visibility on smaller containers */
  padding: 2rem 0;
  margin-top: 200px; /* Space above the loader */
}

.dots-container {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 20px; /* Space between dots and text */
}

.loading-dot {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  margin: 0 8px; /* A bit more spacing for a cleaner look */
  animation: jump 1.4s infinite ease-in-out;
  box-shadow: 0 5px 10px rgba(0, 0, 0, 0.2); /* Added a subtle shadow */
}

.loading-text {
    font-size: 1.25rem;
    font-weight: 500;
    color:rgb(107, 108, 110); /* A light gray color that fits the theme */
    animation: fade-in-out 1.4s infinite ease-in-out;
    animation-delay: 0.2s; /* Start fading in slightly after the first dot jumps */
}


/* * The keyframe animation for the jumping effect.
 * It moves the dots up and then back to their original position.
 */
@keyframes jump {
  0%, 100% {
    transform: translateY(0);
    animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
  }
  50% {
    transform: translateY(-30px);
    animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
  }
}

/**
 * Keyframe animation for the "Loading..." text to give it a subtle pulse.
 */
@keyframes fade-in-out {
    0%, 100% {
        opacity: 0.5;
    }
    50% {
        opacity: 1;
    }
}


/* * Each dot has a specific background color and animation delay 
 * to create the staggered "wave" effect with a new color palette.
 */
.loading-dot:nth-child(1) {
  background-color:rgb(43, 86, 217); /* Deep Purple */
  animation-delay: 0s;
}

.loading-dot:nth-child(2) {
  background-color:rgb(68, 142, 253); /* Medium Lavender */
  animation-delay: 0.2s;
}

.loading-dot:nth-child(3) {
  background-color:rgb(48, 147, 65); /* Bright Magenta */
  animation-delay: 0.4s;
}

.loading-dot:nth-child(4) {
  background-color:rgb(77, 205, 51); /* Vibrant Cyan */
  animation-delay: 0.6s;
}
`;
const LiquidLoader = () => {
  return (
    <>
      <style>{styles}</style>
      <div className="loading-wrapper">
        <div className="dots-container">
            <div className="loading-dot"></div>
            <div className="loading-dot"></div>
            <div className="loading-dot"></div>
            <div className="loading-dot"></div>
        </div>
        <p className="loading-text">Loading...</p>
      </div>
    </>
  );
};

export default LiquidLoader;
