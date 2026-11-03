// NPC generator data tables.
// All entries here are original, generic cyberpunk/fantasy flavour written for this
// system. No text is taken from any published sourcebook and no setting-specific
// proper nouns are used. Pure data plus a tiny pick() helper.

export const FIRST_NAMES: readonly string[] = [
  // English / Western
  'Alice', 'Ben', 'Callum', 'Dana', 'Eliot', 'Fiona', 'Grace', 'Harvey', 'Isla', 'Jack',
  'Kate', 'Liam', 'Molly', 'Nate', 'Owen', 'Paige', 'Quinn', 'Ruth', 'Sam', 'Tess',
  'Vince', 'Wendy', 'Zoe', 'Declan', 'Maggie', 'Rory', 'Shannon', 'Travis', 'Holly', 'Gus',
  // Spanish / Portuguese / Latin American
  'Alejandro', 'Beatriz', 'Carmen', 'Diego', 'Esteban', 'Lucia', 'Mateo', 'Paloma', 'Rafael', 'Ximena',
  'Joao', 'Ines', 'Marisol', 'Tomas', 'Valentina',
  // Japanese
  'Haruto', 'Yui', 'Kenji', 'Akiko', 'Daichi', 'Emi', 'Hiroshi', 'Mei', 'Sora', 'Takumi', 'Rin', 'Yoshiro',
  // Korean
  'Min-jun', 'Seo-yeon', 'Ji-ho', 'Ha-eun', 'Dong-hyun', 'Soo-ah', 'Jae', 'Eun-ji',
  // Chinese
  'Wei', 'Lin', 'Jun', 'Xiu', 'Bo', 'Lan', 'Zhen', 'Ming', 'Yan', 'Feng',
  // Indian / South Asian
  'Arjun', 'Priya', 'Rohan', 'Anika', 'Vikram', 'Meera', 'Sanjay', 'Kavya', 'Dev', 'Nisha', 'Imran', 'Tara',
  // Arabic / Persian / Turkish
  'Omar', 'Layla', 'Karim', 'Yasmin', 'Tariq', 'Noor', 'Samir', 'Dalia', 'Reza', 'Shirin', 'Emre', 'Aylin',
  // Slavic / Eastern European
  'Dmitri', 'Katya', 'Pavel', 'Mila', 'Bogdan', 'Irina', 'Lev', 'Nadia', 'Stanislav', 'Vesna', 'Oksana', 'Yuri',
  // Nordic / Germanic / French / Italian
  'Astrid', 'Bjorn', 'Freya', 'Klaus', 'Greta', 'Lukas', 'Amelie', 'Etienne', 'Margaux', 'Luca', 'Giulia', 'Matteo',
  // African
  'Kwame', 'Amara', 'Chidi', 'Nia', 'Tendai', 'Zola', 'Kofi', 'Ayo', 'Folake', 'Jabari', 'Thandiwe', 'Emeka',
  'Adaeze', 'Sefu', 'Wanjiru',
  // Native American-inspired common / nature names
  'Aiyana', 'Dakota', 'Cheyenne', 'Tahoma', 'Winona', 'Sky', 'River', 'Hawk', 'Sage', 'Talon',
  // Misc / unisex
  'Ash', 'Morgan', 'Jordan', 'Riley', 'Casey', 'Avery', 'Jesse', 'Reese', 'Ezra', 'Malia',
  'Ilya', 'Soren', 'Anouk', 'Kai', 'Noa',
];

export const SURNAMES: readonly string[] = [
  // English / Irish / Scottish
  'Archer', 'Barnes', 'Calloway', 'Dunmore', 'Ellison', 'Fletcher', 'Garrick', 'Hale', 'Irving', 'Jennings',
  'Keane', 'Lowry', 'Mercer', 'Nash', 'Osborne', 'Pryce', 'Quigley', 'Radcliffe', 'Sutton', 'Thorne',
  'Underwood', 'Vance', 'Whitlock', 'Yardley', 'Brennan', 'Doyle', 'Gallagher', 'MacLeod', 'Murray', 'Reid',
  // Spanish / Portuguese
  'Alvarez', 'Castillo', 'Delgado', 'Escobedo', 'Fuentes', 'Guerrero', 'Herrera', 'Ibarra', 'Mendoza', 'Navarro',
  'Ortega', 'Quintero', 'Salazar', 'Vargas', 'Zamora', 'Pereira', 'Silva', 'Moreira',
  // Japanese
  'Aoki', 'Fujimoto', 'Hayashi', 'Ishikawa', 'Kobayashi', 'Matsuda', 'Nakamura', 'Ogawa', 'Sato', 'Takeda',
  'Ueda', 'Watanabe', 'Yamada', 'Kuroda',
  // Korean
  'Kim', 'Park', 'Choi', 'Jung', 'Kang', 'Yoon', 'Han', 'Seo',
  // Chinese
  'Chen', 'Wang', 'Liu', 'Zhang', 'Huang', 'Zhou', 'Xu', 'Tang', 'Guo', 'Lau', 'Chan', 'Ng',
  // Indian / South Asian
  'Sharma', 'Patel', 'Iyer', 'Reddy', 'Banerjee', 'Kapoor', 'Nair', 'Desai', 'Chowdhury', 'Malhotra', 'Siddiqui',
  // Arabic / Persian / Turkish
  'Haddad', 'Nasser', 'Khalil', 'Mansour', 'Farouk', 'Saleh', 'Rahimi', 'Tehrani', 'Yilmaz', 'Demir', 'Aziz',
  // Slavic / Eastern European
  'Ivanov', 'Petrova', 'Sokolov', 'Novak', 'Kowalski', 'Horvat', 'Volkov', 'Popescu', 'Dragan', 'Kuznetsov',
  'Zielinski', 'Marek',
  // Germanic / Nordic / French / Italian / Dutch
  'Brandt', 'Hoffmann', 'Lindqvist', 'Halvorsen', 'Eriksen', 'Dubois', 'Moreau', 'Lefevre', 'Rossi', 'Bianchi',
  'Ferraro', 'Van Dijk', 'De Vries', 'Krause', 'Schreiber',
  // African
  'Okafor', 'Mensah', 'Adeyemi', 'Mwangi', 'Nkosi', 'Diallo', 'Boateng', 'Achebe', 'Kamara', 'Ndlovu',
  'Otieno', 'Abara', 'Traore', 'Owusu',
  // Native American-inspired / descriptive
  'Running Elk', 'Two Rivers', 'Stonecrow', 'Redcloud', 'Blackfeather', 'Swiftwind', 'Greywolf',
  // Misc
  'Kaur', 'Singh', 'Cohen', 'Levin', 'Papadakis', 'Costa', 'Byrne', 'Oyelaran', 'Takahashi', 'Mbeki',
];

