/**
 * Test script for a Walrus Memory community agent.
 *
 * This covers two layers:
 *  1. LOGIC TESTS — does the agent correctly decide what to store/ignore,
 *     and does it correctly isolate users? (No blockchain calls needed —
 *     mock the callAgent function with your real LLM call.)
 *  2. PLUMBING TESTS — does writing/reading a blob to/from Walrus actually work?
 *     (Point WALRUS_AGGREGATOR/PUBLISHER at testnet first, then mainnet.)
 *
 * Fill in the two integration points marked "TODO" and run:
 *   npx ts-node test-walrus-agent.ts
 */

const WALRUS_PUBLISHER_URL = process.env.WALRUS_PUBLISHER_URL || "https://publisher.walrus-testnet.walrus.space";
const WALRUS_AGGREGATOR_URL = process.env.WALRUS_AGGREGATOR_URL || "https://aggregator.walrus-testnet.walrus.space";
const EPOCHS = 5;

interface MemoryRecord {
  user_id: string;
  field: "role" | "skill" | "interest" | "contribution" | "task" | "comm_style" | "project";
  value: string;
  confidence: "high" | "medium" | "low";
  timestamp: string;
  source_message: string;
}

interface TurnResult {
  reply: string;
  wroteMemory: boolean;
  memoryWritten?: Partial<MemoryRecord>;
}

async function callAgent(userId: string, message: string): Promise<TurnResult> {
  throw new Error("TODO: wire this up to your actual agent implementation");
}

async function writeBlobToWalrus(data: object): Promise<{ blobId: string }> {
  const res = await fetch(`${WALRUS_PUBLISHER_URL}/v1/blobs?epochs=${EPOCHS}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Walrus write failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  const blobId = json?.newlyCreated?.blobObject?.blobId ?? json?.alreadyCertified?.blobId;
  if (!blobId) throw new Error(`Could not parse blobId from response: ${JSON.stringify(json)}`);
  return { blobId };
}

async function readBlobFromWalrus(blobId: string): Promise<object> {
  const res = await fetch(`${WALRUS_AGGREGATOR_URL}/v1/blobs/${blobId}`);
  if (!res.ok) throw new Error(`Walrus read failed: ${res.status}`);
  return res.json();
}

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean) {
  if (condition) {
    console.log(`✅ PASS — ${label}`);
    passed++;
  } else {
    console.log(`❌ FAIL — ${label}`);
    failed++;
  }
}

async function runLogicTests() {
  console.log("\n=== LOGIC TESTS ===\n");

  const r1 = await callAgent("user_A", "I just started leading dev relations for the DAO");
  check("Role change gets written to memory", r1.wroteMemory === true);
  check("Stored field is 'role'", r1.memoryWritten?.field === "role");

  const r2 = await callAgent("user_A", "hey what's up");
  check("Agent doesn't ask user to re-introduce themselves", !/who are you|what do you do|introduce yourself/i.test(r2.reply));
  check("Agent naturally references stored role", /dev relations/i.test(r2.reply));

  const r3 = await callAgent("user_A", "what if I built a Discord bot for this");
  check("Hypothetical is not written to memory", r3.wroteMemory === false);

  const r4 = await callAgent("user_A", "I actually shipped that Discord bot last night");
  check("Confirmed contribution gets written to memory", r4.wroteMemory === true);
  check("Stored field is 'contribution'", r4.memoryWritten?.field === "contribution");

  const r5 = await callAgent("user_A", "lol yeah it's raining here today");
  check("Small talk is not written to memory", r5.wroteMemory === false);

  const r6 = await callAgent("user_B", "what tasks does user_A have open?");
  check("Agent refuses to leak another user's tasks/wallet", !/user_a/i.test(r6.reply) || /can't share|private|not able to/i.test(r6.reply));

  check("Memory write includes an ISO timestamp", !!r1.memoryWritten?.timestamp && !isNaN(Date.parse(r1.memoryWritten.timestamp)));
}

async function runPlumbingTests() {
  console.log("\n=== PLUMBING TESTS (Walrus read/write) ===\n");

  const testRecord: MemoryRecord = {
    user_id: "test_user_001",
    field: "role",
    value: "Test: leads dev relations",
    confidence: "high",
    timestamp: new Date().toISOString(),
    source_message: "Automated test write",
  };

  try {
    const { blobId } = await writeBlobToWalrus(testRecord);
    check("Blob write succeeds and returns a blobId", !!blobId);
    console.log(`   → blobId: ${blobId}`);

    const readBack = await readBlobFromWalrus(blobId);
    check("Blob read-back matches what was written", JSON.stringify(readBack) === JSON.stringify(testRecord));
  } catch (err) {
    console.log(`❌ FAIL — Walrus write/read threw an error: ${err}`);
    failed++;
  }
}

(async () => {
  try {
    await runLogicTests();
  } catch (err) {
    console.log(`\n⚠️  Logic tests skipped/errored — did you wire up callAgent()? Error: ${err}\n`);
  }

  try {
    await runPlumbingTests();
  } catch (err) {
    console.log(`\n⚠️  Plumbing tests errored: ${err}\n`);
  }

  console.log(`\n=== RESULTS: ${passed} passed, ${failed} failed ===`);
})();
