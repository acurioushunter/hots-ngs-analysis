# Authored judgment table for build_hero_matrix_draft.py. See hero_matrix_README.md for field meanings.
# h(name, sub_role, dmg, range, ratings, comps, strength, weakness, extra)
# ratings order: camp wave teamfight engage peel sustain mobility ease objective siege
# comps: D dive, P poke, K pick, S sustain/attrition, 4 four man push/split, B deathball, W wave clear siege
# extra: "disengage global merc spike buildDep mana solo risk floor ceiling ult healerDep | vulnerable | objective note"
#   spike E early, M mid (levels 10 to 13), L late (20), F flat; risk S safe, M medium, H high
#   ult T teamfight, P pick, U utility or defense, G push or global, D duel or dive
H = {}


def h(n, *a):
    assert len(a) == 8, n
    H[n] = a


# ---------------- Tanks
h("Anub'arak", "initiator tank", "sustain", "melee", "2 3 4 5 2 3 3 4 2 2", "DK",
  "Burrow Charge into Cocoon or Impale gives a reliable engage and a strong pick.",
  "Low damage and thin sustain mean he needs allies ready to follow his initiation.",
  "2 1 2 E 2 2 2 M 3 3 T 3|silence,slow,kiting|Burrow scouts and rotates but he soaks poorly")
h("Arthas", "sustain tank", "sustain", "melee", "4 4 4 2 2 5 2 4 3 3", "S4",
  "Frozen Tempest and Death Coil give heavy self sustain, wave clear and lane control.",
  "Little engage and he is easy to kite or root down.",
  "2 1 3 M 3 4 3 M 3 3 T 2|kiting,root,antiheal,silence|Strong solo laner who pushes towers well")
h("Blaze", "offlane flamethrower", "sustain", "short", "3 4 3 2 3 2 2 3 2 3", "4W",
  "Flame Stream, Oil Spill and Bunker Drop give strong lane pressure from the offlane.",
  "Very short range and low sustain make him easy to kite and burst.",
  "2 1 3 E 3 3 4 M 3 3 T 3|burst,kiting,dive|Pushes a lane to force rotations")
h("Diablo", "initiator tank", "burst", "melee", "2 3 4 5 2 3 3 3 2 2", "DK",
  "Shadow Charge, Overpower and Apocalypse give strong single target and team engages.",
  "Little peel and his engage tools are predictable single targets.",
  "3 1 2 E 3 3 2 M 3 4 T 3|silence,kiting,blind,root|Fine soak but not a siege tank")
h("E.T.C.", "initiator tank", "mixed", "melee", "2 3 4 4 3 3 3 4 2 2", "DB",
  "Mosh Pit and Powerslide give a wide engage, Stage Dive adds global reach.",
  "Must stay in melee range and has weak sustain without allies.",
  "3 3 2 E 3 3 2 S 4 4 T 3|blind,displacement,silence|Stage Dive joins far fights")
h("Garrosh", "dive tank", "burst", "melee", "2 2 4 4 3 3 3 4 2 1", "DK",
  "Wrecking Ball and Decimate dive the backline and Armor Up makes him durable.",
  "No wave clear and no mobility outside his combo.",
  "3 1 2 E 2 2 2 M 3 3 P 3|silence,kiting,slow,root|Poor at objectives")
h("Johanna", "frontline tank", "mixed", "melee", "2 3 5 4 4 4 2 3 2 2", "BS",
  "Blessed Shield, Falling Sword and Iron Skin give great frontline value in brawls.",
  "Slow, large and weak to ranged poke.",
  "3 1 2 F 2 3 2 S 3 3 T 3|poke,kiting,silence|Average soaker")
h("Mei", "poke tank", "sustain", "short", "3 3 3 3 3 2 3 3 2 3", "PK",
  "Ice Wall, Icing and Blizzard give strong zoning, lane control and poke for a tank.",
  "Fragile for a tank and dependent on her Ice Wall combos.",
  "3 1 3 E 3 3 3 M 3 4 T 3|burst,kiting,dive|Ice Wall zones objectives well")
h("Muradin", "initiator tank", "mixed", "melee", "2 2 4 4 3 3 3 5 2 1", "DB",
  "Storm Bolt and Dwarf Toss are easy to use and Avatar makes him hard to kill.",
  "Weak wave clear and falls off if his stuns miss.",
  "3 1 2 E 2 2 2 S 5 3 T 3|kiting,silence,antiheal|Fine soak but no siege")