export const STREET_NAMES: readonly string[] = [
  'Rook', 'Static', 'Mama Lu', 'Two-Bit', 'Ghost', 'Ratchet', 'Splice', 'Cinder', 'Hex', 'Lockjaw',
  'Patch', 'Vandal', 'Kingfisher', 'Tinker', 'Gravel', 'Juno', 'Fuse', 'Blue Moth', 'Nickel', 'Wire',
  'Snake Eyes', 'Doc Ruin', 'Halo', 'Mongoose', 'Sparrow', 'Brick', 'Echo', 'Vesper', 'Torque', 'Lucky',
  'Buzzsaw', 'Pixel', 'Saint', 'Crow', 'Tally', 'Glitch', 'Mojo', 'Ironside', 'Sister Ash', 'Bones',
  'Cobalt', 'Whisper', 'Grit', 'Pilot', 'Dice', 'Chalk', 'Jackknife', 'Hush', 'Mercury', 'Tank',
  'Pretzel', 'Dusk', 'Ledger', 'Stitch', 'Ozone', 'Bishop', 'Rivet', 'Smokey', 'Banshee', 'Clockwork',
  'Juniper', 'Hammer', 'Lantern', 'Trick', 'Velvet', 'Bulldog', 'Quill', 'Soot', 'Zero', 'Paper Tiger',
  'Moxie', 'Socket', 'Old Fen', 'Kestrel', 'Prism', 'Gunny', 'Marrow', 'Tinsel', 'Scrap', 'Flux',
  'Lady Grey', 'Boomer', 'Riddle', 'Sable', 'Nails', 'Coyote', 'Drift', 'Ink', 'Shiv', 'Gizmo',
  'Thimble', 'Rabbit', 'Ember', 'Mirage', 'Slate', 'Uncle Bo', 'Tumbler', 'Viper', 'Wick', 'Hotwire',
  'Magpie', 'Big Sal', 'Pocket', 'Rust', 'Chrome Jenny', 'Neutron', 'Hollowpoint', 'Brass', 'Lullaby', 'Kickstand',
  'Domino', 'Fable', 'Gearbox', 'Saltlick', 'Jinx', 'Mothball', 'Ticker', 'Nova', 'Wrench', 'Deadbolt',
  'Penny', 'Raptor', 'Sideways', 'Thorn', 'Undertow', 'Vox', 'Wallflower', 'Yoyo', 'Zip', 'Bramble',
  'Cipher', 'Dingo', 'Frostbite', 'Grandma Kim', 'Haywire', 'Icepick', 'Jolt', 'Kettle', 'Lynx', 'Matchstick',
  'Nightjar', 'Overdrive', 'Pigeon', 'Quicksilver', 'Ragdoll', 'Sundog', 'Tripwire', 'Umbra', 'Valve', 'Widget',
  'Hatchet', 'Mister Fix', 'Pinball', 'Shrapnel', 'Tuesday',
];

export const GANG_ADJECTIVES: readonly string[] = [
  'Rust', 'Neon', 'Hollow', 'Iron', 'Black', 'Crimson', 'Broken', 'Silent', 'Burning', 'Chrome',
  'Feral', 'Grim', 'Howling', 'Lucky', 'Midnight', 'Rotten', 'Sacred', 'Smoking', 'Sunken', 'Toxic',
  'Velvet', 'Wild', 'Bone', 'Concrete', 'Dead', 'Electric', 'Flooded', 'Ghost', 'Glass', 'Hungry',
  'Lost', 'Mad', 'Night', 'Pale', 'Razor', 'Scarlet', 'Static', 'Twisted', 'Undying', 'Wired',
  'Ashen', 'Copper', 'Gutter', 'Plastic',
];

export const GANG_NOUNS: readonly string[] = [
  'Jackals', 'Saints', 'Kings', 'Hounds', 'Vipers', 'Crows', 'Wolves', 'Rats', 'Angels', 'Reapers',
  'Lords', 'Sisters', 'Brothers', 'Dogs', 'Devils', 'Ghouls', 'Hornets', 'Jesters', 'Knives', 'Mambas',
  'Monks', 'Mutts', 'Orphans', 'Phantoms', 'Pilgrims', 'Rebels', 'Riders', 'Scorpions', 'Sharks', 'Skulls',
  'Spiders', 'Stray Cats', 'Thieves', 'Tigers', 'Vultures', 'Wardens', 'Witches', 'Wreckers', 'Zealots', 'Roaches',
  'Hyenas', 'Moths', 'Choir', 'Lanterns',
];

