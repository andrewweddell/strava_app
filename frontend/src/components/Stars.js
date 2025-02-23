import React from "react";
import "../styles/Stars.css";

const Stars = ({ rating }) => {
  const stars = [];
  const filledStars = Math.round(rating); // Assuming rating is between 0 and 5
  for (let i = 0; i < 5; i++) {
    stars.push(
      <span key={i} className={i < filledStars ? "star filled" : "star"}>
        ★
      </span>
    );
  }
  return <div className="stars">{stars}</div>;
};

export default Stars;