h("Stitches", "hook tank", "sustain", "melee", "3 3 3 3 2 4 2 4 3 2", "KS",
  "Hook is a game changing pick and Devour heals him through damage.",
  "Hook is one skillshot and he cannot catch mobile heroes.",
  "2 2 3 E 3 3 3 M 3 4 P 2|kiting,blind,burst|Hook can steal or interrupt objectives")
h("Tyrael", "support tank", "mixed", "melee", "3 3 4 3 4 3 4 3 2 2", "BS",
  "Sanctification and Judgment protect allies and El'druin's Might gives global reach.",
  "Does not start fights alone and loses value away from allies.",
  "3 4 2 F 3 4 2 M 3 4 U 3|silence,antiheal,kiting|El'druin's Might lets him join far fights")
h("Mal'Ganis", "sustain tank", "sustain", "melee", "3 3 3 3 2 5 3 2 2 2", "SK",
  "Vampiric Touch gives strong sustain and Night Rush catches squishies.",
  "Many abilities and both heroics are easy to interrupt and roots stop him.",
  "3 1 3 M 2 3 3 M 2 4 D 2|root,stun,kiting,antiheal|Average objective hero")
h("Cho", "initiator tank", "mixed", "melee", "2 3 4 4 3 3 2 2 2 2", "DB",
  "Upheaval, Surging Fist and Hammer of Twilight set up and win close fights.",
  "Two player hero that suffers when the pair is not coordinated.",
  "3 1 2 E 3 3 2 H 2 5 T 3|silence,kiting,blind|Cho and Gall together soak objectives well")
h("Gall", "ranged cleaver", "burst", "medium", "3 4 3 1 1 2 2 2 3 3", "PW",
  "Shadowflame and Dread Orb add strong ranged burst and wave clear to Cho.",
  "Weak without a competent Cho and has no mobility.",
  "2 1 2 M 3 3 2 H 2 5 T 3|dive,silence,blind|Good siege damage")
h("Chen", "brewmaster", "mixed", "short", "4 3 3 3 3 3 3 2 3 2", "S4",
  "Flying Kick, Breath of Fire and Storm, Earth, Fire give flexible utility and solid camp clear.",
  "Hard to learn and vulnerable to heavy burst.",
  "3 1 4 L 3 4 3 M 1 5 U 2|silence,burst,stun|Fine at camps and boss capture")

# ---------------- Bruisers
h("Artanis", "dive bruiser", "mixed", "melee", "3 3 3 3 1 3 4 3 2 2", "DK",
  "Blade Dash and Phase Prism let him dive and Shield Overload keeps him alive.",
  "Melee and weak to CC and kiting.",
  "2 1 2 M 3 3 3 M 3 4 T 3|stun,silence,kiting,root|Pushes towers acceptably")
h("Deathwing", "siege bruiser", "burst", "melee", "3 4 3 2 1 3 3 2 4 4", "W4",
  "Cataclysm, Molten Flame and CC immunity make him a strong sieger and global presence.",
  "Cannot be healed or shielded and has slow casting animations.",
  "2 4 2 L 3 3 3 H 2 4 T 1|kiting,mobile heroes,antiheal|Dragonflight gives global rotations and siege")
h("Dehaka", "jungle bruiser", "mixed", "melee", "5 2 3 3 1 4 4 3 3 1", "DS",
  "Drag, Burrow and Essence Collection make him strong at stealing camps and soloing.",
  "Weak wave clear and offers little peel.",
  "3 3 5 E 3 3 4 M 3 4 D 2|silence,kiting,burst|Excellent camp control")
h("Hogger", "terrain bruiser", "mixed", "melee", "4 4 3 4 2 2 3 2 3 2", "K4",
  "Staggering Blow and Loot Hoard use terrain for strong CC and Hogg Wild clears waves.",
  "Weak to poke and mobile heroes and best in narrow lanes.",
  "2 1 4 M 3 2 3 H 2 4 T 2|poke,kiting,percent damage|Great at camp and boss capture")
h("Imperius", "sustain bruiser", "sustain", "melee", "3 3 4 2 2 4 3 3 2 2", "SB",
  "Valorous Brand and Molten Armor give strong sustain and brawling.",
  "Limited engage and mobility.",
  "2 1 3 M 3 3 3 M 3 3 T 2|kiting,silence,slow|Average on objectives")
