/**
 * Maps free-text goal descriptions to the backend's goal enum.
 * Best-effort heuristic — the AI will also see the raw text via goal_description
 * and can adapt regardless of the classification.
 */
export function classifyGoal(
  text: string
): "fat_loss" | "muscle" | "performance" | "wellness" {
  const t = text.toLowerCase();

  if (
    /\b(lose|fat|weight|slim|lean|cut|shred|tone|skinny|diet|calories|deficit|burn)\b/.test(
      t
    ) ||
    /\b\d+\s*(kg|lbs?|pounds?|kilos?)\b/.test(t)
  ) {
    return "fat_loss";
  }

  if (
    /\b(muscle|bulk|mass|hypertrophy|size|jacked|gain|bigger|stronger|bodybuilding|bench|squat|deadlift|lift)\b/.test(
      t
    )
  ) {
    return "muscle";
  }

  if (
    /\b(sport|swim|run|marathon|race|compete|competition|performance|athlete|game|match|fight|speed|power|agility|cycling|soccer|football|basketball|tennis|mma|boxing|triathlon|crossfit|powerlifting)\b/.test(
      t
    )
  ) {
    return "performance";
  }

  return "wellness";
}