export const GANG_THEMES: readonly string[] = [
  'chrome-and-leather bikers who run the overpass',
  'teen go-gangers on stripped racing bikes',
  'squatters turned militia defending a dead tower block',
  'graffiti artists who tag every corp billboard they can reach',
  'street-preacher cult convinced the Matrix is haunted',
  'dock workers moonlighting as smugglers',
  'chip-heads who sell knockoff simsense',
  'old-school bruisers who wear matching tracksuits',
  'tusker pride gang that guards its block fiercely',
  'masked anarchists who burn corp vehicles for fun',
  'kid pickpockets run by a single old woman',
  'ex-military vets who think they are still at war',
  'body-mod fanatics with more chrome than skin',
  'a tagging crew obsessed with occult symbols',
  'drag racers who settle disputes on the flyover',
  'a protection racket dressed in cheap suits',
  'scavengers who strip anything left on the street overnight',
  'nightclub promoters with a violent side business',
  'urban hunters who trap critters in the sewers',
  'a youth gang dressed in hospital scrubs and surgical masks',
  'rooftop runners who never touch the ground',
  'a talisman-hawking crew with a hedge mage leader',
  'boat gang working the flooded lower levels',
  'cyber-punks with glowing mohawks and loud speakers',
  'a hard-line purist gang that hates all chrome',
  'gamblers who run fight pits in a parking garage',
  'gutter deckers who jack anything with a port',
  'a family clan with three generations under one roof',
];

export const GANG_COLOURS: readonly string[] = [
  'oxblood and grey', 'black and acid green', 'chrome and white', 'mustard and brown', 'electric blue',
  'hazard orange', 'deep purple and gold', 'bone white', 'crimson and black', 'olive drab',
  'hot pink and silver', 'rust red', 'teal and copper', 'charcoal with yellow stripes', 'sky blue and white',
  'burgundy leather', 'camo grey', 'neon lime', 'sand and black', 'midnight blue and red',
  'faded denim', 'all black with red laces', 'plaid and patches',
];

export const APPEARANCE: readonly string[] = [
  'tall and wiry with a hawkish nose', 'short and stocky, shaved head', 'heavyset with a friendly round face',
  'lean and pale, dark circles under the eyes', 'broad-shouldered, buzz cut', 'gaunt with sharp cheekbones',
  'athletic build, tight braids', 'soft-spoken giant with huge hands', 'petite with a pixie cut',
  'weathered face, salt-and-pepper beard', 'boyish features, messy curls', 'long silver hair tied back',
  'freckled with a sunburnt nose', 'dreadlocks threaded with wire', 'neon-dyed undercut',
  'slicked-back hair and a thin moustache', 'muscular, with a crooked jaw', 'rail-thin with nervous eyes',
  'elegant posture, perfect teeth', 'pot-bellied and balding', 'scruffy stubble and tired eyes',
  'bright red hair in a messy bun', 'grey-skinned tusker with filed tusks', 'tall elf with angular features',
  'squat dwarf with a braided beard', 'scarred knuckles and thick neck', 'baby-faced but cold-eyed',
  'shock of white hair despite young age', 'shaved sides with a long topknot', 'stooped and wrinkled, but sharp',
  'deep tan and crow\'s feet', 'striking green eyes and dark skin', 'chubby cheeks and dimples',
  'perpetually squinting', 'bony and hunched', 'perfectly symmetrical face, maybe sculpted',
  'heavy brow and a broken nose', 'thin lips, always pursed', 'towering troll with stubby horns',
  'unremarkable in every way', 'shoulder-length hair hiding one eye', 'thick glasses, real lenses',
];

export const CLOTHING: readonly string[] = [
  'battered armoured long coat', 'tailored grey suit with a loosened tie', 'patched hoodie and cargo pants',
  'corp-branded work coveralls', 'leather jacket covered in pins', 'vintage band shirt and ripped jeans',
  'clean white lab coat', 'secondhand military surplus', 'synthleather catsuit', 'expensive silk shirt, open collar',
  'reflective rain poncho', 'mechanic\'s overalls stained with oil', 'puffer jacket two sizes too big',
  'sharp business skirt-suit', 'fishnet sleeves under a vest', 'faded flannel and work boots',
  'flowing robes with sewn-in fetishes', 'security uniform with the logo torn off', 'tracksuit and gold chains',
  'nurse scrubs under a raincoat', 'black turtleneck and mirrored glasses', 'neon-trimmed club wear',
  'cheap suit, shiny at the elbows', 'chef\'s whites', 'fur-lined parka', 'delivery driver uniform',
  'hand-knitted sweater', 'motorcycle leathers', 'kevlar vest over a hawaiian shirt', 'priest\'s collar',
  'utility vest bristling with pockets', 'designer streetwear, all logos', 'thrift-store tweed jacket',
  'hazmat suit, hood down', 'sleeveless shirt to show off cyberarms', 'wool trenchcoat and fedora',
  'jumpsuit with a name tag that is not theirs', 'bathrobe and slippers', 'fingerless gloves and a long scarf',
  'combat fatigues and a beret', 'formal kimono-cut jacket', 'tank top and heavy chains',
];