h("Leoric", "duelist bruiser", "sustain", "melee", "4 3 4 3 2 5 2 3 3 2", "SK",
  "Drain Hope and Skeletal Swing give great sustain and strong damage against heroes.",
  "Poor mobility and easy to kite.",
  "2 1 3 E 3 3 4 M 3 3 D 2|kiting,root,antiheal,silence|Strong solo lane")
h("Ragnaros", "siege bruiser", "burst", "melee", "3 5 3 2 1 2 1 3 5 5", "W4",
  "Empower Sulfuras, Living Meteor and Lava Wave make him one of the best sieging heroes.",
  "No mobility and weak when caught by dive.",
  "2 1 3 L 3 2 3 M 3 4 T 1|dive,stun,kiting|Burns structures and bosses fast")
h("Rexxar", "beast master", "sustain", "melee", "5 3 3 2 2 3 3 3 2 2", "4K",
  "Misha is a strong frontline and Rexxar clears camps with ease.",
  "Weak to poke and needs to manage two bodies.",
  "2 1 5 M 3 2 4 M 3 4 P 2|poke,kiting,silence|Top tier camp control")
h("Sonya", "wrath bruiser", "sustain", "melee", "3 3 4 3 2 4 4 3 2 1", "DS",
  "Leap, Whirlwind and Seismic Slam give a strong brawl with sustain.",
  "Weak against kiting and sustained CC.",
  "2 1 3 M 2 2 3 M 3 3 T 2|kiting,stun,silence|Mediocre objective hero")
h("Thrall", "chain lightning bruiser", "sustain", "medium", "4 4 3 2 2 3 3 4 3 3", "S4",
  "Chain Lightning, Feral Spirit and Windfury give lane pressure and camp clear.",
  "Lacks burst early and has to be near targets.",
  "2 1 4 M 3 3 3 S 4 4 T 2|dive,silence,stun|Fine on camps")
h("Varian", "versatile bruiser", "mixed", "melee", "3 3 3 4 2 3 4 3 2 1", "DK",
  "Charge, Taunt and Colossus Smash let him flex between dive and frontline.",
  "Does not excel at any one thing and has poor wave clear.",
  "3 1 2 F 3 3 3 M 3 4 T 3|kiting,silence,stun|Not good at objectives")
h("Yrel", "sustain bruiser", "sustain", "melee", "3 3 4 3 3 4 4 4 2 2", "SD",
  "Righteous Hammer and Ardent Defender give sustain and Vindication supports allies.",
  "Falls off against sustained CC.",
  "3 3 2 F 2 2 3 S 4 3 U 2|stun,root,silence|Mediocre on maps")
h("Gazlowe", "siege bruiser", "sustain", "short", "4 5 3 2 1 3 2 3 4 5", "W4",
  "Deth Lazor and Xplodium Charge give elite wave and structure damage.",
  "Fragile and offers little team fight impact.",
  "3 1 4 L 3 3 4 M 3 4 T 2|dive,silence,burst|Elite siege and objectives")
h("D.Va", "mech bruiser", "mixed", "short", "3 3 3 3 2 4 5 3 3 2", "DK",
  "Boosters and Defense Matrix give mobility and a huge effective health pool in the mech.",
  "Must rebuild the mech after losing it and is punished when caught out.",
  "2 2 2 M 3 3 3 M 3 4 T 3|stun,silence,kiting|Decent soak but poor sieger")
h("Xul", "necromancer", "sustain", "melee", "4 4 3 2 1 3 2 3 3 3", "SK",
  "Raise Skeleton, Bone Armor and Cursed Strikes give lane control and sustained damage.",
  "Fragile when skeletons are dead and weak to CC.",
  "2 1 4 M 3 4 3 M 3 3 T 2|kiting,silence,stun|Skeletons help siege")

# ---------------- Melee assassins
h("Alarak", "burst assassin", "burst", "melee", "3 2 3 3 1 2 3 2 2 1", "DK",
  "Discord Strike, Lightning Surge and Deadly Charge give strong single target burst.",
  "Demands precise ability use and has weak waveclear.",
  "2 1 2 M 3 4 2 H 2 4 P 1|stun,silence,kiting|Weak objective hero")
