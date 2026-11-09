/**
 * Mock interviews: a build problem, a target level, and a twist that lands mid-design.
 * The twist changes what the final design is graded against, like an interviewer asking "what if…?".
 */
export type TwistKind = "traffic" | "budget" | "failure";

export interface Twist {
  kind: TwistKind;
  title: string;
  prompt: string;
  /** traffic: multiply peak RPS. budget: multiply the cost limit. */
  factor?: number;
}

export interface MockInterview {
  id: string;
  problem: string;
  level: "E4" | "E5" | "E6";
  minutes: number;
  twist: Twist;
}

const T = {
  traffic15: {
    kind: "traffic",
    factor: 1.5,
    title: "Traffic +50%",
    prompt: "A big partner integrates next week and brings 50% more traffic at peak. Make sure the design holds.",
  },
  budget: {
    kind: "budget",
    factor: 0.75,
    title: "Budget cut by 25%",
    prompt: "Finance is cutting infrastructure spend by a quarter. Meet every requirement for 25% less.",
  },
  failure: {
    kind: "failure",
    title: "Lose any one component",
    prompt: "Your interviewer asks: what happens if any single box on your diagram dies? Make sure nothing can take the whole system down.",
  },
} satisfies Record<string, Twist>;

export const INTERVIEWS: MockInterview[] = [
  { id: "mock-pastebin", problem: "pastebin", level: "E4", minutes: 45, twist: T.failure },
  { id: "mock-notifications", problem: "notification-system", level: "E4", minutes: 45, twist: T.traffic15 },
  { id: "mock-chat", problem: "chat-app", level: "E5", minutes: 45, twist: T.failure },
  { id: "mock-shopping", problem: "shopping-app", level: "E5", minutes: 45, twist: T.budget },
  { id: "mock-live-comments", problem: "live-comments", level: "E5", minutes: 45, twist: T.traffic15 },
  { id: "mock-social-feed", problem: "social-feed", level: "E6", minutes: 45, twist: T.traffic15 },
  { id: "mock-ride-hailing", problem: "ride-hailing", level: "E6", minutes: 45, twist: T.failure },
  { id: "mock-top-k", problem: "top-k-trending", level: "E6", minutes: 45, twist: T.budget },
];

export const getInterview = (id: string) => INTERVIEWS.find((i) => i.id === id);
