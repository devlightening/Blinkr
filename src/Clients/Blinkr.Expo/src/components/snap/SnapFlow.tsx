import { useCallback, useEffect, useRef, useState } from 'react';

import { sendSnap, startConversation } from '../../api';
import { friendlyError } from '../../productPresentation';
import { summarizeSend } from '../../snapPresentation';
import type { AuthResponse, UserSummary } from '../../types';
import { UserSearchSheet } from '../chat/UserSearchSheet';
import { Sheet } from '../Sheet';
import { SignalCamera } from '../camera/SignalCamera';
import type { CapturedMedia } from '../camera/PhotoEditor';
import { BlinkrSheetPanel } from '../ui/BlinkrSheetPanel';
import { SnapSendStep, type SnapRecipient } from './SnapSendStep';

export type SnapFlowRequest = { mode: 'reply'; conversationId: string } | { mode: 'compose' };

type Props = {
  auth: AuthResponse;
  request: SnapFlowRequest;
  /** Everyone with a conversation, most recent first. */
  recipients: SnapRecipient[];
  onClose: () => void;
  /** All snaps were delivered to the server; `count` is the number of people. */
  onSent: (count: number) => void;
  onAuthChange: (auth: AuthResponse) => void;
  onSessionExpired: () => void;
};

/**
 * Camera -> caption/timer/recipients -> send. Photos pass through the camera's editor first (lens and stickers are
 * baked in there); a snap goes to every chosen person one by one, and whoever fails stays selected for a retry.
 */
export function SnapFlow({ auth, request, recipients, onClose, onSent, onAuthChange, onSessionExpired }: Props) {
  const [asset, setAsset] = useState<CapturedMedia | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extra, setExtra] = useState<SnapRecipient[]>([]);
  const [selected, setSelected] = useState<string[]>(request.mode === 'reply' ? [request.conversationId] : []);
  const [searching, setSearching] = useState(false);
  const mounted = useRef(true);
  const sendingRef = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const all = [...extra.filter((item) => !recipients.some((known) => known.id === item.id)), ...recipients];
  const fixed = request.mode === 'reply' ? all.find((item) => item.id === request.conversationId) ?? null : null;

  const send = useCallback(async (conversationIds: string[], options: { durationSeconds: number; caption: string }) => {
    if (!asset || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    setError(null);
    const results: Array<{ conversationId: string; ok: boolean }> = [];
    for (const conversationId of conversationIds) {
      try {
        await sendSnap(auth, conversationId, asset, { durationSeconds: options.durationSeconds, caption: options.caption || undefined }, onAuthChange, onSessionExpired);
        results.push({ conversationId, ok: true });
      } catch (err) {
        console.log('[Blinkr Snap]', { failedStage: 'send', errorCode: err instanceof Error ? err.name : 'Unknown' });
        results.push({ conversationId, ok: false });
        if (conversationIds.length === 1) setError(friendlyError(err, 'Snap gönderilemedi. Tekrar dene.'));
      }
    }
    sendingRef.current = false;
    if (!mounted.current) return;
    setSending(false);
    const summary = summarizeSend(results);
    if (summary.allSent) { onSent(summary.sent); return; }
    // Keep only the people it did not reach selected, so "Gönder" simply retries them.
    setSelected(summary.failed);
    if (conversationIds.length > 1) setError(`${summary.failed.length} kişiye gönderilemedi. Tekrar dene.`);
  }, [asset, auth, onAuthChange, onSent, onSessionExpired]);

  const addPerson = async (user: UserSummary) => {
    setSearching(false);
    try {
      const conversation = await startConversation(auth, user.id, onAuthChange, onSessionExpired);
      const recipient: SnapRecipient = { id: conversation.id, name: user.userName, userId: user.id, avatarKey: user.avatarKey };
      setExtra((current) => [recipient, ...current.filter((item) => item.id !== recipient.id)]);
      setSelected((current) => [...new Set([...current, recipient.id])]);
    } catch (err) {
      setError(friendlyError(err, 'Kişi eklenemedi. Tekrar dene.'));
    }
  };

  if (!asset) return <SignalCamera onCapture={setAsset} onClose={onClose} submitLabel="İleri" />;

  return (
    <>
      <SnapSendStep
        asset={asset}
        error={error}
        fixedRecipient={fixed}
        onSelectedChange={setSelected}
        selected={selected}
        onAddPerson={request.mode === 'compose' ? () => setSearching(true) : undefined}
        onBack={() => { setAsset(null); setError(null); }}
        onSend={(ids, options) => { void send(ids, options); }}
        recipients={all}
        sending={sending}
      />
      {searching ? (
        <Sheet onClose={() => setSearching(false)}>
          <BlinkrSheetPanel maxHeightRatio={0.88}>
            <UserSearchSheet auth={auth} onBack={() => setSearching(false)} onSelect={(user) => { void addPerson(user); }} />
          </BlinkrSheetPanel>
        </Sheet>
      ) : null}
    </>
  );
}