h("Illidan", "dive assassin", "burst", "melee", "3 2 3 2 1 3 5 3 2 2", "D4",
  "Dive and Evasion give top tier mobility and Illidan excels at map pressure.",
  "Easy to kill if mispositioned and needs fights to be decided quickly.",
  "2 4 3 M 3 3 5 H 2 5 D 1|stun,slow,kiting|Excels at split pushing")
h("Kerrigan", "dive assassin", "burst", "melee", "2 3 3 2 1 3 4 3 2 2", "DK",
  "Ravage and Primal Grasp give strong burst and pick potential.",
  "Relies on landing abilities and has limited mobility.",
  "2 1 2 M 3 3 2 M 3 3 P 1|stun,kiting,slow|Weak at siege")
h("Maiev", "pick assassin", "burst", "melee", "3 3 3 3 1 2 5 2 2 2", "KD",
  "Spirit of Vengeance and Warden's Cage let her pick targets and escape.",
  "Dependent on skillshots and fragile.",
  "3 2 2 E 3 4 3 H 1 5 P 1|stun,silence,slow|Weak at objectives")
h("Qhira", "bleed assassin", "sustain", "melee", "2 1 3 3 1 3 5 2 2 1", "DK",
  "Grappling Hook and Revolving Sweep make her a mobile duelist who is hard to catch.",
  "Very poor wave clear and dependent on terrain.",
  "2 2 2 L 3 3 4 H 1 5 D 1|stun,silence,slow|Poor objective hero")
h("Valeera", "stealth assassin", "burst", "melee", "3 2 3 3 1 2 4 2 2 1", "KD",
  "Vanish, Cheap Shot and Garrote provide strong pick and flank potential.",
  "Short burst windows and punished by area damage or detection.",
  "3 2 2 E 3 4 3 H 2 4 P 1|area damage,detection,slow|Stealth lets her disrupt objectives")
h("Zeratul", "stealth assassin", "burst", "melee", "3 2 3 3 1 2 5 2 3 3", "KD",
  "Blink and Permanent Cloak give top mobility and map presence, Void Prison wins picks.",
  "Fragile and punished by detection and misses.",
  "2 4 3 M 3 3 5 H 1 5 U 1|detection,stun,area damage|Excels at stealing objectives")
h("The Butcher", "dive assassin", "burst", "melee", "3 2 3 3 1 3 4 3 2 1", "DK",
  "Ruthless Onslaught and Lamb to the Slaughter give heavy single target dive.",
  "Poor sustain and he is easy to kite.",
  "2 1 2 M 3 3 3 M 3 3 P 1|kiting,stun,antiheal|Bad siege")
h("Samuro", "split pusher", "burst", "melee", "4 4 2 1 1 3 4 1 3 2", "4",
  "Mirror Image, Wind Walk and Illusion Master are great for splitting and escaping.",
  "Extremely hard to master with little team fight impact.",
  "2 4 4 L 3 2 5 H 1 5 U 1|area damage,detection,stun|Excels at lane pressure")
h("Murky", "specialist pest", "burst", "melee", "1 2 1 1 1 3 3 2 3 2", "4K",
  "Spawn Egg and Safety Bubble make him a hard to remove split pusher and pest.",
  "Very weak in fights and relies on baiting.",
  "2 3 1 E 3 2 3 H 2 3 U 1|area damage,stun,dive|Egg gives free structure pressure")
h("Malthael", "reaper", "mixed", "melee", "3 3 4 2 1 3 3 3 2 2", "DK",
  "Wraith Strike, Soul Rip and Death Shroud give pick and team fight value.",
  "Lacks reliable dive and is vulnerable to CC.",
  "2 1 3 M 3 3 3 M 3 3 T 1|stun,kiting,slow|Average objective hero")

# ---------------- Ranged assassins
h("Azmodan", "siege mage", "sustain", "medium", "4 5 2 1 1 2 1 3 5 5", "WP",
  "Globe of Annihilation and Demonic Invasion give elite structure damage and wave clear.",
  "Zero mobility and an easy target.",
  "2 1 4 L 3 3 4 M 3 4 T 1|dive,silence,stun|Top objective hero")
h("Cassia", "javelin marksman", "mixed", "medium", "4 4 3 1 1 2 3 3 3 3", "P4",
  "Lightning Fury, Ball Lightning and Valkyrie give flexible poke and good wave clear.",
  "Low defense and relies on energy and mana.",
  "3 1 3 M 3 3 3 M 3 4 T 1|dive,stun,silence|Fine siege")
