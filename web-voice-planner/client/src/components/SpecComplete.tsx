interface Props {
  specPath: string;
  specContent: string;
  onNewSession: () => void;
}

export function SpecComplete({ specPath, specContent, onNewSession }: Props) {
  return (
    <div className="spec-complete">
      <h2>Specification Complete!</h2>
      <p>Your solution spec has been saved to:</p>
      <code>{specPath}</code>

      <details>
        <summary>Preview Spec</summary>
        <pre>{specContent}</pre>
      </details>

      <button onClick={onNewSession}>Start New Session</button>
    </div>
  );
}
