export function recommendationReasonText(reasonCode: string, clubName: string) {
  switch (reasonCode) {
    case "deadline_urgent":
      return `${clubName} has an active deadline coming up soon.`;
    case "verified_popular":
      return `${clubName} is a verified club with strong recent student interest.`;
    case "popular_on_rush":
      return `${clubName} is trending with students on Rush right now.`;
    case "semantic_match":
      return `${clubName} matches your interests and past club behavior.`;
    case "interest_match":
      return `${clubName} lines up with the interests listed in your profile.`;
    case "hybrid_match":
      return `${clubName} blends your profile and recent activity signals well.`;
    default:
      return `${clubName} is a strong fit based on your recent Rush activity.`;
  }
}
