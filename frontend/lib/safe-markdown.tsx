import ReactMarkdown from "react-markdown";

interface Props {
  content: any;
  className?: string;
}

export default function SafeMarkdown({ content, className }: Props) {
  const text = typeof content === "string"
    ? content
    : typeof content === "object" && content !== null
      ? JSON.stringify(content, null, 2)
      : String(content || "");

  return (
    <div className={className}>
      <ReactMarkdown>{text}</ReactMarkdown>
    </div>
  );
}