h("Chromie", "burst mage", "burst", "long", "2 3 3 2 2 1 3 3 2 3", "PK",
  "Dragon's Breath, Sand Blast and Temporal Loop give strong burst at range.",
  "Fragile and low sustain.",
  "2 1 2 M 3 3 2 M 3 4 P 1|dive,silence,stun|Medium siege")
h("Falstad", "flying marksman", "sustain", "medium", "3 4 3 2 3 2 5 3 3 3", "4D",
  "Flight and Hammerang give global map pressure and fast rotations.",
  "Mana hungry and caught by CC.",
  "2 4 2 M 4 4 4 M 3 4 P 2|stun,silence,slow|Strong at rotating to objectives")
h("Fenix", "marksman", "sustain", "medium", "4 4 3 1 1 3 3 2 3 3", "4P",
  "Weapon Modes, Shield Capacitor and Planet Cracker give strong sustained damage.",
  "Hard to reposition and has no peel.",
  "2 1 3 M 4 3 3 M 2 4 T 1|dive,stun,silence|Fine siege")
h("Genji", "skill assassin", "burst", "medium", "3 3 3 3 1 3 4 1 2 1", "DK",
  "Swift Strike and Deflect make him a high skill duelist.",
  "Very difficult to play and easy to punish.",
  "2 1 2 M 3 3 4 H 1 5 T 1|stun,silence,blind|Weak at objectives")
h("Greymane", "form marksman", "mixed", "medium", "4 3 3 3 1 3 4 3 3 2", "D4",
  "Worgen and Human forms with Darkflight give flexibility and pick potential.",
  "Complicated and punished when forms are mistimed.",
  "2 1 3 M 3 3 3 M 3 4 P 1|stun,silence,kiting|Fine objectives")
h("Gul'dan", "siege warlock", "mixed", "medium", "3 4 3 1 1 3 1 3 4 4", "PW",
  "Life Tap, Fel Flame and Rain of Destruction give siege and burst.",
  "Zero mobility and risk from spending health.",
  "2 1 3 L 3 4 4 M 3 4 T 2|dive,silence,stun|Great at objectives")
h("Hanzo", "sniper marksman", "burst", "long", "2 3 3 2 1 1 1 2 3 3", "PK",
  "Scatter Arrow and Dragon's Arrow give heavy poke at long range.",
  "Slow, fragile and reliant on hitting skillshots.",
  "2 1 2 M 3 3 2 H 2 4 P 1|dive,stun,silence|Fine siege")
h("Jaina", "frost mage", "burst", "long", "3 4 3 3 2 1 1 3 2 3", "PK",
  "Ring of Frost, Blizzard and Frostbolt give burst, CC and wave clear.",
  "No mobility and low sustain.",
  "2 1 3 M 3 4 3 M 3 4 T 1|dive,stun,silence|Average objective")
h("Junkrat", "bomber", "burst", "medium", "3 4 3 1 3 2 4 2 3 4", "PW",
  "Concussion Mine and Steel Trap zone enemies and siege strongly.",
  "Low sustain and relies on trap placement.",
  "3 1 2 M 3 3 3 H 2 4 T 1|dive,stun,silence|Great siege")
h("Kael'thas", "burst mage", "burst", "medium", "2 4 4 1 1 1 2 3 2 3", "PK",
  "Flamestrike and Living Bomb give huge area burst and wave clear.",
  "Fragile and mana hungry.",
  "2 1 2 M 3 5 3 M 3 4 T 1|dive,stun,silence|Average objectives")
h("Kel'Thuzad", "control mage", "burst", "long", "3 4 4 3 2 1 1 2 3 4", "PK",
  "Frost Nova, Shadow Fissure and Chains of Kel'Thuzad give heavy area control.",
  "Immobile and complicated.",
  "2 1 3 L 3 4 3 M 2 5 T 1|dive,stun,silence|Fine siege")
h("Li-Ming", "arcane mage", "burst", "long", "2 4 3 1 1 1 3 3 2 3", "PK",
  "Teleport and Arcane Orb give high burst at range.",
  "Fragile and mana reliant.",
  "2 1 2 M 3 4 3 M 3 4 P 1|dive,stun,silence|Fine siege")
