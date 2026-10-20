import { useEffect, useState } from "react";

import {
  createBoard,
  fetchBoard,
  joinBoard,
  leaveBoard,
  pushScore,
  updateBoardProfile,
  type BoardRow,
} from "~/lib/community/leaderboard";
import { useUsageAnalyticsStore } from "~/lib/usageAnalytics/usageAnalyticsStore";
import { STUCK_ENABLED } from "../community/stuckStore";
import { useWeeklyStats } from "../community/useWeeklyStats";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Switch } from "../ui/switch";
import { SettingsRow } from "./settingsLayout";

/** Friends leaderboard. Off until the user agrees here; anonymous until the user shows a nickname. */
export function LeaderboardSettings() {
  const consent = useUsageAnalyticsStore((state) => state.leaderboardConsent);
  const boards = useUsageAnalyticsStore((state) => state.boards);
  const nickname = useUsageAnalyticsStore((state) => state.boardNickname);
  const isPublic = useUsageAnalyticsStore((state) => state.boardPublic);
  const setConsent = useUsageAnalyticsStore((state) => state.setLeaderboardConsent);
  const setProfile = useUsageAnalyticsStore((state) => state.setBoardProfile);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  if (!STUCK_ENABLED) return null;

  const stopSharing = async () => {
    // Leave first: the Worker deletes this install's scores, and a request needs the consent.
    await Promise.all(boards.map((board) => leaveBoard(board)));
    setConsent("declined");
  };
  const makeBoard = async () => {
    const made = await createBoard();
    setMessage(
      made ? `Your invite code is ${made}. Share it with a friend.` : "Could not make a board.",
    );
  };
  const join = async () => {
    const joined = await joinBoard(code);
    setMessage(joined ? "Joined." : "That code did not work.");
    if (joined) setCode("");
  };

  return (
    <div className="grid gap-2">
      <SettingsRow
        title="Friends leaderboard"
        description="Compare this week with friends you invite. We share only counts: words dictated, messages sent and active days. We use a random ID made for this, and never your messages."
        control={
          <Switch
            aria-label="Friends leaderboard"
            checked={consent === "granted"}
            onCheckedChange={(checked) => (checked ? setConsent("granted") : void stopSharing())}
          />
        }
      />
      {consent === "granted" ? (
        <>
          <SettingsRow
            title="Show my nickname"
            description="Off keeps you anonymous: friends see Friend 1, Friend 2 and so on."
            control={
              <div className="flex items-center gap-2">
                <Input
                  aria-label="Nickname"
                  className="w-36"
                  maxLength={20}
                  value={nickname}
                  onChange={(event) => setProfile(event.target.value, isPublic)}
                  onBlur={() => void updateBoardProfile(nickname, isPublic)}
                />
                <Switch
                  aria-label="Show my nickname"
                  checked={isPublic}
                  onCheckedChange={(checked) => void updateBoardProfile(nickname, checked)}
                />
              </div>
            }
          />
          <SettingsRow
            title="Invite code"
            description={
              message || "Make a board and share its code, or join with a friend's code."
            }
            control={
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => void makeBoard()}>
                  Make a board
                </Button>
                <Input
                  aria-label="Invite code"
                  className="w-28"
                  maxLength={8}
                  value={code}
                  onChange={(event) => setCode(event.target.value.toUpperCase())}
                />
                <Button size="sm" disabled={code.length !== 8} onClick={() => void join()}>
                  Join
                </Button>
              </div>
            }
          />
          {boards.map((board) => (
            <BoardTable key={board} code={board} />
          ))}
        </>
      ) : null}
    </div>
  );
}

function BoardTable({ code }: { code: string }) {
  const stats = useWeeklyStats();
  const [rows, setRows] = useState<BoardRow[] | null>(null);
  useEffect(() => {
    let active = true;
    void pushScore(code, stats, Date.now())
      .then(() => fetchBoard(code, Date.now()))
      .then((next) => active && setRows(next));
    return () => {
      active = false;
    };
  }, [code, stats]);
  const showTokens = rows?.some((row) => row.tokens !== null) ?? false;
  return (
    <SettingsRow
      title={`Board ${code}`}
      description={rows === null ? "Loading..." : "This week, best first."}
      control={
        <Button size="sm" variant="outline" onClick={() => void leaveBoard(code)}>
          Leave
        </Button>
      }
    >
      {rows && rows.length > 0 ? (
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th>Friend</th>
              <th>Points</th>
              <th>Words</th>
              <th>Messages</th>
              <th>Days</th>
              {showTokens ? <th>Tokens</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.name} className={row.isMe ? "font-medium" : undefined}>
                <td>{row.isMe ? `${row.name} (you)` : row.name}</td>
                <td>{row.points}</td>
                <td>{row.words}</td>
                <td>{row.messages}</td>
                <td>{row.activeDays}</td>
                {showTokens ? <td>{row.tokens ?? "-"}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </SettingsRow>
  );
}