export const DISTINCTIVE: readonly string[] = [
  'a jagged scar across one cheek', 'chrome cyberarm with exposed pistons', 'mismatched eyes, one obviously synthetic',
  'a datajack behind the ear wrapped in tape', 'full sleeve tattoo of koi', 'gold teeth', 'missing two fingers',
  'glowing tattoo lines under the skin', 'burn scars on both hands', 'a constant electronic hum from their spine',
  'eyes that reflect light like a cat', 'a voice modulator that crackles', 'tribal facial tattoos',
  'pierced everything', 'a prosthetic leg painted with flames', 'one ear torn off', 'retractable claws, visible ridges',
  'a bar code tattooed on the neck', 'skin dyed pale blue', 'chrome plating over the skull',
  'smells strongly of incense', 'a pet rat on the shoulder', 'heavy limp', 'perfect pitch-black eyes',
  'a nervous tic in one eyelid', 'a branded symbol on the wrist', 'hair that changes colour with mood',
  'missing front tooth', 'wears an eyepatch over a working cybereye', 'faint smell of ozone',
  'fingertips replaced with tools', 'scarification patterns on the forearms', 'blind, but navigates perfectly',
  'tusks capped in silver', 'a cough that never goes away', 'too many rings on every finger',
  'a hand-drawn map tattooed on the back', 'speaks through a throat implant', 'unnaturally still when listening',
  'freckles in a strange star pattern', 'a chrome jaw', 'very long, painted fingernails',
];

export const MANNERISM: readonly string[] = [
  'never makes eye contact', 'cracks knuckles constantly', 'laughs at their own jokes', 'speaks in a whisper',
  'quotes old trid shows', 'always eating something', 'taps a rhythm on every surface', 'calls everyone "kid"',
  'answers questions with questions', 'checks their commlink every few seconds', 'over-polite to the point of menace',
  'swears creatively', 'chain-smokes', 'hums tunelessly', 'repeats the last word you said', 'counts things out loud',
  'stands too close', 'refuses to sit with their back to a door', 'haggles over everything', 'fidgets with a coin',
  'speaks in the third person', 'tells long rambling stories', 'never uses names', 'smiles too much',
  'always has an excuse', 'quick to anger, quicker to forgive', 'blunt to the point of rudeness',
  'mixes three languages in each sentence', 'keeps a notebook and writes everything down', 'flinches at loud noises',
  'drops corp jargon into small talk', 'polishes their glasses when nervous', 'rolls dice while they talk',
  'insists on shaking hands', 'sniffs the air before entering a room', 'gives everyone nicknames',
  'speaks only in short sentences', 'constantly adjusting their cuffs', 'prays before every deal',
  'gets distracted by shiny things', 'clicks their tongue when thinking', 'drifts off mid-sentence',
];

export const MOTIVATION: readonly string[] = [
  'pay off a debt to the wrong people', 'get their kid into a good school', 'revenge on a former partner',
  'escape their corp contract', 'buy back the family business', 'find a missing sibling', 'become famous on the trid',
  'protect their neighbourhood', 'fund a cyberware upgrade', 'prove themselves to their gang', 'get out of the city for good',
  'learn real magic', 'clear their name', 'expose a corporate cover-up', 'make one last big score and retire',
  'keep a sick parent alive', 'climb the corporate ladder', 'collect rare old-world artefacts', 'win back an ex',
  'atone for a past job gone wrong', 'stay one step ahead of a bounty', 'build a safe house for street kids',
  'outdo a hated rival', 'pure thrill of the run', 'serve a spirit they made a pact with', 'get a SIN and go legit',
  'keep their addiction fed', 'free a friend from prison', 'discover who they were before a memory wipe',
  'protect a secret lover', 'see the corps burn', 'earn respect from their elders', 'recover a stolen heirloom',
  'map every hidden tunnel in the city', 'buy a boat and sail away', 'restore a dead forest patch',
  'get a promotion before they are replaced', 'keep their dirty past buried', 'start their own crew',
  'just survive another week', 'find the cure for a strange illness', 'repay a life debt',
];

export const SECRET: readonly string[] = [
  'informs for the police', 'is wanted under a different name', 'owes a fortune to loan sharks',
  'is secretly a corp plant', 'has a family they hide from everyone', 'is quietly awakened and hides it',
  'sold out a previous team', 'has a cortex bomb they cannot remove', 'is addicted to BTL chips',
  'is having an affair with their boss\'s partner', 'faked their own death once', 'is terminally ill',
  'stole the money they live on', 'is a former corp security officer', 'has a deal with a free spirit',
  'keeps a stash of evidence against a powerful exec', 'is not human under the disguise', 'killed someone in a bar fight',
  'is being blackmailed', 'runs a second identity online', 'is a fan of the very team they are hunting',
  'is planning to skip town tomorrow', 'has a child with a rival gang leader', 'is an undercover journalist',
  'their cyberware was stolen from a corpse', 'is infected with a slow-acting virus', 'used to be a cultist',
  'is secretly wealthy', 'cannot read', 'is being paid by two sides at once', 'buried a body in the old docks',
  'has a tracker implanted without knowing', 'is a defector the corp wants back', 'funds an anti-corp cell',
  'lies about their military record', 'is terrified of magic', 'is the real owner of a local business',
  'rigged the last election in their union', 'has a twin nobody knows about', 'keeps a pet critter illegally',
  'was cloned from someone else\'s tissue samples, or believes so', 'has a gambling problem',
];

