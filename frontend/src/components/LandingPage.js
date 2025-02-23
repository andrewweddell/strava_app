import React from "react";
import "../styles/LandingPage.css";

const LandingPage = ({ onSelectUser }) => {
  return (
    <div className="landing-container">
      <h1>Select a User</h1>
      <button className="user-button" onClick={() => onSelectUser("Andrew")}>
        Andrew
      </button>
      <button className="user-button" onClick={() => onSelectUser("Dale")}>
        Dale
      </button>
    </div>
  );
};

export default LandingPage;