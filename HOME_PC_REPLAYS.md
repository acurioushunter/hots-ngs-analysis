# Your replays from the home PC

Every game you play is saved on the PC you play on as a replay file. Reading those gives what Heroes Profile does not have for Storm League: when and where you died, who killed you, whether anyone else died near it, and which talents you took and how they did. Scrims and NGS games are in there too.

The reader is built and tested on your NGS games from the league export. Tonight only needs the replays turned into a Stats of the Storm database.

## Part 1: Stats of the Storm (you, about 10 minutes plus import time)

1. Download the Windows installer from the Stats of the Storm releases page on GitHub: github.com/ebshimizu/stats-of-the-storm/releases (newest is 2.6.58). Windows may warn that the app is not signed. It is a free open source app many players use; installing it is your call.
2. Before importing, open its Settings and look for where it keeps its database. If it lets you choose, pick a folder that is easy to find, like `Documents\HotS Stats DB`. Write the path down.
3. Test one game first. Your replays are in `Documents\Heroes of the Storm\Accounts\(a number)\(your region and id)\Replays\Multiplayer`. Make a new folder, copy your newest replay into it, point the import at that folder and import.
   * If the game shows up with your hero and stats, the current patch reads fine. Go on.
   * If it says the build is unsupported or not verified, or imports nothing, stop and tell Claude. The fallback is a different decoder.
4. Import the whole `Multiplayer` folder. A year of games can take a while.
5. If there is a setting about custom games, keep them in: those are your scrims and NGS games.

## Part 2: Your review (Claude)

Easiest is Claude on the home PC: open the Claude desktop app there, Code tab, on this project (if the project is not on that PC yet, ask Claude to clone `acurioushunter/hots-ngs-analysis`; GitHub will ask you to sign in once). Then say: "Read HOME_PC_REPLAYS.md and do Part 2." Claude runs:

```
python -I build_my_replays.py "<the Stats of the Storm database folder>"
python -I test_my_replays.py
python -I analyze_my_replays.py --mode "Storm League" --since <one year before today>
```

then commits `knowledge/my_replays.db` and pushes, so the laptop has it after a pull.

No Claude on the home PC: zip the Stats of the Storm database folder and bring it over on a USB stick or a cloud folder you can open on the laptop. Claude runs Part 2 there.

## What comes out

* Storm League games are matched to your Heroes Profile history (same map and hero, start within 40 minutes). That gives each game its Heroes Profile mode and checks the mode the replay reports.
* Every death: the minute, your half of the map or theirs, the heroes on the kill, the level gap at that moment, and the kind of death: alone (nobody else died within 15 seconds), traded, first down, or late (a teammate fell first).
* Talents per hero with their record, named as the game shows them.
* For each of your heroes, the same numbers for every NGS player on that hero (seasons 20 to 22) as a reference.

Most per hero and per map cells will rest on a few games, so they are leans. The replay shows when and where, not why.
