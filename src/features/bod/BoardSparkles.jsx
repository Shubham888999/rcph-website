const SPARKLE_COUNT = 7;

export default function BoardSparkles({ active, reduceMotion }) {
  if (!active || reduceMotion) return null;

  return (
    <span className="bod-member-card__sparkles" aria-hidden="true">
      {Array.from({ length: SPARKLE_COUNT }, (_, index) => (
        <span key={index} />
      ))}
    </span>
  );
}
