# AUI Volleyball Stats

A separate, stats-only Expo app for recording volleyball match statistics with **buttons only**. It produces an NCAA-style box score in the same layout as the paper "Volleyball Stats" sheet.

Everything is stored **locally on the device** (AsyncStorage). It needs no account and no internet, and it is independent of the main AUI Athletics app and its Supabase backend.

## How it works

1. **Roster**: preloaded with the AUI Women's Volleyball roster. Add, edit or remove players with number and position.
2. **New match**: set the opponent, date, location, best of 3 or 5, first serve, and which players are dressed.
3. **Live stats**: tap a **player**, then tap a **stat**. The scoreboard, serving team and set score update automatically.
   - Serve: In play · Ace · Error
   - Attack: Attempt · Kill · Error
   - Set: Assist · Ball-handling error
   - Block: Solo · Assist · Error (a 2- or 3-player block assist counts as one point)
   - Serve receive: 3 · 2 · 1 · 0/Error (pass rating scale)
   - Defense: Dig · Dig error
   - No-player rally endings: Opponent error · Opponent point · Our fault
   - Undo, remove any play from the play-by-play, and end the set (the app highlights it when the set reaches 25, or 15 in the deciding set, with a 2-point lead)
4. **Report**: box score (whole match or per set), set-by-set table, side-out % and point-scoring %, pass rating, longest run, leaders and full play-by-play. **Print / PDF** exports a landscape sheet, and **CSV** exports the data for spreadsheets.

### Stat formulas (NCAA)

| Stat | Formula |
|---|---|
| Hitting % (Pct) | (Kills − Attack errors) / Total attempts |
| Total blocks | Block solos + ½ Block assists |
| Points (PTS) | Kills + Aces + Block solos + ½ Block assists |
| Pass rating | (3·R3 + 2·R2 + 1·R1) / reception attempts |
| Serve In% | (Serve attempts − Service errors) / Serve attempts |
| Side-out % | Rallies won when the opponent served / those rallies |
| Point-scoring % | Rallies won on our serve / our serve rallies |

## Run locally

```bash
cd stats-app
npm install
npx expo start      # press w for web, or scan the QR code with Expo Go
npm run typecheck
npm run lint
npm run build:web   # static web build in dist/
```

The app uses only modules bundled in Expo Go (expo-print, expo-sharing, expo-haptics, AsyncStorage), so no development build is needed.
