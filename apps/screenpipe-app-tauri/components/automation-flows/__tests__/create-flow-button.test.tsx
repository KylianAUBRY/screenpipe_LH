// screenpipe — AI that knows everything you've seen, said, or heard
// https://screenpipe.com

import React, { useRef, useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CREATION_PROMPT } from "../api";
import { CreateFlowButton, withCreationPrompt } from "../create-flow-button";

// A composer as the chat holds it: the button only changes its text.
function Composer({ initial = "", disabled = false }: { initial?: string; disabled?: boolean }) {
  const [value, setValue] = useState(initial);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  return (
    <>
      <textarea
        aria-label="composer"
        ref={inputRef}
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
      <CreateFlowButton
        value={value}
        inputRef={inputRef}
        onValueChange={setValue}
        disabled={disabled}
      />
    </>
  );
}

describe("Create flow in the main chat", () => {
  it("starts the composer with the automation-flows skill prompt, unsent, and focuses it", async () => {
    render(<Composer />);
    fireEvent.click(screen.getByRole("button", { name: "Create flow" }));

    const composer = screen.getByLabelText("composer") as HTMLTextAreaElement;
    expect(composer.value).toBe(CREATION_PROMPT);
    expect(composer.value).toContain("skill automation-flows");
    await waitFor(() => expect(document.activeElement).toBe(composer));
    expect(composer.selectionStart).toBe(CREATION_PROMPT.length);
  });

  it("keeps what the user already typed as the description", () => {
    render(<Composer initial="  crée un ticket Jira pour chaque email de bug " />);
    fireEvent.click(screen.getByRole("button", { name: "Create flow" }));

    expect((screen.getByLabelText("composer") as HTMLTextAreaElement).value).toBe(
      `${CREATION_PROMPT}crée un ticket Jira pour chaque email de bug`,
    );
  });

  it("does not add the prompt twice", () => {
    const once = withCreationPrompt("trie mes emails");
    expect(withCreationPrompt(once)).toBe(once);
  });

  it("does nothing while the chat cannot take a message", () => {
    render(<Composer disabled />);
    const button = screen.getByRole("button", { name: "Create flow" });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect((screen.getByLabelText("composer") as HTMLTextAreaElement).value).toBe("");
  });
});
