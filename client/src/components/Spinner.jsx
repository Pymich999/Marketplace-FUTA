import React from 'react';

// Simple CSS for the spinner component
const spinnerStyles = `
  .spinner-container {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    width: 100%;
    background-color: var(--background);
  }
  
  .spinner {
    width: 50px;
    height: 50px;
    border: 5px solid var(--surface-light);
    border-top: 5px solid var(--primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

function Spinner() {
  return (
    <div className="spinner-container">
      <style>{spinnerStyles}</style>
      <div className="spinner"></div>
    </div>
  );
}

export default Spinner;