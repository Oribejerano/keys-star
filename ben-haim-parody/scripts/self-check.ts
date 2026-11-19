import { generatePost } from "../lib/generate";
import { loadFewshot } from "../lib/fewshot";
import { mockPost } from "../lib/mock";
import { retrieveExamples } from "../lib/retrieve";
import { generalizePrivate, screenTopic } from "../lib/safety";
import { CLOSING, OPENING, ensureMarkers } from "../lib/text";

process.env.MOCK_LLM = "1";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const refused = [
  "החטופים",
  "שבעה באוקטובר",
  "שכול במשפחה",
  "השכן שלי גנב לי את החניה",
  "להכפיש את דני מהעבודה",
];
for (const topic of refused) {
  assert(screenTopic(topic), `expected refusal for: ${topic}`);
}

const allowed = ["הפקק באיילון", "החומוס נגמר", "הבוס שלי והמזגן", "גמר ה-NBA"];
for (const topic of allowed) {
  assert(screenTopic(topic) === null, `expected allow for: ${topic}`);
}

assert(generalizePrivate("הבוס שלי והמזגן").includes("הבוס הפריווילג"), "private role was not generalized");

const first = mockPost("הפקק באיילון", 0);
const second = mockPost("הפקק באיילון", 1);
assert(first.startsWith(OPENING), "mock missing opening");
assert(first.endsWith(CLOSING), "mock missing closing");
assert(first.includes("הפקק באיילון"), "mock missing topic");
assert(first !== second, "variants should differ");
assert(ensureMarkers("בלי סימון").includes(OPENING), "marker repair failed");

const examples = loadFewshot();
assert(examples.length >= 20, `fewshot parsed too few examples: ${examples.length}`);
assert(!examples.some((example) => example.text.includes("באוקטובר")), "tragic fewshot leaked");

const near = retrieveExamples("הגמוניה ונתניהו");
assert(near.length >= 2, "retrieval returned too little");

async function main() {
  const generated = await generatePost("אסיפת הורים", 0);
  assert(generated.ok && generated.mocked, "mock generate failed");
  if (generated.ok) {
    assert(generated.text.includes("(בחיי)") || generated.text.includes("הגמוניה"), "mock voice missing");
    assert(generated.text.includes(OPENING) && generated.text.includes(CLOSING), "generated markers missing");
  }

  const blocked = await generatePost("פוסט על החטופים", 0);
  assert(!blocked.ok && blocked.refused, "api path did not refuse hostages");

  console.log(`self-check ok · fewshot ${examples.length} · retrieved ${near.length}`);
}

main();
