import { Button } from "@/components/ui/button";
import { Bold, Italic, Underline } from "lucide-react";
import { Card } from "@/components/ui/card";

interface TextFormattingToolbarProps {
  position: { x: number; y: number };
  onFormat: (format: "bold" | "italic" | "underline") => void;
}

export const TextFormattingToolbar = ({ position, onFormat }: TextFormattingToolbarProps) => {
  return (
    <Card
      className="fixed z-50 flex gap-1 p-1 shadow-lg bg-background border"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: "translateY(-100%) translateY(-8px)",
      }}
    >
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onFormat("bold")}
        className="h-8 w-8 p-0"
      >
        <Bold className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onFormat("italic")}
        className="h-8 w-8 p-0"
      >
        <Italic className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onFormat("underline")}
        className="h-8 w-8 p-0"
      >
        <Underline className="h-4 w-4" />
      </Button>
    </Card>
  );
};