h("Lunara", "kiting marksman", "sustain", "medium", "4 4 2 1 1 2 4 3 3 4", "4P",
  "Kiting with Nature's Toxin and Wisp wins sustained fights and sieges.",
  "Needs to kite constantly and has low burst.",
  "2 1 4 M 3 3 4 M 3 4 T 1|dive,stun,silence|Great siege")
h("Mephisto", "caster marksman", "mixed", "medium", "3 4 4 1 1 2 2 3 3 3", "PB",
  "Lightning Nova and Durance of Hate give strong team fight area damage.",
  "Low mobility and relies on cooldowns.",
  "2 1 3 M 3 3 3 S 3 4 T 1|dive,stun,silence|Fine objectives")
h("Nazeebo", "witch doctor", "sustain", "medium", "4 5 3 1 1 2 1 3 4 4", "W4",
  "Zombie Wall, Corpse Spiders and Gargantuan give excellent wave clear.",
  "Slow and a poor team fighter without setup.",
  "2 1 4 L 4 3 4 S 3 3 T 1|dive,stun,silence|Great objective pusher")
h("Nova", "stealth sniper", "burst", "long", "2 3 2 1 1 1 3 2 3 3", "PK",
  "Snipe and Permanent Cloak give strong pick potential from range.",
  "Highly dependent on landing Snipe and easy to punish.",
  "2 1 2 M 3 3 3 H 1 5 P 1|dive,detection,stun|Fine siege")
h("Orphea", "raven mage", "mixed", "medium", "3 3 3 1 1 2 3 2 3 3", "PK",
  "Shadow Waltz, Chomp and Crushing Jaws provide pick damage with sustain.",
  "Fragile and punished by CC.",
  "2 1 3 M 3 3 3 H 2 4 P 1|dive,stun,silence|Fine siege")
h("Probius", "pylon specialist", "mixed", "medium", "3 4 2 1 2 3 2 2 3 4", "WP",
  "Warp In Pylon, Photon Cannon and Warp Rift create strong siege and defense.",
  "Needs lots of setup and loses to dive.",
  "2 1 3 M 3 3 3 H 2 4 T 1|dive,stun,silence|Strong siege and lane control")
h("Raynor", "commander marksman", "sustain", "medium", "4 4 3 1 2 3 3 4 3 3", "P4",
  "Inspire, Adrenaline Rush and Hyperion give steady auto attack damage and ally buffs.",
  "Low burst and easy to dive.",
  "2 3 3 M 3 2 3 S 4 3 T 1|dive,stun,silence|Fine at camps")
h("Sgt. Hammer", "siege tank", "sustain", "long", "2 4 3 1 1 2 1 3 5 5", "PW",
  "Siege Mode pokes anything at long range and destroys structures.",
  "Immobile and has little protection.",
  "2 1 3 L 3 3 4 S 3 4 P 1|dive,stun,silence|One of the best siege heroes")
h("Sylvanas", "banshee queen", "sustain", "medium", "3 5 3 2 2 2 3 3 4 5", "WP",
  "Black Arrows, Haunting Wave and Mind Control give strong wave clear and siege.",
  "Weak to dive and low burst.",
  "2 1 3 L 3 3 4 M 3 4 U 1|dive,stun,silence|Elite structure pressure")
h("Tassadar", "protoss mage", "sustain", "medium", "3 4 3 1 4 3 2 3 3 3", "PS",
  "Force Wall, Shock Ray and Archon provide poke and peel for allies.",
  "Lower damage early and Archon is a commitment.",
  "2 2 2 M 3 3 3 M 3 4 U 2|dive,stun,silence|Fine objectives")
h("Tracer", "dive assassin", "burst", "short", "2 2 2 2 1 3 5 2 1 1", "DK",
  "Blink and Recall make her very hard to kill.",
  "Low damage and range and demands high skill.",
  "2 1 2 M 3 3 3 H 1 5 D 1|stun,slow,kiting|Poor at objectives")
h("Tychus", "commando marksman", "sustain", "medium", "3 4 3 1 1 3 2 4 3 3", "PB",
  "Minigun and Commandeer Odin give strong sustained damage.",
  "Slow mobility and weak to dive.",
  "2 1 3 L 3 2 3 S 4 3 T 1|dive,stun,silence|Fine siege")
