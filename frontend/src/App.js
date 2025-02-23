import React, { useState } from "react";
import LandingPage from "./components/LandingPage";
import SegmentDisplay from "./components/SegmentDisplay";
import "./App.css";

function App() {
  const [selectedUser, setSelectedUser] = useState(null);

  const handleSelectUser = (user) => {
    setSelectedUser(user);
  };

  return (
    <div className="app-container">
      {!selectedUser ? (
        <LandingPage onSelectUser={handleSelectUser} />
      ) : (
        <SegmentDisplay user={selectedUser} />
      )}
    </div>
  );
}

export default App;