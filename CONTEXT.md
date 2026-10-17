# ScreenPipe Automation Flows (hackathon)

Vocabulary for the hackathon feature that turns a repetitive task detected by
ScreenPipe into a reviewable automation backed by n8n.

## Language

**Detected Task**:
A repetitive piece of work that ScreenPipe found in the user's recorded
activity, with its steps and evidence. Stored by ScreenPipe as a "workflow"
(`wf-…` id).
_Avoid_: workflow (unqualified), proposal, pattern

**Evidence**:
The recorded repetitions of a Detected Task (screen captures and timestamps)
that justify detecting it.
_Avoid_: proof, history

**Clarification Question**:
A question the AI asks about a Detected Task; all of them must be answered
before an Automation Flow can be created from that task.
_Avoid_: open question, survey

**Task Page**:
The page of one Detected Task, opened from the notification: what was
detected, its Evidence, and its Clarification Questions.
_Avoid_: proposal page, intermediate page

**Automation Flow** (or **Flow**):
Our automation type: an n8n workflow created by the AI for the user, plus the
material that lets the user review it.
_Avoid_: pipe, automation (unqualified), n8n workflow (when meaning the Flow)

**n8n workflow**:
The graph of nodes, trigger included, that backs a Flow and lives in n8n.
Always qualified with "n8n".
_Avoid_: workflow (unqualified), graph

**Review Screen**:
The page where the user reads what a Flow does and decides to activate it.
_Avoid_: validation page, creation page

**Activation**:
The explicit user action that switches a Flow's n8n workflow on.
_Avoid_: deploy, enable, accept

## Flow states

**Draft**:
A Flow that has never been activated.

**Paused**:
A Flow that was activated, then switched off, and has not changed since.
_Avoid_: stopped, disabled

**Needs Review**:
A Flow whose n8n workflow changed since its last Activation; it must be
reviewed and activated again.
_Avoid_: outdated, dirty

## Relationships

- A **Detected Task** has **Evidence** and zero or more **Clarification Questions**.
- An **Automation Flow** is created from exactly one **Detected Task** (after all its
  **Clarification Questions** are answered) or from a chat request.
- An **Automation Flow** is backed by exactly one **n8n workflow**.
- Nothing runs before **Activation** on the **Review Screen**.