h("Valla", "demon hunter", "mixed", "medium", "4 4 3 1 1 2 4 3 3 3", "P4",
  "Hungering Arrow, Vault and Strafe offer mobility and burst.",
  "Low sustain and reliant on position.",
  "2 1 3 M 3 3 3 M 3 4 T 1|dive,stun,silence|Fine siege")
h("Xal'atath", "void mage", "burst", "long", "3 4 4 1 1 1 3 1 3 4", "PW",
  "Shadow Mark and Dark Heart Ritual bring burst and area damage with Void Step repositioning.",
  "Very fragile and has a steep learning curve.",
  "2 1 3 L 3 3 3 H 1 5 T 1|dive,stun,silence|Fine siege")
h("Zagara", "creep pusher", "sustain", "medium", "4 5 3 1 1 3 3 3 4 5", "W4",
  "Creep Tumors, Hunter Killer and Nydus Network give elite wave clear and map pressure.",
  "Low team fight impact and fragile.",
  "3 4 4 M 3 3 5 M 3 4 G 1|dive,stun,silence|Elite objective hero")
h("Zul'jin", "troll marksman", "sustain", "medium", "3 3 3 1 1 3 2 3 3 3", "P4",
  "Berserker, Twin Cleave and Taz'dingo provide heavy sustained damage.",
  "Low mobility and punished by CC.",
  "2 1 3 M 3 3 3 M 3 4 T 1|dive,stun,silence|Average objectives")

# ---------------- Healers and supports
h("Alexstrasza", "burst healer", "mixed", "medium", "2 3 4 3 3 4 3 3 2 2", "S",
  "Gift of Life, Abundance and Dragonqueen give strong team sustain and burst.",
  "Needs time to build heals and depends on positioning.",
  "3 1 2 M 3 3 2 M 3 4 U 1|burst,dive,silence|Fine at objectives")
h("Ana", "sniper healer", "burst", "long", "1 2 3 1 3 1 1 3 1 2", "PK",
  "Healing Dart, Sleep Dart and Nano Boost give burst healing and pick potential at range.",
  "Very fragile and reliant on cooldowns.",
  "2 2 2 M 3 3 1 M 3 4 T 1|dive,stun,silence|Not good at objectives")
h("Anduin", "utility healer", "sustain", "medium", "1 2 3 4 4 3 4 3 1 1", "DK",
  "Leap of Faith, Lightbomb and Divine Star give a strong pull and heal.",
  "Low damage and fragile.",
  "2 2 1 M 3 3 1 M 3 4 U 1|burst,silence,stun|Not good at objectives")
h("Auriel", "sustain healer", "sustain", "medium", "1 2 4 2 4 5 2 3 1 1", "BS",
  "Crystal Aegis, Ray of Heaven and Resurrect offer excellent sustain.",
  "Low damage and slow to protect herself.",
  "2 1 1 L 3 3 1 S 3 4 T 1|dive,stun,silence|Weak at objectives")
h("Brightwing", "mobile healer", "sustain", "medium", "2 3 3 3 3 3 5 3 2 2", "DS",
  "Phase Shift and Blink Heal make her safe and mobile.",
  "Weak against area damage.",
  "2 4 3 M 3 3 2 S 4 3 U 1|area damage,stun,silence|Great rotating healer")
h("Deckard", "sustain healer", "sustain", "medium", "1 2 4 2 3 5 1 4 1 1", "BS",
  "Healing Potion, Horadric Cube and Lorenado offer steady sustain.",
  "Slow and vulnerable to burst.",
  "2 1 1 L 3 3 1 S 4 3 T 1|dive,stun,silence|Weak at objectives")
h("Kharazim", "monk healer", "sustain", "melee", "2 2 3 3 4 3 4 2 1 1", "DS",
  "Radiant Dash and Iron Fists give mobility, Divine Palm saves allies.",
  "Must stay close and is hard to master.",
  "2 1 2 M 3 3 2 H 2 4 U 1|stun,silence,kiting|Weak at objectives")
h("Li Li", "sustain healer", "sustain", "medium", "1 2 3 1 3 5 3 3 1 1", "S",
  "Healing Brew, Cloud Serpent and Blinding Winds make her sustain steady.",
  "Low impact and fragile.",
  "2 1 1 M 3 3 1 S 3 3 U 1|dive,stun,silence|Weak at objectives")