export const CORP_PREFIXES: readonly string[] = [
  'Halvorsen', 'Kestrel', 'Omnivale', 'Brightline', 'Corvane', 'Dalmark', 'Everwell', 'Fenwick', 'Graymoor', 'Helix',
  'Ironbridge', 'Juniper', 'Kaishin', 'Lumen', 'Meridian', 'Northgate', 'Obsidian', 'Paragon', 'Quorra', 'Redstone',
  'Solenne', 'Tenzai', 'Ultramar', 'Vantor', 'Westhollow', 'Xylo', 'Yarrowby', 'Zenith', 'Arcturus', 'Bellweather',
  'Cindral', 'Draxon', 'Emberline', 'Falkreach', 'Glasswing', 'Hoshida', 'Inverno', 'Jarlsberg', 'Kovalent', 'Lanthor',
  'Mirabel', 'Novaterra', 'Orison', 'Pinnacle', 'Silverwake',
];

export const CORP_SUFFIXES: readonly string[] = [
  'Dynamics', 'Biosystems', 'Holdings', 'AG', 'KK', 'Industries', 'Group', 'Logistics', 'Systems', 'Technologies',
  'Pharmaceuticals', 'Security', 'Media', 'Consolidated', 'Labs', 'Partners', 'Heavy Industries', 'GmbH', 'Ltd', 'Inc',
  'Microtronics', 'Agritech', 'Aerospace', 'Combine',
];

export const INDUSTRIES: readonly string[] = [
  'cyberware manufacturing', 'pharmaceuticals', 'private security', 'arcology construction', 'simsense entertainment',
  'agricultural biotech', 'shipping and logistics', 'weapons manufacturing', 'Matrix infrastructure', 'drone design',
  'magical research', 'luxury goods', 'mining and extraction', 'waste reclamation', 'financial services',
  'news media', 'genetic therapy', 'aerospace', 'vehicle manufacturing', 'telecommunications',
  'water purification', 'insurance', 'private prisons', 'fast food franchises', 'talisman and reagent supply',
  'data brokerage', 'emergency medical response',
];

export const ORG_KINDS: readonly string[] = [
  'a smuggling ring', 'a talismonger co-op', 'a neighbourhood protection racket', 'a policlub', 'a hacker collective',
  'an underground clinic network', 'a fixer syndicate', 'a street church', 'an eco-terrorist cell', 'a mercenary company',
  'a fence network', 'a pirate trid station', 'a hermetic study circle', 'a shamanic lodge', 'a union of dock workers',
  'a refugee aid group', 'a black-market organ ring', 'a debt collection outfit', 'an illegal fight league',
  'a ghoul rights advocacy group', 'a vigilante patrol', 'a data haven', 'a crime family',
];

export const ORG_QUIRKS: readonly string[] = [
  'pays well but never on time', 'insists on meeting in person', 'never uses the same commcode twice',
  'everyone is related by blood or marriage', 'leader is never seen in person', 'tests new hires with a fake job',
  'bans all cyberware from meetings', 'keeps meticulous paper records', 'runs a legitimate front business',
  'speaks only through intermediaries', 'superstitious about certain numbers', 'deeply religious',
  'values loyalty above results', 'pays partly in favours', 'recruits only from one neighbourhood',
  'has a mole nobody has found', 'constantly at war with a rival', 'very young membership',
  'members wear a subtle identifying pin', 'insists on contracts in triplicate', 'holds a feast after every success',
  'drug-tests everyone', 'treats their hires as disposable', 'moves headquarters every month',
  'employs an unusually honest accountant', 'has ties to a local politician', 'obsessed with old-world music',
  'spirit-bound oaths for every member', 'rewards failure with a second chance, once', 'keeps a pet critter as a mascot',
  'never works on holy days', 'is falling apart from internal feuds',
];

export const ORG_GOALS: readonly string[] = [
  'control the local drug trade', 'push a rival out of the district', 'expose a corp\'s illegal research',
  'protect a magical site from developers', 'get a councillor elected', 'corner the market on a rare reagent',
  'smuggle refugees across the border', 'steal a prototype', 'unionise a corp factory', 'build a free clinic',
  'take over the docks', 'hack the city traffic grid', 'recover a lost relic', 'bankrupt a small corp',
  'run a pirate broadcast every night', 'avenge a murdered founder', 'establish a safe haven for awakened kids',
  'buy legitimacy and go public', 'find a missing leader', 'break someone out of a corp prison',
  'map the old subway tunnels', 'sabotage an arcology project', 'win a turf war without bloodshed',
  'launder money for a bigger player', 'collect blackmail on every local cop', 'keep the neighbourhood power on',
  'contact a powerful spirit', 'drive a toxic dumping operation out', 'secure a monopoly on fake SINs',
  'simply survive the next crackdown', 'replace a corrupt leader with their own',
];

export const ORG_HQS: readonly string[] = [
  'the back room of a noodle bar', 'an abandoned subway station', 'a converted shipping container yard',
  'the top floor of a condemned hotel', 'a flooded arcology level', 'a church basement', 'a rusting freighter at the old docks',
  'a closed-down shopping mall', 'a parking garage, level minus four', 'a rooftop greenhouse', 'a strip-club office',
  'a laundromat with a hidden door', 'a decommissioned water tower', 'a pawn shop', 'a karaoke bar\'s private booths',
  'a converted fire station', 'a mobile home convoy', 'a server farm in a cold basement', 'an old cinema',
  'a warehouse in the industrial zone', 'a bowling alley', 'a tattoo parlour', 'a high-rise penthouse',
  'a community centre', 'a junkyard full of stripped cars', 'a tunnel under the freeway', 'an all-night diner',
  'a botanical garden gone wild', 'a bus depot', 'a houseboat cluster', 'an abandoned hospital wing',
  'a fortified apartment block',
];

