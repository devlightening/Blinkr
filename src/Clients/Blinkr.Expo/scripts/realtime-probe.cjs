// BLK-REALTIME-01 probe (V2-5, D-028), run by scripts/test-realtime.ps1 from the repo root:
//   node realtime-probe.cjs <gatewayUrl> <inputJsonFile>
// Input: { tokenA, tokenB, userA, userB, conversationId, postId }. Post owner = B. Prints one JSON line with results.
const fs = require('fs');
const signalR = require('@microsoft/signalr');

const [gateway, inputFile] = process.argv.slice(2);
const input = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
const results = {};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const connect = (token) => new signalR.HubConnectionBuilder()
  .withUrl(`${gateway}/hubs/realtime`, { accessTokenFactory: () => token, skipNegotiation: true, transport: signalR.HttpTransportType.WebSockets })
  .configureLogging(signalR.LogLevel.None)
  .build();

/** Resolves with the elapsed ms when `event` arrives matching `match`, or null after `timeoutMs`. */
const waitFor = (connection, event, match, timeoutMs) => new Promise((resolve) => {
  const started = Date.now();
  const handler = (payload) => { if (match(payload)) { connection.off(event, handler); clearTimeout(timer); resolve(Date.now() - started); } };
  const timer = setTimeout(() => { connection.off(event, handler); resolve(null); }, timeoutMs);
  connection.on(event, handler);
});
const collect = (connection, event) => { const seen = []; connection.on(event, (p) => seen.push(p)); return seen; };

const rest = (path, token, body) => fetch(`${gateway}${path}`, {
  method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}),
});

(async () => {
  // 1. No token: the hub refuses.
  try { const anon = connect(''); await anon.start(); results.noTokenRefused = false; await anon.stop(); } catch { results.noTokenRefused = true; }

  const a = connect(input.tokenA);
  const b = connect(input.tokenB);
  await a.start();
  await b.start();
  results.connected = a.state === 'Connected' && b.state === 'Connected';

  // 2. A sends a message: B hears message.created quickly (the REST write is synchronous, so under a second).
  const typingSeenByA = collect(a, 'typing');
  const created = waitFor(b, 'message.created', (p) => p.conversationId === input.conversationId, 3000);
  const sent = await rest(`/api/chat/conversations/${input.conversationId}/messages`, input.tokenA, { text: 'Realtime merhaba' });
  results.messageSent = sent.ok;
  results.messageMs = await created;

  // 3. Typing reaches only the other person.
  const typing = waitFor(b, 'typing', (p) => p.conversationId === input.conversationId && p.userId === input.userA, 3000);
  await rest(`/api/chat/conversations/${input.conversationId}/typing`, input.tokenA);
  results.typingMs = await typing;
  results.typingEchoedToSender = typingSeenByA.length > 0;

  // 4. Read receipt reaches the sender.
  const read = waitFor(a, 'message.read', (p) => p.conversationId === input.conversationId && p.userId === input.userB, 3000);
  await rest(`/api/chat/conversations/${input.conversationId}/read`, input.tokenB);
  results.readMs = await read;

  // 5. Rooms: a real signal can be joined, an unknown one quietly cannot.
  results.joinOwnPost = await b.invoke('JoinPost', input.postId);
  results.joinUnknownPost = await b.invoke('JoinPost', '11111111-2222-3333-4444-555555555555');
  results.joinGarbage = await b.invoke('JoinPost', 'not-a-guid');

  // 6. A comments on B's signal: B's room hears comment.added (through RabbitMQ) and B gets notification.created.
  const commentAdded = waitFor(b, 'comment.added', (p) => p.postId === input.postId && p.commentId, 10000);
  const notified = waitFor(b, 'notification.created', (p) => p.id && p.type === 'CommentCreated', 10000);
  const reacted = waitFor(b, 'reaction.changed', (p) => p.postId === input.postId, 10000);
  await rest(`/api/posts/${input.postId}/comments`, input.tokenA, { commentText: 'Canli yorum' });
  await rest(`/api/posts/${input.postId}/reactions`, input.tokenA, { reaction: '🔥' });
  results.commentMs = await commentAdded;
  results.notificationMs = await notified;
  results.reactionMs = await reacted;

  // 7. After LeavePost the room is quiet.
  await b.invoke('LeavePost', input.postId);
  const afterLeave = waitFor(b, 'comment.added', () => true, 4000);
  await rest(`/api/posts/${input.postId}/comments`, input.tokenA, { commentText: 'Ayrildiktan sonra' });
  results.heardAfterLeave = (await afterLeave) !== null;

  // 8. S3: at most 60 join attempts a minute per connection (each costs a call to BlogService), then even a real one waits.
  const unknown = (i) => '00000000-0000-4000-8000-' + String(i).padStart(12, '0');
  for (let i = 0; i < 58; i++) await b.invoke('JoinPost', unknown(i));
  results.joinAfterBurst = await b.invoke('JoinPost', input.postId);

  await a.stop();
  await b.stop();
  console.log(JSON.stringify(results));
  process.exit(0);
})().catch((err) => { console.log(JSON.stringify({ ...results, error: String(err && err.message ? err.message : err) })); process.exit(1); });