h("Lúcio", "speed healer", "sustain", "medium", "1 2 3 3 3 3 4 3 1 1", "BD",
  "Amp It Up, Crossfade and Sound Barrier give team speed and area heals.",
  "Lower healing and fragile.",
  "2 1 1 M 3 3 2 S 3 4 T 1|dive,stun,silence|Weak at objectives")
h("Lt. Morales", "sustain healer", "sustain", "medium", "1 2 3 1 3 4 1 4 1 1", "SP",
  "Healing Beam, Safeguard and Medivac Dropship give strong healing from range.",
  "Immobile and weak to dive.",
  "2 3 1 M 3 3 1 S 3 3 U 1|dive,stun,silence|Weak at objectives")
h("Malfurion", "sustain healer", "sustain", "medium", "1 2 4 3 3 5 2 3 1 1", "SK",
  "Regrowth, Entangling Roots and Tranquility give lots of healing and CC.",
  "Hard to protect against dive.",
  "2 1 2 M 3 3 1 M 3 4 T 1|dive,stun,silence|Weak at objectives")
h("Rehgar", "bruiser healer", "sustain", "short", "2 3 4 2 3 4 3 4 1 1", "BS",
  "Ghost Wolf, Chain Heal and Lightning Shield offer heavy sustain with melee presence.",
  "Moderate damage and less healing than pure healers.",
  "2 1 2 M 3 3 2 S 4 3 T 1|burst,silence,stun|Weak at objectives")
h("Stukov", "healer", "mixed", "medium", "2 3 3 3 3 3 2 3 2 2", "PS",
  "Healing Pathogen, Weighted Pustule and Massive Shove provide poke and heal.",
  "Mana heavy and fragile.",
  "2 1 2 M 3 4 2 M 3 4 T 2|dive,stun,silence|Fine siege")
h("Tyrande", "ranged healer", "mixed", "medium", "3 3 3 3 3 3 3 3 3 3", "PK",
  "Sentinel, Lunar Flare and Shadowstalk add poke and pick damage while healing.",
  "Less healing than dedicated healers and fragile.",
  "2 2 2 M 3 3 2 M 3 4 U 1|dive,stun,silence|Fine siege")
h("Uther", "sustain healer", "sustain", "melee", "1 2 4 3 4 5 3 3 1 1", "BS",
  "Holy Light, Hammer of Justice and Divine Shield give big heals, a stun and protection.",
  "Limited mobility and vulnerable to dive.",
  "2 3 1 M 3 3 1 S 3 3 U 1|dive,stun,silence|Weak at objectives")
h("Whitemane", "burst healer", "mixed", "medium", "1 2 3 1 3 3 3 3 1 1", "SP",
  "Desperate Plea, Scarlet Aegis and Divine Reckoning give flexible healing at range.",
  "Low defense and reliant on cooldowns.",
  "2 2 1 M 3 3 1 M 3 3 T 1|dive,stun,silence|Weak at objectives")
h("Medivh", "utility support", "mixed", "medium", "2 3 3 3 3 2 3 2 2 2", "KP",
  "Portal, Raven Form and Poly Bomb add pick potential and global presence.",
  "Weak overall and complicated.",
  "2 5 2 M 3 3 2 H 1 4 U 1|dive,stun,silence|Portal can steal objectives")
h("Abathur", "symbiote specialist", "sustain", "long", "5 5 3 1 3 2 1 1 4 4", "W4",
  "Toxic Nest, Symbiote and Deep Tunnel wage a non stop war across the map.",
  "Very low personal impact and hard to learn.",
  "2 4 5 L 3 3 1 H 1 5 U 1|dive,detection,stun|Excellent on camps and structures")
h("The Lost Vikings", "three hero specialist", "sustain", "medium", "5 4 1 1 1 2 3 1 4 3", "4",
  "Three bodies, Longboat Raid and Viking Hoard create map control.",
  "Must be micromanaged and has low team fight power.",
  "2 5 5 F 3 2 5 H 1 5 U 1|area damage,stun,burst|Excels at camps and objectives")
h("Zarya", "shield support", "mixed", "short", "3 2 4 2 4 4 2 3 2 2", "BS",
  "Personal Barrier, Shield Ally and Graviton Surge give strong team protection.",
  "Poor wave clear and weak against kiting.",
  "2 1 2 M 3 3 2 M 3 4 T 2|kiting,sustain damage,displacement|Average objectives")