export const JOB_TYPES: readonly string[] = [
  'extraction', 'datasteal', 'wetwork against another team', 'courier run', 'sabotage', 'bodyguard detail',
  'recover a stolen item', 'plant evidence', 'surveillance', 'smuggling run', 'rescue a hostage', 'destroy a lab',
  'escort a convoy', 'track down a missing person', 'insert a defector', 'steal a vehicle', 'retrieve a paydata file',
  'frame a rival', 'clear out a squatter nest', 'hunt a dangerous critter', 'deliver a threatening message',
  'secure a magical artefact', 'break up a deal', 'fake a kidnapping', 'protect a witness', 'erase records from a host',
  'burglary', 'discredit a politician',
];

export const JOB_TARGETS: readonly string[] = [
  'a corp researcher', 'a prototype cyberarm', 'an encrypted datachip', 'a gang leader', 'a mid-level exec',
  'a talisman collection', 'a shipment of weapons', 'a drone prototype', 'a city councillor', 'a rival runner team',
  'a journalist\'s notes', 'a genetic sample', 'a spirit-bound focus', 'a corporate payroll file', 'a witness',
  'a smuggler\'s ledger', 'an AI research core', 'a priceless painting', 'a vat of experimental drugs',
  'a corp mage', 'a security chief', 'a blackmail archive', 'a child of an exec', 'an armoured limousine',
  'a medical patient', 'a ritual sample', 'a satellite uplink key', 'a stolen SIN database', 'a union organiser',
  'a rare critter egg', 'a prototype vehicle', 'a dirty cop',
];

export const JOB_LOCATIONS: readonly string[] = [
  'a corp research campus', 'a luxury hotel', 'a moving train', 'the old docks', 'a flooded arcology level',
  'a hospital', 'an underground club', 'a suburban mansion', 'an airport cargo terminal', 'a high-rise office tower',
  'a toxic waste site', 'a shopping mall', 'a freighter at sea', 'a mountain lodge', 'a public park at night',
  'a stadium during a match', 'a police precinct', 'a prison transport', 'a secluded farm', 'a gang hideout',
  'a casino', 'a corporate enclave', 'a data centre', 'a church', 'a museum gala', 'a highway convoy',
  'a construction site', 'a sewer junction', 'a subway tunnel', 'an orbital uplink station', 'a private island',
  'a sports car dealership',
];

export const JOB_COMPLICATIONS: readonly string[] = [
  'another team is hitting the same target', 'security just got upgraded', 'a storm knocks out communications',
  'the target is not where expected', 'a spirit guards the site', 'a gang war breaks out nearby',
  'the police are already on scene', 'the data is booby-trapped', 'a civilian witnesses everything',
  'the getaway vehicle is stolen', 'a team member is recognised', 'the client changes the terms mid-run',
  'the target fights back with magic', 'a rival corp is watching', 'a power outage hits the block',
  'the item is fake', 'the job is being livestreamed', 'a critter infestation', 'an informant has tipped someone off',
  'the building is on lockdown', 'a hostage situation develops', 'the paydata is heavily encrypted',
  'a security rigger brings drones', 'an old enemy shows up', 'the target is a child', 'the meet is an ambush',
  'a fire breaks out', 'the escape route is blocked', 'a toxic leak in the area', 'the bribed guard got reassigned',
  'a media crew arrives', 'an astral watcher spots the mage', 'the team is short on time',
  'the target begs for help', 'the client is being tailed', 'local residents get involved',
  'a magical ward blocks entry', 'the alarm goes silent instead of loud', 'one contact has been bought off',
  'a corp strike team responds', 'a festival crowds the streets', 'the target has a twin',
];

export const JOB_TWISTS: readonly string[] = [
  'the Johnson is the target', 'the target wants to be taken', 'the client is planning to burn the team',
  'the item is cursed', 'the job is a test for a bigger contract', 'the paydata incriminates the client',
  'the target is the Johnson\'s own child', 'the run is a distraction for something else', 'the police set the whole thing up',
  'the team is being filmed for blackmail', 'the target is a free spirit in disguise', 'two Johnsons hired for the same job',
  'the client is already dead', 'the payment is counterfeit', 'the target is a former team member',
  'the guards are on strike and sympathetic', 'the real prize is in the next room', 'the client works for the target',
  'a dragon-sized interest is behind it all', 'the extractee has a cortex bomb', 'the prototype is alive',
  'the job is entirely legal', 'the item is evidence of a massacre', 'the team\'s fixer sold them out',
  'the location is a front for a cult', 'the target is innocent', 'the data contains an AI fragment',
  'the hostage is the kidnapper', 'the Johnson is a spirit', 'everything was a recruitment pitch',
  'the corp wants the run to succeed', 'the target already knows the plan',
];

export const MEETING_PLACES: readonly string[] = [
  'a noodle bar booth', 'a crowded nightclub VIP room', 'a parked limousine', 'a park bench at dawn',
  'a quiet tea house', 'an all-night laundromat', 'a rooftop helipad', 'a bowling alley lane', 'a hotel bar',
  'a moving monorail car', 'a sushi restaurant private room', 'a church pew', 'a car wash bay', 'a VR chatroom',
  'the back of a pawn shop', 'an empty parking garage', 'a racetrack grandstand', 'a public library',
  'a fish market at dawn', 'a karaoke booth', 'a steam bath', 'a cemetery', 'a riverside dock',
  'a shooting range', 'an art gallery opening', 'a fast food joint', 'a bus shelter in the rain',
];

export const EMPLOYERS: readonly string[] = [
  'a mid-level corp exec looking for a promotion', 'a desperate parent', 'a gang boss with a grudge',
  'a corp security chief covering a mistake', 'an idealistic activist group', 'a crime family consigliere',
  'a government agent off the books', 'a rival runner team needing extra muscle', 'a dying old millionaire',
  'a talismonger chasing a rare reagent', 'a journalist on a big story', 'a corp R&D head', 'a nervous accountant',
  'a local politician', 'a free spirit with mysterious aims', 'a church elder', 'a corp mage with ambitions',
  'a union boss', 'a smuggler captain', 'an underground club owner', 'a street doc owed a favour',
  'an eccentric collector', 'an insurance investigator', 'a pirate trid producer', 'a retired runner calling in old debts',
  'a rogue AI researcher', 'a fixer acting for an unknown client', 'a heavily augmented bodyguard on their own time',
];

export interface ContactRole {
  id: string;
  label: string;
  skills: string;
  archetype: string;
  fee: number;
}

export const CONTACT_ROLES: readonly ContactRole[] = [
  { id: 'fixer', label: 'Fixer', skills: 'Street Rumours 5, Shadow Market 4, Local Politics 3', archetype: 'fixer', fee: 500 },
  { id: 'street-doc', label: 'Street Doc', skills: 'Cyberware Clinics 4, Black-Market Pharmaceuticals 4, Street Gangs 2', archetype: 'doc', fee: 400 },
  { id: 'bartender', label: 'Bartender', skills: 'Local Gossip 5, Regular Patrons 4, Street Gangs 2', archetype: 'bartender', fee: 100 },
  { id: 'talismonger', label: 'Talismonger', skills: 'Magical Reagents 5, Awakened Community 4, Spirits 3', archetype: 'talismonger', fee: 400 },
  { id: 'fence', label: 'Fence', skills: 'Stolen Goods 5, Pawn Shops 3, Police Procedures 2', archetype: 'fixer', fee: 250 },
  { id: 'gang-lieutenant', label: 'Gang Lieutenant', skills: 'Street Gangs 5, Turf Boundaries 4, Street Drugs 3', archetype: 'ganger', fee: 150 },
  { id: 'wageslave', label: 'Corp Wageslave', skills: 'Corporate Procedures 4, Office Gossip 4, Corporate Security 2', archetype: 'suit', fee: 200 },
  { id: 'beat-cop', label: 'Beat Cop', skills: 'Police Procedures 5, Local Criminals 4, Street Gangs 3', archetype: 'cop', fee: 300 },
  { id: 'journalist', label: 'Journalist', skills: 'Media Contacts 5, Corporate Scandals 4, Local Politics 3', archetype: 'face', fee: 350 },
  { id: 'matrix-fixer', label: 'Matrix Fixer', skills: 'Data Havens 5, Host Security 4, Decker Community 4', archetype: 'decker', fee: 600 },
  { id: 'arms-dealer', label: 'Arms Dealer', skills: 'Weapons Market 5, Military Surplus 4, Smuggling Routes 3', archetype: 'merc', fee: 450 },
  { id: 'smuggler', label: 'Smuggler', skills: 'Smuggling Routes 5, Border Patrols 4, Vehicle Markets 3', archetype: 'smuggler', fee: 400 },
  { id: 'club-owner', label: 'Club Owner', skills: 'Nightlife 5, Local Celebrities 3, Street Drugs 3', archetype: 'face', fee: 300 },
  { id: 'bouncer', label: 'Bouncer', skills: 'Nightlife 3, Local Muscle 4, Street Gangs 3', archetype: 'thug', fee: 75 },
  { id: 'mechanic', label: 'Mechanic', skills: 'Vehicle Markets 4, Chop Shops 4, Rigger Community 3', archetype: 'rigger', fee: 150 },
  { id: 'taxi-driver', label: 'Taxi Driver', skills: 'City Streets 5, Local Gossip 3, Police Patrol Routes 2', archetype: 'rigger', fee: 50 },
  { id: 'squatter-elder', label: 'Squatter Elder', skills: 'Abandoned Buildings 5, Homeless Community 4, Street Rumours 3', archetype: 'ganger', fee: 50 },
  { id: 'street-shaman', label: 'Shaman of the Streets', skills: 'Spirits 5, Awakened Community 4, Local Gossip 3', archetype: 'shaman', fee: 350 },
  { id: 'security-guard', label: 'Security Guard', skills: 'Corporate Security 4, Building Layouts 3, Shift Rotations 3', archetype: 'guard', fee: 200 },
  { id: 'media-producer', label: 'Media Producer', skills: 'Trid Industry 5, Local Celebrities 4, Media Contacts 3', archetype: 'face', fee: 500 },
  { id: 'lawyer', label: 'Lawyer', skills: 'Criminal Law 5, Corporate Law 4, Court Procedures 4', archetype: 'suit', fee: 800 },
  { id: 'gov-clerk', label: 'Government Clerk', skills: 'City Records 5, Bureaucracy 4, Local Politics 3', archetype: 'suit', fee: 250 },
  { id: 'corp-exec', label: 'Corp Executive', skills: 'Corporate Politics 5, Corporate Finance 4, Business Rivals 4', archetype: 'suit', fee: 1500 },
  { id: 'merc-captain', label: 'Merc Captain', skills: 'Military Tactics 5, Mercenary Units 4, Weapons Market 3', archetype: 'merc', fee: 900 },
  { id: 'hermetic-prof', label: 'Hermetic Professor', skills: 'Magical Theory 6, Awakened Community 3, Magical Research 5', archetype: 'mage', fee: 700 },
  { id: 'gutter-decker', label: 'Gutter Decker', skills: 'Local Hosts 4, Decker Community 3, Cheap Hardware 3', archetype: 'decker', fee: 150 },
  { id: 'drone-tech', label: 'Drone Technician', skills: 'Drone Models 5, Electronics Market 4, Rigger Community 3', archetype: 'tech', fee: 300 },
  { id: 'elite-bodyguard', label: 'Elite Bodyguard', skills: 'Executive Protection 5, Corporate Security 4, Celebrity Circles 3', archetype: 'elite', fee: 1200 },
  { id: 'martial-adept', label: 'Martial Arts Instructor', skills: 'Fighting Circuits 5, Adept Community 4, Street Gangs 2', archetype: 'adept', fee: 250 },
  { id: 'enforcer', label: 'Mob Enforcer', skills: 'Organised Crime 4, Loan Sharks 4, Local Businesses 3', archetype: 'thug', fee: 200 },
  { id: 'detective', label: 'Police Detective', skills: 'Police Procedures 5, Criminal Organisations 4, Forensics 4', archetype: 'cop', fee: 600 },
  { id: 'paramedic', label: 'Paramedic', skills: 'Emergency Services 4, Hospitals 4, City Streets 3', archetype: 'doc', fee: 200 },
  { id: 'info-broker', label: 'Information Broker', skills: 'Paydata Market 6, Corporate Rumours 5, Shadow Market 4', archetype: 'fixer', fee: 2000 },
  { id: 'dockmaster', label: 'Dockmaster', skills: 'Shipping Schedules 5, Port Security 4, Smuggling Routes 3', archetype: 'smuggler', fee: 350 },
];

export const SPIRIT_FLAVOUR: readonly string[] = [
  'a swirl of city smog with flickering neon eyes', 'a figure made of rainwater running upward',
  'a towering shape of cracked concrete and rebar', 'a fox of living flame that leaves no ash',
  'a whispering column of dead leaves', 'an old woman made of fog who smells of rain',
  'a flock of shadowy birds moving as one', 'a hound formed of rusted chain', 'a child-sized glow humming lullabies',
  'a wind that carries distant traffic sounds', 'a stag with branches of glowing moss',
  'a shimmering heat haze with a deep voice', 'a muddy river torrent with a laughing face',
  'a knot of tangled power cables that sparks when angry', 'a silent figure in a shroud of ash',
  'a stone face that surfaces from any wall', 'a great serpent of churning seawater',
  'a cloud of moths that speaks in chorus', 'a translucent jogger who never stops running',
  'a crackling ball of lightning that is curious about everything', 'a gentle giant of garden soil and roots',
  'a howling gale with a bad temper', 'a pillar of salt crystals that rings like glass',
];

export const CRITTER_FLAVOUR: readonly string[] = [
  'mangy and half-starved, desperate', 'nesting with young nearby, fiercely territorial',
  'scarred from previous fights with humans', 'glowing faintly with mana-tainted fur', 'part of a large hunting pack',
  'unnaturally intelligent, watching the team', 'escaped from a corp lab, with a tracking collar',
  'sick and twitching from toxic runoff', 'drawn here by spilled reagents', 'oddly tame, possibly someone\'s pet',
  'asleep, but a light sleeper', 'bloated from feeding on garbage', 'lurking in the dark, ambush predator',
  'wounded and very dangerous', 'migrating through and just passing by', 'marked with paint by a local gang',
  'guarding a cache of stolen shiny things',
];

/** Pick a random element using rnd() in [0,1). Throws on an empty list. */
export function pick<T>(list: readonly T[], rnd: () => number): T {
  if (list.length === 0) throw new Error('pick: empty list');
  const i = Math.min(list.length - 1, Math.max(0, Math.floor(rnd() * list.length)));
  return list[i] as T;
}

/** Names of all exported string tables (for tests and tooling). */
export const TABLE_NAMES: readonly string[] = [
  'FIRST_NAMES', 'SURNAMES', 'STREET_NAMES',
  'GANG_ADJECTIVES', 'GANG_NOUNS', 'GANG_THEMES', 'GANG_COLOURS',
  'APPEARANCE', 'CLOTHING', 'DISTINCTIVE', 'MANNERISM', 'MOTIVATION', 'SECRET',
  'CORP_PREFIXES', 'CORP_SUFFIXES', 'INDUSTRIES', 'ORG_KINDS', 'ORG_QUIRKS', 'ORG_GOALS', 'ORG_HQS',
  'JOB_TYPES', 'JOB_TARGETS', 'JOB_LOCATIONS', 'JOB_COMPLICATIONS', 'JOB_TWISTS', 'MEETING_PLACES', 'EMPLOYERS',
  'SPIRIT_FLAVOUR', 'CRITTER_FLAVOUR',
];
